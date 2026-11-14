// Electricity offers and the comparison. Offers come from Solvo's market database
// (src/lib/market.ts), which the electricity market agent fills with real public prices and their sources.
// All prices include VAT. Switching itself is simulated in this demo.
import { SAVED_ELECTRICITY_DB, offerYearly, shortlistFor, type MarketDb, type Segment } from "./market";

export type ElectricityOffer = {
  id: string;
  supplier: string;
  product: string;
  pricing: "fixed" | "spot";
  centsPerKwh: number; // for spot: expected yearly average incl. margin
  marginCents: number | null; // spot only
  monthlyFee: number;
  termMonths: number | null;
  note?: string;
  renewable: boolean; // the source says the electricity is from wind, hydro or solar
  sourceUrl: string;
  checkedAt: string;
};

/** What the person says matters most. It decides the coach's pick; every option stays selectable. */
export type ElectricityPreference = "cheapest" | "fixed" | "renewable";

export const OFFERS_UPDATED = SAVED_ELECTRICITY_DB.ranAt.slice(0, 10);

export const annualCost = (kwh: number, centsPerKwh: number, monthlyFee: number) =>
  (kwh * centsPerKwh) / 100 + monthlyFee * 12;

export type ContractTerms = {
  annualKwh: number;
  centsPerKwh: number;
  monthlyFee: number;
  centsAfterEnd: number | null;
  monthlyFeeAfterEnd: number | null;
};

export type Comparison = {
  current: number; // yearly cost on today's price
  doNothing: number; // yearly cost after the automatic rollover (or current if none)
  offers: (ElectricityOffer & { yearly: number; saving: number })[]; // saving vs doNothing, best first
  recommended: ElectricityOffer & { yearly: number; saving: number };
  pickReason: string;
  segment: Segment;
};

export function compare(
  t: ContractTerms,
  db: MarketDb = SAVED_ELECTRICITY_DB,
  preference: ElectricityPreference = "fixed",
): Comparison {
  const current = annualCost(t.annualKwh, t.centsPerKwh, t.monthlyFee);
  const doNothing =
    t.centsAfterEnd != null ? annualCost(t.annualKwh, t.centsAfterEnd, t.monthlyFeeAfterEnd ?? t.monthlyFee) : current;
  const { segment, offers: shortlist } = shortlistFor(db, t.annualKwh);
  const offers = shortlist
    .map((o) => {
      const yearly = offerYearly(o, t.annualKwh, db.spotExpectedAvgCents);
      const spot = o.pricing === "spot";
      return {
        id: o.id,
        supplier: o.supplier,
        product: o.product,
        pricing: o.pricing,
        centsPerKwh: spot ? db.spotExpectedAvgCents + o.centsPerKwh : o.centsPerKwh,
        marginCents: spot ? o.centsPerKwh : null,
        monthlyFee: o.monthlyFee,
        termMonths: o.termMonths,
        note: o.conditions ?? (spot ? "Price changes every hour; cheaper on average, but winter spikes hit hard" : undefined),
        renewable: o.origin === "renewable",
        sourceUrl: o.sourceUrl,
        checkedAt: o.checkedAt,
        yearly,
        saving: doNothing - yearly,
      };
    })
    .sort((a, b) => a.yearly - b.yearly);
  // The coach's pick follows what the person says matters most. Default: the cheapest fixed price,
  // because predictable is better for a budget.
  const fixed = offers.find((o) => o.pricing === "fixed");
  const green = offers.find((o) => o.renewable);
  const [recommended, pickReason] =
    preference === "cheapest"
      ? [offers[0], "Coach's pick: the lowest expected cost"]
      : preference === "renewable" && green
        ? [green, "Coach's pick: the cheapest renewable electricity"]
        : [fixed ?? offers[0], "Coach's pick: a fixed price is easier to budget"];
  return { current, doNothing, offers, recommended, pickReason, segment };
}
