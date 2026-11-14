// A real Enable Banking connection with example data, for the public demo. It uses Enable Banking's SANDBOX: the same API, the same
// consent flow and the same session and transaction calls as the real thing, but the bank is a test bank and the accounts hold
// example data. So a judge can connect a bank in the app and see the whole integration work, with no account and no real money.
//
// Not the same as src/lib/live-nordea.ts, which is the owner's REAL Nordea, local only. Rules that keep the two apart:
//  - It needs its own application (ENABLE_SANDBOX_APP_ID, ENABLE_SANDBOX_KEY). The production key is never read here, and before
//    any consent this asks Enable Banking which environment the application is in and refuses anything but SANDBOX.
//  - Nothing is stored on the server. The session lives in the visitor's own browser as an encrypted httpOnly cookie, and what the
//    page shows is read from Enable Banking per request (with a short in-memory cache). Disconnect ends the session at Enable Banking.
//
// Setup (once, by the app owner): Enable Banking control panel > Applications > register a new application with environment SANDBOX,
// whitelist the redirect URLs (https://localhost:3000/callback and https://<your-site>/callback), save the application id and the
// private key (.pem) it gives you. Put them in .env.local (local) or in the hosting environment (the key's text, one line with \n).
import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  appStatus,
  createSession,
  deleteSession,
  fetchAccountTransactions,
  fetchBalances,
  listAspsps,
  sandboxConfigFromEnv,
  startAuth,
  type AspspSummary,
  type EbConfig,
} from "@/lib/enable-banking-core";
import type { RawTx } from "@/lib/nordea-customer";
import { unseal } from "@/lib/sealed";

export const SANDBOX_STATE_COOKIE = "solvo_eb_state_sbx";
export const LINKED_COOKIE = "solvo_linked";

const config = (): EbConfig | null => sandboxConfigFromEnv(process.env);
export const sandboxEnabled = () => !!config();
/** The secret the cookies are sealed with: derived from the sandbox private key, so there is nothing extra to set. */
export const sealSecret = () => createHash("sha256").update(config()?.privateKey ?? "").digest("hex");

export type Linked = { sessionId: string; uids: string[]; bank: string; validUntil: string };

let verified: Promise<void> | null = null;
/** Refuses to run against anything but a SANDBOX application. A production key put here by mistake stops at this check. */
function requireSandbox(cfg: EbConfig): Promise<void> {
  verified ??= appStatus(cfg).then((app) => {
    if (app.environment !== "SANDBOX") throw new Error("ENABLE_SANDBOX_APP_ID is not a SANDBOX application. Refusing to use it.");
  });
  verified.catch(() => (verified = null));
  return verified;
}

let bankCache: { at: number; banks: AspspSummary[] } | null = null;
export async function sandboxBanks(country = "FI"): Promise<AspspSummary[]> {
  const cfg = config();
  if (!cfg) throw new Error("Not configured");
  await requireSandbox(cfg);
  if (bankCache && Date.now() - bankCache.at < 3_600_000) return bankCache.banks;
  const banks = await listAspsps(cfg, country);
  bankCache = { at: Date.now(), banks };
  return banks;
}

export async function beginLinked(o: { state: string; bank: string; country: string; redirectUrl: string }): Promise<string> {
  const cfg = config();
  if (!cfg) throw new Error("Not configured");
  await requireSandbox(cfg);
  // Only banks Enable Banking itself lists are accepted, not whatever the browser sends.
  if (!(await sandboxBanks(o.country)).some((b) => b.name === o.bank)) throw new Error("Unknown bank");
  return (await startAuth(cfg, { bank: o.bank, country: o.country, state: o.state, redirectUrl: o.redirectUrl, validDays: 30 })).url;
}

export async function completeLinked(code: string): Promise<Linked> {
  const cfg = config();
  if (!cfg) throw new Error("Not configured");
  await requireSandbox(cfg);
  const s = await createSession(cfg, code);
  const uids = (s.accounts ?? []).map((a) => a.uid).filter(Boolean);
  if (!s.session_id || !uids.length) throw new Error("The bank returned no accounts.");
  return { sessionId: s.session_id, uids, bank: (s as { aspsp?: { name?: string } }).aspsp?.name ?? "Your bank", validUntil: s.access?.valid_until ?? "" };
}

export async function endLinked(linked: Linked): Promise<void> {
  const cfg = config();
  cache.delete(linked.sessionId);
  if (!cfg) return;
  try {
    await deleteSession(cfg, linked.sessionId);
  } catch {
    // Already expired or ended.
  }
}

export type LinkedSummary = {
  bank: string;
  accounts: { balance: number; currency: string }[];
  cash: number;
  last30: { in: number; out: number };
  recent: { date: string; title: string; amount: number }[];
  recurring: { title: string; amount: number }[];
  transactions: number;
  syncedAt: string;
};

const cache = new Map<string, { at: number; summary: LinkedSummary }>();
const TTL = 5 * 60_000;

const amountOf = (t: RawTx) => (t.credit_debit_indicator === "DBIT" ? -1 : 1) * Number(t.transaction_amount.amount);
const dateOf = (t: RawTx) => t.booking_date ?? t.value_date ?? t.transaction_date ?? "";
const titleOf = (t: RawTx) => (t.credit_debit_indicator === "DBIT" ? t.creditor?.name : t.debtor?.name) ?? t.remittance_information?.[0] ?? "Payment";

/** Reads the linked bank from Enable Banking (balances and a year of transactions) and boils it down to what the Home card shows. */
export async function linkedSummary(linked: Linked, { fresh = false }: { fresh?: boolean } = {}): Promise<LinkedSummary> {
  const hit = cache.get(linked.sessionId);
  if (hit && !fresh && Date.now() - hit.at < TTL) return hit.summary;
  const cfg = config();
  if (!cfg) throw new Error("Not configured");
  await requireSandbox(cfg);

  const dateFrom = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const accounts: LinkedSummary["accounts"] = [];
  const txs: RawTx[] = [];
  for (const uid of linked.uids) {
    const balances = await fetchBalances(cfg, uid);
    const b = balances.find((x) => x.balance_type === "CLAV") ?? balances.find((x) => x.balance_type === "ITAV") ?? balances[0];
    if (b) accounts.push({ balance: Number(b.balance_amount.amount), currency: b.balance_amount.currency });
    txs.push(...(await fetchAccountTransactions(cfg, uid, dateFrom)).transactions);
  }

  const dated = txs.filter((t) => dateOf(t)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  const newest = dated[0] ? dateOf(dated[0]) : "";
  // "Last 30 days" counts back from the newest transaction, so a test bank whose example data is old still shows something.
  const since = newest ? new Date(Date.parse(`${newest}T00:00:00Z`) - 30 * 864e5).toISOString().slice(0, 10) : "";
  const recent30 = dated.filter((t) => dateOf(t) > since);
  const round = (n: number) => Math.round(n * 100) / 100;

  // A payee charged about the same amount in at least three different months is a recurring payment.
  const byPayee = new Map<string, { name: string; months: Set<string>; amounts: number[] }>();
  for (const t of dated) {
    if (amountOf(t) >= 0) continue;
    const name = titleOf(t);
    const e = byPayee.get(name.toLowerCase()) ?? { name, months: new Set<string>(), amounts: [] };
    e.months.add(dateOf(t).slice(0, 7));
    e.amounts.push(-amountOf(t));
    byPayee.set(name.toLowerCase(), e);
  }
  const recurring = [...byPayee.values()]
    .filter((e) => e.months.size >= 3 && Math.max(...e.amounts) - Math.min(...e.amounts) <= Math.max(1, Math.min(...e.amounts) * 0.1))
    .map((e) => ({ title: e.name, amount: round(e.amounts[0]) }))
    .sort((x, y) => y.amount - x.amount)
    .slice(0, 6);

  const summary: LinkedSummary = {
    bank: linked.bank,
    accounts,
    cash: round(accounts.reduce((s, a) => s + a.balance, 0)),
    last30: {
      in: round(recent30.filter((t) => amountOf(t) > 0).reduce((s, t) => s + amountOf(t), 0)),
      out: round(-recent30.filter((t) => amountOf(t) < 0).reduce((s, t) => s + amountOf(t), 0)),
    },
    recent: dated.slice(0, 5).map((t) => ({ date: dateOf(t), title: titleOf(t), amount: round(amountOf(t)) })),
    recurring,
    transactions: dated.length,
    syncedAt: new Date().toISOString(),
  };
  cache.set(linked.sessionId, { at: Date.now(), summary });
  return summary;
}

/** The bank this visitor linked, from their own cookie. Null when there is none, it was altered, or sandbox mode is off. */
export async function currentLinked(): Promise<Linked | null> {
  if (!sandboxEnabled()) return null;
  const linked = unseal<Linked>((await cookies()).get(LINKED_COOKIE)?.value, sealSecret());
  return linked?.sessionId && Array.isArray(linked.uids) ? linked : null;
}

/** What went wrong, said so a person can act on it. */
export function explainLinked(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m.includes("not a SANDBOX")) return "This demo bank connection is misconfigured.";
  if (m.includes(" 401 ") || m.includes(" 403 ")) return "Enable Banking refused the request. The test application or its key may be wrong.";
  if (m.includes(" 429 ")) return "Too many requests. Wait a minute and try again.";
  if (m.includes("Unknown bank")) return "That bank isn't available.";
  return "Couldn't reach the bank connection. Try again.";
}
