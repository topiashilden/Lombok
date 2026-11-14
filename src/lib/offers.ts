// Electricity offers. Hand-maintained, FICTIONAL providers and prices (there is no open price API in Finland).
// To be replaced by live offers (Exa or Context.dev) later. All prices include VAT.

export type ElectricityOffer = {
  id: string;
  supplier: string;
  product: string;
  pricing: "fixed" | "spot";
  centsPerKwh: number; // for spot: expected yearly average incl. margin
  monthlyFee: number;
  termMonths: number | null;
  note?: string;
};

export const OFFERS_UPDATED = "2026-09-30";
export const SPOT_EXPECTED_AVG_CENTS = 7.5; // demo assumption for the year ahead, incl. VAT

export const ELECTRICITY_OFFERS: ElectricityOffer[] = [
  { id: "pohjoisvirta-12", supplier: "Pohjoisvirta", product: "Vakaa 12 kk", pricing: "fixed", centsPerKwh: 10.49, monthlyFee: 4.49, termMonths: 12 },
  { id: "tuulisahko-24", supplier: "Tuulisähkö", product: "Tuuli 24 kk", pricing: "fixed", centsPerKwh: 10.99, monthlyFee: 2.99, termMonths: 24, note: "100% wind power" },
  { id: "kotivalo-spot", supplier: "Kotivalo", product: "Pörssi", pricing: "spot", centsPerKwh: SPOT_EXPECTED_AVG_CENTS + 0.59, monthlyFee: 3.99, termMonths: null, note: "Price changes every hour; cheaper on average, but winter spikes hit hard" },
];

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
};

export function compare(t: ContractTerms): Comparison {
  const current = annualCost(t.annualKwh, t.centsPerKwh, t.monthlyFee);
  const doNothing =
    t.centsAfterEnd != null ? annualCost(t.annualKwh, t.centsAfterEnd, t.monthlyFeeAfterEnd ?? t.monthlyFee) : current;
  const offers = ELECTRICITY_OFFERS.map((o) => {
    const yearly = annualCost(t.annualKwh, o.centsPerKwh, o.monthlyFee);
    return { ...o, yearly, saving: doNothing - yearly };
  }).sort((a, b) => a.yearly - b.yearly);
  // The coach recommends the cheapest fixed price: predictable is better for a budget.
  const recommended = offers.find((o) => o.pricing === "fixed") ?? offers[0];
  return { current, doNothing, offers, recommended };
}
