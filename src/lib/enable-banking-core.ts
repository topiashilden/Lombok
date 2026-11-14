// Enable Banking (PSD2 account information), for the OWNER's own accounts, run locally. No dependency on the app, so the in-app
// connect flow (src/lib/live-nordea.ts) and scripts/nordea-psd2.mjs share it. Docs: https://enablebanking.com/docs/api/reference/
//
// The flow: sign a short-lived JWT with the application's private key (never leaves this machine) -> POST /auth returns a URL
// -> the person approves with their bank's own ID -> the bank redirects back with a single-use code -> POST /sessions turns the
// code into a session -> GET /accounts/{uid}/transactions. Only account information is requested; there is no payment call here.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import type { RawTx } from "./nordea-customer"; // type only: erased, so Node never loads it

export type EbConfig = { appId: string; keyPath: string; apiUrl: string };
export type EbSession = {
  session_id?: string;
  accounts?: { uid: string }[];
  access?: { valid_until?: string };
};

export class EbError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** The settings come from .env.local (gitignored). The private key stays outside the repository. */
export function configFromEnv(env: Record<string, string | undefined>): EbConfig | null {
  const appId = env.ENABLE_APP_ID;
  const keyPath = env.ENABLE_KEY_PATH;
  if (!appId || !keyPath) return null;
  return { appId, keyPath, apiUrl: env.ENABLE_API_URL ?? "https://api.enablebanking.com" };
}

const b64url = (b: string | Buffer) => Buffer.from(b).toString("base64url");

export function makeJwt(cfg: EbConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: cfg.appId }));
  const body = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(readFileSync(cfg.keyPath, "utf8"));
  return `${head}.${body}.${b64url(sig)}`;
}

type CallOptions = { query?: Record<string, string>; body?: unknown };

async function call<T>(cfg: EbConfig, method: string, path: string, { query, body }: CallOptions = {}): Promise<T> {
  const url = new URL(cfg.apiUrl + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${makeJwt(cfg)}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // One polite retry when the bank or Enable Banking says slow down.
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text.slice(0, 300) };
    }
    // Error bodies describe the problem; they do not contain account data.
    if (!res.ok) throw new EbError(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`, res.status);
    return json as T;
  }
}

/** Checks the key and the application. Returns names and flags only. */
export const appStatus = (cfg: EbConfig) =>
  call<{ name?: string; active?: boolean; environment?: string; countries?: string[] }>(cfg, "GET", "/application");

/** Starts a consent. The person opens `url`, approves with the bank's own ID, and lands on `redirectUrl` with ?code=&state=. */
export const startAuth = (cfg: EbConfig, o: { bank: string; country: string; state: string; redirectUrl: string; validDays: number }) =>
  call<{ url: string; authorization_id?: string }>(cfg, "POST", "/auth", {
    body: {
      access: { valid_until: new Date(Date.now() + o.validDays * 864e5).toISOString() },
      aspsp: { name: o.bank, country: o.country },
      state: o.state,
      redirect_url: o.redirectUrl,
      psu_type: "personal",
    },
  });

/** The code is single-use and short-lived: exchange it straight away. */
export const createSession = (cfg: EbConfig, code: string) => call<EbSession>(cfg, "POST", "/sessions", { body: { code } });

/** Ends the consent at Enable Banking. */
export const deleteSession = (cfg: EbConfig, sessionId: string) => call<unknown>(cfg, "DELETE", `/sessions/${encodeURIComponent(sessionId)}`);

/** Every transaction since `dateFrom` for one account, following the bank's pages. */
export async function fetchAccountTransactions(cfg: EbConfig, uid: string, dateFrom: string): Promise<{ transactions: RawTx[]; pages: number }> {
  const transactions: RawTx[] = [];
  const query: Record<string, string> = { date_from: dateFrom };
  let pages = 0;
  for (;;) {
    const d = await call<{ transactions?: RawTx[]; continuation_key?: string }>(cfg, "GET", `/accounts/${encodeURIComponent(uid)}/transactions`, { query });
    transactions.push(...(d.transactions ?? []));
    pages++;
    if (!d.continuation_key || pages > 200) break;
    query.continuation_key = d.continuation_key;
  }
  return { transactions, pages };
}

/** Nordea allows at most 540 days of history. Ask for 535 to stay inside the limit. */
export const nordeaDateFrom = (now = Date.now()) => new Date(now - 535 * 864e5).toISOString().slice(0, 10);
