// Solvo's market database: offers found by the market agents, grouped by customer segment.
// The agents run on Solvo's side on a schedule (src/lib/market-agent.ts), not per customer.
// Per customer, Solvo only looks up their segment and computes the saving at their own consumption.
// Safe to import from client components (no server-only code here).
import electricityDb from "@/data/market/electricity.json";

export type MarketOffer = {
  id: string;
  supplier: string;
  product: string;
  pricing: "fixed" | "spot";
  centsPerKwh: number; // fixed: the energy price incl. VAT. spot: the supplier's margin incl. VAT
  monthlyFee: number; // EUR incl. VAT
  termMonths: number | null;
  conditions: string | null; // e.g. "new customers only", "first 3 months discounted"
  sourceUrl: string;
  sourceTitle: string;
  checkedAt: string; // YYYY-MM-DD
};

export type Segment = { id: string; label: string; annualKwh: number; best: string[] };

export type MarketDb = {
  agent: "electricity";
  ranAt: string; // ISO time of the run
  mode: "exa" | "seed"; // exa = found by the live agent, seed = first snapshot collected by hand from the same sources
  queries: string[];
  pagesRead: number;
  sources: { url: string; title: string }[];
  spotExpectedAvgCents: number; // expected yearly average spot price incl. VAT, before the margin
  offers: MarketOffer[];
  segments: Segment[];
};

export const SAVED_ELECTRICITY_DB = electricityDb as MarketDb;

export const SEGMENTS: Omit<Segment, "best">[] = [
  { id: "small", label: "Small flat, about 2,000 kWh", annualKwh: 2000 },
  { id: "family", label: "Family flat or row house, about 6,000 kWh", annualKwh: 6000 },
  { id: "heating", label: "House with electric heating, about 18,000 kWh", annualKwh: 18000 },
];

/** Yearly cost of an offer at a given consumption. Spot uses the expected average plus the margin. */
export function offerYearly(o: MarketOffer, kwh: number, spotAvg: number) {
  const cents = o.pricing === "spot" ? spotAvg + o.centsPerKwh : o.centsPerKwh;
  return (kwh * cents) / 100 + o.monthlyFee * 12;
}

/** The pre-computed shortlist per segment: the 4 cheapest fixed and 2 cheapest spot offers at that consumption. */
export function buildSegments(offers: MarketOffer[], spotAvg: number): Segment[] {
  const cheapest = (pricing: MarketOffer["pricing"], kwh: number, n: number) =>
    offers
      .filter((o) => o.pricing === pricing)
      .sort((a, b) => offerYearly(a, kwh, spotAvg) - offerYearly(b, kwh, spotAvg))
      .slice(0, n)
      .map((o) => o.id);
  return SEGMENTS.map((s) => ({ ...s, best: [...cheapest("fixed", s.annualKwh, 4), ...cheapest("spot", s.annualKwh, 2)] }));
}

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** The segment closest to the customer's consumption (on a log scale, so 6,500 kWh is "family"). */
export function segmentFor(db: MarketDb, kwh: number): Segment {
  const dist = (s: Segment) => Math.abs(Math.log(Math.max(kwh, 1)) - Math.log(s.annualKwh));
  return [...db.segments].sort((a, b) => dist(a) - dist(b))[0];
}

/** The customer's segment and its shortlist. This lookup is all that runs per customer. */
export function shortlistFor(db: MarketDb, kwh: number): { segment: Segment; offers: MarketOffer[] } {
  const segment = segmentFor(db, kwh);
  const ids = new Set(segment.best);
  return { segment, offers: db.offers.filter((o) => ids.has(o.id)) };
}

export const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
