// Fund types for the monthly savings plan. ILLUSTRATIVE: not real S-Pankki products, fees or returns.
// Solvo doesn't recommend a fund (that would be investment advice); the user picks, and in production
// the plan would be set up in S-Pankki's own fund service.

export type FundOption = {
  id: string;
  name: string;
  description: string;
  risk: number; // 1 (low) to 7 (high), like the SRI scale on fund fact sheets
  yearlyFeePct: number;
  illustrativeReturnPct: number; // used only for the projection, not a promise
};

export const FUNDS: FundOption[] = [
  {
    id: "global-index",
    name: "Global equity index fund",
    description: "Thousands of companies worldwide, low fee",
    risk: 4,
    yearlyFeePct: 0.25,
    illustrativeReturnPct: 6,
  },
  {
    id: "balanced",
    name: "Balanced fund",
    description: "About half equities, half bonds",
    risk: 3,
    yearlyFeePct: 0.9,
    illustrativeReturnPct: 4,
  },
  {
    id: "short-bond",
    name: "Short-term bond fund",
    description: "Low swings, for money you may need soon",
    risk: 2,
    yearlyFeePct: 0.3,
    illustrativeReturnPct: 2.5,
  },
];

/** Future value of a monthly deposit after `years`, compounding monthly at `yearlyPct` (net of fees). */
export function projectSavings(monthly: number, years: number, yearlyPct: number) {
  const n = years * 12;
  const r = yearlyPct / 100 / 12;
  const value = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
  return { deposited: monthly * n, value };
}
