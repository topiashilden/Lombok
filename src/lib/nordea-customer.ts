// Turns Enable Banking transactions (the owner's own Nordea accounts) into the DemoCustomer shape the whole app reads.
// Pure: no file or network access, so the in-app connect flow (src/lib/live-nordea.ts) and the command-line builder
// (scripts/build-nordea-customer.mjs) share one set of rules. Only `import type` from the app, so Node can load this file directly.
//
// Privacy: account ids are pseudonymised (A, B), IBANs are never copied, and names of private persons are replaced with
// "Person" (P2P and person-like counterparties). Business names are kept so bills and merchants stay readable.
import type { DemoCustomer, Tx } from "./demo";

export type RawTx = {
  credit_debit_indicator?: string;
  transaction_amount: { amount: string };
  booking_date?: string;
  transaction_date?: string;
  value_date?: string;
  status?: string;
  bank_transaction_code?: { description?: string };
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
  balance_after_transaction?: { amount: string };
  merchant_category_code?: string;
};

// Same baskets as scripts/build-demo-data.mjs, plus the extra categories real data needs.
//  1 = fixed and regular, 2 = fixed and irregular, 3 = everyday. Not listed = not spending (income, own transfers, investing).
export const BASKET: Record<string, 1 | 2 | 3> = {
  Housing: 1, Utilities: 1, Subscriptions: 1, Insurance: 1,
  Health: 2, "Home & Tech": 2, Travel: 2,
  Groceries: 3, Restaurants: 3, Transportation: 3, Entertainment: 3, Lifestyle: 3,
  P2P: 3, Cash: 3, "Card bill": 3, Other: 3,
};

// First match wins. Brand patterns only; check the "unmapped" list the builder prints.
const RULES: [string, RegExp][] = [
  ["Housing", /VISMA PAYMENTS|HOAS|SATO |VUOKRA|KIINTEISTÖ/],
  ["Utilities", /HELEN|FORTUM|ELENIA|VATTENFALL|AALTO ENERGIA|ENERGIA|SÄHKÖ|ELISA OYJ|\bDNA\b|TELIA|SONERA|SAUNALAHTI|VESI/],
  ["Groceries", /S MARKET|K MARKET|K SUPERMARKET|K CITYMARKET|LIDL|ALEPA|PRISMA|SALE |TOKMANNI|KAUPPAHALLI/],
  ["Restaurants", /WOLT|FOODORA|HESBURGER|MCD|MCDONALD|RESQ|SUBWAY|KOTIPIZZA|BURGER|RAVINTOLA|RESTAURANT|CAFE|KAHVI|COFFEE|COMPASS|YLVA|SODEXO|FAZER|ESPRESSO|STARBUCKS|BAGEL|PIZZA|SUSHI|KEBAB|BAR /],
  ["Transportation", /BOLT|UBER|HSL|HELSINGIN SEUD|SEUDUN|\bVR\b|CITYBIKE|VÄRE|VARE OY|TAXI|TAKSI|NESTE|\bST1\b|\bABC\b|SHELL|PARKKI|PARKING|LIME/],
  // Recurring subscriptions are their own bracket (fixed and regular), apart from one-off entertainment.
  ["Subscriptions", /SPOTIFY|NETFLIX|HBO|YOUTUBE|DISNEY|APPLE COM|ICLOUD|PRIME VIDEO|TWITCH|PLAYSTATION|NINTENDO|STORYTEL|BOOKBEAT/],
  ["Insurance", /VAKUUTUS|INSURANCE|TAPIOLA|FENNIA|POHJOLA|\bIF\b/],
  ["Entertainment", /TIKETTI|LIPUTON|STEAM|FINNKINO|CINEMA/],
  ["Health", /APTEEKKI|APOTEK|SATS|FYSIO|LÄÄKÄRI|TERVEYS|HAMMAS|MEHILÄINEN|TERVEYSTALO|OPTIIKKA|SPECSAVERS/],
  ["Home & Tech", /CLAS OHLSON|VERKKOKAUPPA|JIMMS|ELKJØP|GIGANTTI|IKEA|JYSK|PAYPAL|AMAZON|APPLE STORE|ELKO/],
  ["Travel", /TRIP COM|BOOKING|AIRBNB|FINNAIR|RYANAIR|HOTEL|ECPAY|CTBC|TAISHIN|ROOM ABROAD|KLOOK|HOSTEL|AIRLINES|EASYJET/],
  ["Lifestyle", /STADIUM|ZARA|H&M|\bHM\b|LINDEX|SPORT|PARTURI|KAMPAAMO|NIKOTIINI|SUMUP|ZETTLE|AMNESTY|SKI RY|SECOND HAND|KLARNA|TRUSTLY/],
];
const CORPORATE = /\b(OY|OYJ|AB|ABP|LTD|LLC|INC|RY|KY|GMBH|AS|ASA|BANK|PANKKI|KOULU|SÄÄTIÖ|ELÄKELAITOS|SERVICE|SERVICES|SHOP|STORE|MARKET|CAFE|COM|WWW)\b/;

const uc = (s: string | undefined) => (s ?? "").toUpperCase();
const cleanName = (raw: string | undefined) =>
  (raw ?? "")
    .replace(/^MOB\.?\s?PAY\*?\s*/i, "")
    .replace(/\*/g, " ")
    .replace(/\b[A-Z0-9]{9,}\b/g, "") // per-charge ids such as Spotify P4B7C6...
    .replace(/\s+/g, " ")
    .trim();
const looksLikePerson = (name: string) =>
  /^[A-Za-zÅÄÖåäö'-]+( [A-Za-zÅÄÖåäö'-]+){1,3}$/.test(name) && !CORPORATE.test(uc(name)) && !RULES.some(([, re]) => re.test(uc(name)));

const letter = (i: number) => String.fromCharCode(65 + i);
const round2 = (n: number) => Math.round(n * 100) / 100;

export type BuildResult = {
  customer: DemoCustomer;
  /** Business names no rule matched, with euros spent over the whole period. For tuning RULES; never contains person names. */
  unmapped: Record<string, number>;
};

/** `accounts` is one array of transactions per account, in the order the bank listed the accounts. */
export function buildNordeaCustomer(accounts: RawTx[][]): BuildResult {
  const raw = accounts.flatMap((txs, i) => txs.map((t) => ({ ...t, _acc: letter(i) })));

  const rows: Tx[] = raw
    .map((t) => {
      const debit = t.credit_debit_indicator === "DBIT";
      const code = t.bank_transaction_code?.description ?? "";
      const counterparty = cleanName(debit ? t.creditor?.name : t.debtor?.name);
      const date = t.booking_date ?? t.transaction_date ?? t.value_date ?? "";
      const amount = (debit ? -1 : 1) * Number(t.transaction_amount.amount);
      // Hyphens and dots become spaces so "S-market" and "Trip.com" match "S MARKET" and "TRIP COM".
      const hay = uc(`${counterparty} ${(t.remittance_information ?? []).join(" ")}`).replace(/[-.]/g, " ");
      // MobilePay to a private person shows up as "MOB PAY <name>", often with the code Korttiosto. MobilePay to a shop
      // ("MOB PAY KLARNA") is a single word and falls through to the merchant rules.
      const mobPay = /^MOB\.?\s?PAY/i.test((debit ? t.creditor?.name : t.debtor?.name) ?? "");
      const p2p = code === "Mobiilimaksu" || /VIPPS/.test(hay) || (mobPay && looksLikePerson(counterparty));

      let category: string;
      if (code === "Oma siirto") category = "Transfer";
      else if (code === "Palkka" || code === "Opintotuki") category = "Salary"; // regular income: pay and the study grant
      else if (/NORDNET/.test(hay)) category = debit ? "Invest Deposit" : "Invest Withdraw";
      else if (p2p) category = "P2P";
      else if (!debit && code !== "Korjaus") category = "Other Income";
      else if (/^NORDEA BANK/.test(uc(counterparty)) && debit) category = "Card bill";
      else if (/ATM/i.test(code)) category = "Cash";
      else category = RULES.find(([, re]) => re.test(hay))?.[0] ?? (code === "e-lasku" ? "Utilities" : "Other");

      // Card purchases are always shops. Only transfers and P2P can be to a private person.
      const isPerson = p2p || (code !== "Korttiosto" && counterparty && looksLikePerson(counterparty));
      return {
        date,
        ts: t.transaction_date ?? date,
        account: t._acc,
        category,
        amount,
        balance: t.balance_after_transaction ? Number(t.balance_after_transaction.amount) : 0,
        type: t.status === "PDNG" ? "pending" : code || "unknown",
        merchant: isPerson ? "Person" : counterparty || null,
        mcc: t.merchant_category_code ?? null,
      };
    })
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!rows.length) throw new Error("The bank returned no transactions");

  const asOf = rows[rows.length - 1].date;
  const allMonths = [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort();
  // Use complete months only: drop the month of asOf unless asOf is its last day.
  const lastDay = new Date(Date.UTC(+asOf.slice(0, 4), +asOf.slice(5, 7), 0)).getUTCDate();
  const complete = +asOf.slice(8, 10) === lastDay ? allMonths : allMonths.slice(0, -1);
  const last12Months = complete.slice(-12);

  const monthly: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    monthly[m] ??= {};
    monthly[m][r.category] = round2((monthly[m][r.category] ?? 0) + r.amount);
  }
  const basketYear: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  const categoryYear: Record<string, number> = {};
  for (const m of last12Months) {
    for (const [cat, sum] of Object.entries(monthly[m])) {
      const basket = BASKET[cat];
      if (basket) {
        basketYear[basket] = round2(basketYear[basket] - sum);
        categoryYear[cat] = round2((categoryYear[cat] ?? 0) - sum);
      }
    }
  }
  const salaryYear = round2(last12Months.reduce((s, m) => s + (monthly[m].Salary ?? 0), 0));

  const unmapped: Record<string, number> = {};
  for (const r of rows) {
    if (r.category === "Other" && r.merchant && r.merchant !== "Person") unmapped[r.merchant] = (unmapped[r.merchant] ?? 0) - r.amount;
  }

  return {
    customer: {
      id: "ME-NORDEA",
      postalCode: "",
      age: 0,
      asOf,
      accounts: [...new Set(rows.map((r) => r.account))],
      basketOf: BASKET,
      summary: { last12Months, basketYear, categoryYear, salaryYear },
      monthly,
      transactions: rows,
    },
    unmapped,
  };
}
