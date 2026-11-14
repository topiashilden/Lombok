// LOCAL ONLY. Connecting the owner's own Nordea accounts from inside the app, so the only thing the person does is approve with
// Nordea ID. Switched on with SOLVO_LIVE=1 (npm run dev:live: 127.0.0.1 only, https) and never on Vercel: every function here
// refuses otherwise. Everything it stores lives in data/private/ (gitignored, files readable by the owner only).
//
// Flow (the routes are thin wrappers around these functions):
//   Profile "Connect Nordea" -> POST /api/nordea/start      makes a state token, asks Enable Banking for the bank's approval URL
//   the bank, with Nordea ID                                 approves and redirects to /callback?code=&state=
//   GET /callback                                            checks the state, swaps the code for a session, saves it
//   /connect/nordea -> POST /api/nordea/sync                 downloads transactions, builds the customer, Home switches to it
//   Profile "Sync now" / "Disconnect"                        sync again, or end the consent and delete everything stored
import "server-only";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  EbError,
  configFromEnv,
  createSession,
  deleteSession,
  fetchAccountTransactions,
  nordeaDateFrom,
  startAuth,
  type EbConfig,
  type EbSession,
} from "@/lib/enable-banking-core";
import { isLoopbackRequest, isSameOriginPost } from "@/lib/loopback";
import { buildNordeaCustomer, type RawTx } from "@/lib/nordea-customer";

const root = () => path.join(process.cwd(), "data/private");
const apiDir = () => path.join(root(), "nordea-api");
const sessionFile = () => path.join(apiDir(), "session.json");
const metaFile = () => path.join(apiDir(), "meta.json");
export const customerFile = () => path.join(root(), "nordea-customer.json");

export const STATE_COOKIE = "solvo_eb_state";
const DEFAULT_REDIRECT = "https://localhost:3000/callback";

/** The master switch. Off on Vercel no matter what the environment says. */
export const liveEnabled = () => process.env.SOLVO_LIVE === "1" && !process.env.VERCEL;
export const redirectUrl = () => process.env.ENABLE_REDIRECT_URL ?? DEFAULT_REDIRECT;
const config = (): EbConfig | null => configFromEnv(process.env);

/** Null when the request may proceed; otherwise the refusal to send. A 404 when the feature is off, so it looks like it isn't there. */
export function guard(req: Request, { post = false }: { post?: boolean } = {}): Response | null {
  if (!liveEnabled()) return new Response("Not found", { status: 404 });
  if (!isLoopbackRequest(req)) return Response.json({ error: "Live bank data only works on this computer (localhost)." }, { status: 403 });
  if (post && !isSameOriginPost(req)) return Response.json({ error: "Refused: not sent from the app." }, { status: 403 });
  return null;
}

function writePrivate(file: string, data: unknown) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
  chmodSync(file, 0o600);
}
const readJson = <T>(file: string): T | null => {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : null;
  } catch {
    return null;
  }
};

type Meta = { syncedAt: string; transactions: number; accounts: number; asOf: string };
export type LiveStatus = {
  enabled: boolean;
  /** Key and application id are set in .env.local. */
  configured: boolean;
  connected: boolean;
  syncedAt: string | null;
  asOf: string | null;
  validUntil: string | null;
  accounts: number;
  transactions: number;
  redirectUrl: string;
};

export function liveStatus(): LiveStatus {
  const session = readJson<EbSession>(sessionFile());
  const meta = readJson<Meta>(metaFile());
  return {
    enabled: liveEnabled(),
    configured: !!config(),
    connected: !!session && existsSync(customerFile()),
    syncedAt: meta?.syncedAt ?? null,
    asOf: meta?.asOf ?? null,
    validUntil: session?.access?.valid_until ?? null,
    accounts: session?.accounts?.length ?? 0,
    transactions: meta?.transactions ?? 0,
    redirectUrl: redirectUrl(),
  };
}

/** What went wrong, said so a person can act on it. Never includes account data. */
export function explain(e: unknown): string {
  if (e instanceof EbError) {
    if (e.status === 401 || e.status === 403) return "Enable Banking refused the request. Check the application id and key in .env.local, and that the consent is still valid.";
    if (e.status === 422 || e.status === 400) return `Enable Banking rejected the request (${e.status}). The redirect address must match the one registered for the application.`;
    if (e.status === 429) return "Too many requests. Wait a minute and try again.";
    return `Enable Banking answered with an error (${e.status}).`;
  }
  return e instanceof Error ? e.message.slice(0, 200) : "Something went wrong.";
}

/** Step 1: ask Enable Banking for the bank's approval page. `state` is checked again in the callback. */
export async function beginConsent(state: string): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Set ENABLE_APP_ID and ENABLE_KEY_PATH in .env.local, then restart npm run dev:live.");
  const validDays = Math.min(180, Math.max(1, Number(process.env.NORDEA_CONSENT_DAYS ?? 30)));
  const r = await startAuth(cfg, { bank: "Nordea", country: "FI", state, redirectUrl: redirectUrl(), validDays });
  return r.url;
}

/** Step 2: the bank sent the person back with a code. Swap it for a session and keep it. */
export async function completeConsent(code: string): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("Enable Banking is not configured.");
  const session = await createSession(cfg, code);
  if (!session.accounts?.length) throw new Error("The bank returned no accounts.");
  writePrivate(sessionFile(), session);
}

let inFlight: Promise<Meta> | null = null;
let lastFinished = 0;

/** Step 3 (and every refresh): download transactions for every account, rebuild the customer. Throttled to one run per 30 s. */
export function syncLive(): Promise<Meta> {
  if (inFlight) return inFlight;
  if (Date.now() - lastFinished < 30_000 && existsSync(metaFile())) return Promise.resolve(readJson<Meta>(metaFile()) as Meta);
  inFlight = (async () => {
    const cfg = config();
    const session = readJson<EbSession>(sessionFile());
    if (!cfg || !session?.accounts?.length) throw new Error("Not connected yet.");
    const dateFrom = nordeaDateFrom();
    const perAccount: RawTx[][] = [];
    for (const acc of session.accounts) perAccount.push((await fetchAccountTransactions(cfg, acc.uid, dateFrom)).transactions);
    // Keep the raw cache under the same names as scripts/nordea-psd2.mjs, so the command-line builder keeps working.
    perAccount.forEach((txs, i) => writePrivate(path.join(apiDir(), `tx_account${i + 1}.json`), txs));
    for (const f of readdirSync(apiDir())) {
      const n = /^tx_account(\d+)\.json$/.exec(f)?.[1];
      if (n && Number(n) > perAccount.length) rmSync(path.join(apiDir(), f));
    }
    const { customer } = buildNordeaCustomer(perAccount);
    writePrivate(customerFile(), customer);
    const meta: Meta = { syncedAt: new Date().toISOString(), transactions: customer.transactions.length, accounts: perAccount.length, asOf: customer.asOf };
    writePrivate(metaFile(), meta);
    return meta;
  })().finally(() => {
    inFlight = null;
    lastFinished = Date.now();
  });
  return inFlight;
}

/** Ends the consent at Enable Banking (best effort) and deletes everything stored here: session, raw cache and customer. */
export async function disconnectLive(): Promise<void> {
  const cfg = config();
  const session = readJson<EbSession>(sessionFile());
  if (cfg && session?.session_id) {
    try {
      await deleteSession(cfg, session.session_id);
    } catch {
      // Already expired or ended: the local copy still goes.
    }
  }
  rmSync(apiDir(), { recursive: true, force: true });
  rmSync(customerFile(), { force: true });
  lastFinished = 0;
}
