// Aino's fund holdings. DEMO DATA: the S-Pankki dataset has no fund holdings, and Aino has no fund deposits in its
// two years (Oct 2024 to Sept 2026). The story: she bought two S-Pankki funds in 2021 to 2023, then stopped.
// Solvo shows how they are doing and restarts monthly investing. Fund names are real S-Pankki funds; the values
// and monthly returns are synthetic, not the funds' real performance.

export type Holding = { fundId: string; invested: number; since: string; monthlyReturnsPct: number[] };

// End-of-month values, Oct 2024 to Sept 2026 (24 months).
export const PORTFOLIO_MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 9 + i, 1));
  return d.toISOString().slice(0, 7);
});

const EQUITY = [-1.0, 4.5, -0.8, 2.6, -1.7, -6.0, -4.2, 5.8, 3.9, 2.4, 1.8, 0.9, 2.1, 1.2, -0.6, 1.9, -2.4, 3.1, 0.8, 2.2, 1.5, -1.1, 2.0, 1.4];
const BALANCED = EQUITY.map((r) => Math.round((r * 0.5 + 0.2) * 100) / 100);

export const HOLDINGS: (Holding & { startValue: number })[] = [
  { fundId: "passiivinen-usa-esg", invested: 2400, since: "2021", startValue: 2950, monthlyReturnsPct: EQUITY },
  { fundId: "varainhoito-50", invested: 1800, since: "2022", startValue: 1880, monthlyReturnsPct: BALANCED },
];

/** Value of each holding at the end of every month in PORTFOLIO_MONTHS. */
export function holdingSeries(h: (typeof HOLDINGS)[number]) {
  let v = h.startValue;
  return h.monthlyReturnsPct.map((r) => (v = v * (1 + r / 100)));
}

export function portfolio() {
  const series = HOLDINGS.map(holdingSeries);
  const total = PORTFOLIO_MONTHS.map((_, i) => series.reduce((sum, s) => sum + s[i], 0));
  const invested = HOLDINGS.reduce((sum, h) => sum + h.invested, 0);
  const value = total[total.length - 1];
  const yearAgo = total[total.length - 13];
  return {
    invested,
    value,
    gain: value - invested,
    gainPct: ((value - invested) / invested) * 100,
    yearChangePct: ((value - yearAgo) / yearAgo) * 100,
    total,
    holdings: HOLDINGS.map((h, i) => {
      const s = series[i];
      const v = s[s.length - 1];
      return { ...h, value: v, gain: v - h.invested, yearChangePct: ((v - s[s.length - 13]) / s[s.length - 13]) * 100 };
    }),
  };
}
