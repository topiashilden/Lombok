// S-Pankki's own funds (A share class, open to every customer, minimum 10 €) for the monthly investment plan.
// Fees are from S-Pankki Rahastoyhtiö's fund price list, valid from 4 June 2026: ongoing charges ("juoksevat kulut",
// 2025) and the subscription fee. Redemption fee is 0 % for all of these.
// Returns are ILLUSTRATIVE assumptions per fund type, used only for the projection; they are not S-Pankki figures.
// Solvo doesn't recommend a fund (that would be investment advice): the user picks, and in production the plan
// would be set up in S-Pankki's own fund service.

export type FundType = "Equity" | "Balanced" | "Bonds";

export type FundOption = {
  id: string;
  name: string;
  description: string;
  type: FundType;
  ongoingFeePct: number;
  subscriptionFeePct: number;
  illustrativeReturnPct: number; // before fees; not a promise
};

export const FUNDS_SOURCE = "Fees: S-Pankki fund price list, valid from 4 June 2026 (A share class).";

export const FUNDS: FundOption[] = [
  {
    id: "passiivinen-usa-esg",
    name: "S-Pankki Passiivinen USA ESG Osake A",
    description: "Index fund, large US companies",
    type: "Equity",
    ongoingFeePct: 0.49,
    subscriptionFeePct: 0.1,
    illustrativeReturnPct: 6.5,
  },
  {
    id: "passiivinen-eurooppa-esg",
    name: "S-Pankki Passiivinen Eurooppa ESG Osake A",
    description: "Index fund, large European companies",
    type: "Equity",
    ongoingFeePct: 0.49,
    subscriptionFeePct: 0.25,
    illustrativeReturnPct: 6,
  },
  {
    id: "ilmastotavoite-maailma",
    name: "S-Pankki Ilmastotavoite Maailma Osake A",
    description: "Active fund, companies worldwide with a climate target",
    type: "Equity",
    ongoingFeePct: 1.8,
    subscriptionFeePct: 0,
    illustrativeReturnPct: 6.5,
  },
  {
    id: "varainhoito-50",
    name: "S-Pankki Varainhoito 50 A",
    description: "About half equities, half bonds, managed for you",
    type: "Balanced",
    ongoingFeePct: 1.05,
    subscriptionFeePct: 0,
    illustrativeReturnPct: 4.5,
  },
  {
    id: "korkovarainhoito",
    name: "S-Pankki Korkovarainhoito A",
    description: "Bonds, smaller swings",
    type: "Bonds",
    ongoingFeePct: 0.7,
    subscriptionFeePct: 0,
    illustrativeReturnPct: 3,
  },
  {
    id: "lyhyt-korko",
    name: "S-Pankki Lyhyt Korko A",
    description: "Short-term bonds, for money you may need soon",
    type: "Bonds",
    ongoingFeePct: 0.3,
    subscriptionFeePct: 0,
    illustrativeReturnPct: 2.5,
  },
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
