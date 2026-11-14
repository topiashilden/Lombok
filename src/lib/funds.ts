// S-Pankki's own funds (A share class, open to every customer) for the monthly investment plan.
// Fees are from S-Pankki Rahastoyhtiö's fund price list, valid from 4 June 2026: ongoing charges ("juoksevat kulut",
// 2025) and the subscription fee. Redemption fee is 0 % for all of these.
// Returns are ILLUSTRATIVE assumptions per fund type, used only for the projection; they are not S-Pankki figures.
// Solvo doesn't recommend a fund (that would be investment advice): the user picks, and in production the plan
// would be set up in S-Pankki's own fund service.

export type FundType = "Equity" | "Balanced" | "Bonds" | "Special";

export const FUND_TYPES: { type: FundType; label: string; note?: string }[] = [
  { type: "Equity", label: "Equities" },
  { type: "Balanced", label: "Balanced" },
  { type: "Bonds", label: "Bonds" },
  {
    type: "Special",
    label: "Property & forest",
    note: "Special investment funds: minimum 200 €, a subscription fee, a redemption fee that depends on how long you hold, and redemptions only on set dates. Some also charge a performance fee.",
  },
];

export type FundOption = {
  id: string;
  name: string;
  description: string;
  type: FundType;
  ongoingFeePct: number;
  subscriptionFeePct: number;
  illustrativeReturnPct: number; // before fees; not a promise
};

export const FUNDS_SOURCE =
  "Fees: S-Pankki fund price list, valid from 4 June 2026 (A share class). S-Pankki Pelto is being wound up and isn't listed.";

const f = (
  id: string,
  name: string,
  description: string,
  type: FundType,
  ongoingFeePct: number,
  subscriptionFeePct: number,
  illustrativeReturnPct: number,
): FundOption => ({ id, name: `S-Pankki ${name}`, description, type, ongoingFeePct, subscriptionFeePct, illustrativeReturnPct });

// Every S-Pankki fund open to a retail customer in its A share class. Not listed: F classes (wealth-management
// clients only), C/B/D classes (minimum 100 000 € or more), Varainhoito Säästäjä (tied to the round-up account),
// Pelto (in liquidation), and Private Markets / Private Credit / Private Assets (minimum 10 000 € or more).
export const FUNDS: FundOption[] = [
  f("passiivinen-usa-esg", "Passiivinen USA ESG Osake A", "Index fund, large US companies", "Equity", 0.49, 0.1, 6.5),
  f("passiivinen-eurooppa-esg", "Passiivinen Eurooppa ESG Osake A", "Index fund, large European companies", "Equity", 0.49, 0.25, 6),
  f("ilmastotavoite-maailma", "Ilmastotavoite Maailma Osake A", "Companies worldwide with a climate target", "Equity", 1.8, 0, 6.5),
  f("usa-osake", "USA Osake A", "Actively picked US companies", "Equity", 1.5, 0, 6.5),
  f("eurooppa-osake", "Eurooppa Osake A", "Actively picked European companies", "Equity", 1.8, 0, 6),
  f("fossiiliton-eurooppa-esg", "Fossiiliton Eurooppa ESG Osake A", "European companies, no fossil fuels", "Equity", 1.8, 0, 6),
  f("fenno-osake", "Fenno Osake A", "Finnish companies", "Equity", 1.6, 0, 6),
  f("suomalaiset-pienyhtiot", "Suomalaiset Pienyhtiöt Osake A", "Small Finnish companies", "Equity", 1.7, 0, 6.5),
  f("kehittyvat-markkinat-osake", "Kehittyvät Markkinat Osake A", "Emerging-market companies", "Equity", 1.9, 0, 6.5),
  f("kasvavat-taloudet-osake", "Kasvavat Taloudet Osake A", "Companies in fast-growing economies", "Equity", 1.9, 0, 6.5),
  f("varainhoito-30", "Varainhoito 30 A", "About 30 % equities, the rest bonds", "Balanced", 0.9, 0, 3.5),
  f("varainhoito-50", "Varainhoito 50 A", "About half equities, half bonds", "Balanced", 1.05, 0, 4.5),
  f("varainhoito-70", "Varainhoito 70 A", "About 70 % equities, the rest bonds", "Balanced", 1.15, 0, 5.2),
  f("varainhoito-100", "Varainhoito 100 A", "Equities from many markets, managed for you", "Balanced", 1.2, 0, 6),
  f("lyhyt-korko", "Lyhyt Korko A", "Short-term bonds, for money you may need soon", "Bonds", 0.3, 0, 2.5),
  f("euro-valtionlaina", "Euro Valtionlaina Korko A", "Euro-area government bonds", "Bonds", 0.5, 0, 2.5),
  f("yrityslaina", "Yrityslaina Korko A", "Investment-grade corporate bonds", "Bonds", 0.5, 0, 3),
  f("korkovarainhoito", "Korkovarainhoito A", "A mix of bond funds, managed for you", "Bonds", 0.7, 0, 3),
  f("high-yield-eurooppa", "High Yield Eurooppa Korko A", "Higher-risk European corporate bonds", "Bonds", 0.9, 0, 4.5),
  f("kehittyvat-markkinat-korko", "Kehittyvät Markkinat Korko A", "Emerging-market bonds", "Bonds", 0.9, 0, 4.5),
  f("asunto", "Asunto A", "Rental homes in Finland", "Special", 1.9, 2, 5),
  f("kiinteistovarainhoito", "Kiinteistövarainhoito A", "A mix of property funds", "Special", 2.2, 2, 5),
  f("toimitila", "Toimitila A", "Business premises", "Special", 1.43, 1.5, 5),
  f("tontti", "Tontti A", "Building plots leased out", "Special", 1.2, 1.5, 5),
  f("metsa", "Metsä A", "Finnish forests", "Special", 1.5, 2, 4.5),
];

export const fundById = (id: string) => FUNDS.find((f) => f.id === id) ?? FUNDS[0];

/** Future value of a monthly deposit after `years`, compounding monthly at `yearlyPct`. */
export function projectSavings(monthly: number, years: number, yearlyPct: number) {
  const n = years * 12;
  const r = yearlyPct / 100 / 12;
  const value = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
  return { deposited: monthly * n, value };
}

/** Projection for a fund: after its subscription fee and ongoing charges, plus what those fees cost in euros. */
export function projectFund(monthly: number, years: number, f: FundOption) {
  const invested = monthly * (1 - f.subscriptionFeePct / 100);
  const net = projectSavings(invested, years, f.illustrativeReturnPct - f.ongoingFeePct);
  const gross = projectSavings(monthly, years, f.illustrativeReturnPct);
  return { deposited: gross.deposited, value: net.value, fees: gross.value - net.value };
}
