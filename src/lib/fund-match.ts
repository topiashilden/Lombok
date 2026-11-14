// Matches what a person says they want ("safe", "green", "for 5+ years") to S-Pankki's funds that fit, and states the
// standard facts about each. It is a screener, not an adviser:
//  - it never ranks, never says "best" and never says "buy this";
//  - risk is the standard 1-7 class from each fund's fact sheet, not our own opinion;
//  - the sustainability label is the EU's SFDR article, which describes what a fund discloses, not how green it is.
// Naming a specific product as right for a specific person is investment advice and needs a licence. S-Pankki has one, so in
// production this is S-Pankki's service. The funds and their facts are in spankki-funds.ts.
import { SPANKKI_FUNDS, type FundKind, type SpankkiFund } from "@/lib/spankki-funds";

export type CatalogFund = SpankkiFund & { what: string };

const KIND_LABEL: Record<FundKind, string> = {
  equity: "Equity fund.",
  bond: "Bond fund.",
  mixed: "Mixed fund, equities and bonds.",
};

export const CATALOG: CatalogFund[] = SPANKKI_FUNDS.map((f) => ({ ...f, what: KIND_LABEL[f.kind] }));

export type Safety = "very" | "balanced" | "growth";
export type Horizon = "soon" | "mid" | "long";

export type Prefs = { safety: Safety; green: boolean; horizon: Horizon };

export const SAFETY_LABEL: Record<Safety, { title: string; blurb: string }> = {
  very: { title: "As safe as possible", blurb: "Small swings, even if it grows slowly" },
  balanced: { title: "A balance", blurb: "Some swings for more growth" },
  growth: { title: "Growth", blurb: "Bigger swings are fine if I can wait" },
};

export const HORIZON_LABEL: Record<Horizon, { title: string; years: number }> = {
  soon: { title: "Under 3 years", years: 2 },
  mid: { title: "3 to 7 years", years: 5 },
  long: { title: "7 years or more", years: 10 },
};

// The highest risk class each choice accepts. S-Pankki's open funds run from 1 to 4.
const MAX_RISK: Record<Safety, number> = { very: 2, balanced: 3, growth: 6 };

/** A common rule of thumb: the higher the risk class, the longer the money should be able to stay put. */
export function minYearsFor(risk: number): number {
  if (risk <= 2) return 1;
  if (risk === 3) return 3;
  if (risk === 4) return 5;
  if (risk === 5) return 6;
  return 8;
}

export const RISK_WORDS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Medium-low",
  4: "Medium",
  5: "Medium-high",
  6: "High",
  7: "Very high",
};

export type Match = { fund: CatalogFund; minYears: number };

/** Funds that fit what was said, lowest risk first (a fixed order, not a ranking of quality). */
export function matchFunds(p: Prefs): { matches: Match[]; why: string[] } {
  const years = HORIZON_LABEL[p.horizon].years;
  const maxRisk = MAX_RISK[p.safety];
  const why: string[] = [];

  let pool = CATALOG;
  if (p.green) {
    pool = pool.filter((f) => f.sfdr !== "none");
    why.push("Only funds with an EU sustainability label (article 8 or 9).");
  }
  const byRisk = pool.filter((f) => f.risk <= maxRisk);
  if (byRisk.length < pool.length) why.push(`Risk class ${maxRisk} or lower, because you chose "${SAFETY_LABEL[p.safety].title.toLowerCase()}".`);
  const byHorizon = byRisk.filter((f) => minYearsFor(f.risk) <= years);
  if (byHorizon.length < byRisk.length) why.push(`Left out funds whose risk suggests keeping the money invested longer than ${HORIZON_LABEL[p.horizon].title.toLowerCase()}.`);

  const matches = byHorizon
    .map((fund) => ({ fund, minYears: minYearsFor(fund.risk) }))
    .sort((a, b) => a.fund.risk - b.fund.risk || a.fund.name.localeCompare(b.fund.name));
  return { matches, why };
}
