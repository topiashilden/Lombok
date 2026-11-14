// Which other banks the person has connected, and which view they chose. Both live in cookies (not localStorage) because the
// pages render on the server and need to know. DEMO: connecting is simulated and attaches example data (see second-bank.ts).

export type BankId = "nordea" | "nordnet";
export type View = "all" | "spankki";

export const BANKS_COOKIE = "solvo_banks";
export const VIEW_COOKIE = "solvo_view";

export const BANK_INFO: Record<BankId, { name: string; kind: "bank" | "investments"; blurb: string }> = {
  nordea: { name: "Nordea", kind: "bank", blurb: "Accounts, balances and transactions through PSD2, approved with Nordea ID" },
  nordnet: { name: "Nordnet", kind: "investments", blurb: "Your investment account. Nordnet has no open banking for investments, so you share an export file" },
};

export const parseBanks = (raw: string | undefined | null): BankId[] =>
  (raw ?? "")
    .split(",")
    .filter((b): b is BankId => b === "nordea" || b === "nordnet");

/** Browser only. Saves the connected banks (and the view) for a year. */
export function writeBanksCookie(banks: BankId[], view: View = "all") {
  const opts = "; path=/; max-age=31536000; samesite=lax";
  document.cookie = `${BANKS_COOKIE}=${banks.join(",")}${opts}`;
  document.cookie = `${VIEW_COOKIE}=${view}${opts}`;
}

export function clearBanksCookie() {
  document.cookie = `${BANKS_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${VIEW_COOKIE}=; path=/; max-age=0`;
}

export function readBanksCookie(): { banks: BankId[]; view: View } {
  const get = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  return { banks: parseBanks(get(BANKS_COOKIE)), view: get(VIEW_COOKIE) === "spankki" ? "spankki" : "all" };
}
