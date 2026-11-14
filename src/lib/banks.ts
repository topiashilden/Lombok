// Which other banks the person has connected, and which view they chose. Both live in cookies (not localStorage) because the
// pages render on the server and need to know. DEMO: connecting is simulated and attaches example data (see second-bank.ts).

export type BankId = "nordea" | "nordnet";
export type View = "all" | "spankki";

export const BANKS_COOKIE = "solvo_banks";
export const VIEW_COOKIE = "solvo_view";

export const BANK_INFO: Record<BankId, { name: string; kind: "bank" | "investments"; blurb: string }> = {
  nordea: { name: "Nordea", kind: "bank", blurb: "Accounts, balances and transactions through PSD2, approved with Nordea ID" },
  // The id stays "nordnet" (it is stored in cookies); the person picks which platform they use, see PLATFORMS.
  nordnet: { name: "Investing platform", kind: "investments", blurb: "Nordnet, Trading 212, eToro or another one you use besides your bank" },
};

// The separate investing platform a person uses. DEMO: whichever they pick shows the same example holdings. What differs is how the
// real connection would work, because investing platforms are not part of PSD2 (it covers payment accounts). Checked 14 Nov 2026.
export const PLATFORMS = ["Nordnet", "Trading 212", "eToro", "Another platform"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_COOKIE = "solvo_platform";
export const PLATFORM_HOW: Record<Platform, string> = {
  Nordnet: "Nordnet has no open banking, and its own API is closed to new customers. You would share an export of your holdings.",
  "Trading 212": "Trading 212 lets you create a read-only key in its app. You would paste that key, and Solvo could only read.",
  eToro: "eToro lets a verified account create a read-only key in its settings. You would paste that key, and Solvo could only read.",
  "Another platform": "Most platforms have no open banking. You would share an export of your holdings, or a read-only key where the platform offers one.",
};
// The bank shown for the simulated second bank (the demo data stays the same whichever the person picks). Sanitised: it ends up in text.
export const BANKNAME_COOKIE = "solvo_bankname";
export const DEFAULT_BANKNAME = "Nordea";
export const parseBankName = (raw: string | undefined | null): string => {
  const v = raw ? decodeURIComponent(raw).trim() : "";
  return /^[\p{L}\p{N} .&'-]{1,40}$/u.test(v) ? v : DEFAULT_BANKNAME;
};
export function writeBankNameCookie(name: string) {
  document.cookie = `${BANKNAME_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=31536000; samesite=lax`;
}
export function readBankNameCookie(): string {
  return parseBankName(document.cookie.split("; ").find((c) => c.startsWith(`${BANKNAME_COOKIE}=`))?.slice(BANKNAME_COOKIE.length + 1));
}

// Finland's banks as Enable Banking lists them (docs, 14 Nov 2026), shown when the live list is not set up. Connecting one is simulated.
export const FALLBACK_BANKS = ["OP", "Nordea", "S-Pankki", "Danske Bank", "Säästöpankki", "Aktia", "Ålandsbanken", "POP Pankki", "Oma Säästöpankki"];

export const parsePlatform = (raw: string | undefined | null): Platform => {
  const v = raw ? decodeURIComponent(raw) : "";
  return PLATFORMS.find((p) => p === v) ?? "Nordnet";
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

export function writePlatformCookie(platform: Platform) {
  document.cookie = `${PLATFORM_COOKIE}=${encodeURIComponent(platform)}; path=/; max-age=31536000; samesite=lax`;
}

export function clearBanksCookie() {
  document.cookie = `${PLATFORM_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${BANKNAME_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${BANKS_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${VIEW_COOKIE}=; path=/; max-age=0`;
}

export function readBanksCookie(): { banks: BankId[]; view: View } {
  const get = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  return { banks: parseBanks(get(BANKS_COOKIE)), view: get(VIEW_COOKIE) === "spankki" ? "spankki" : "all" };
}

export function readPlatformCookie(): Platform {
  return parsePlatform(document.cookie.split("; ").find((c) => c.startsWith(`${PLATFORM_COOKIE}=`))?.slice(PLATFORM_COOKIE.length + 1));
}
