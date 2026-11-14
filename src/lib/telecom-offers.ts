// Phone and internet offers. Hand-maintained, FICTIONAL operators and prices, like the electricity table.
// All prices are EUR per month incl. VAT.

export type TelecomOffer = {
  id: string;
  operator: string;
  product: string;
  perLine: number; // unlimited-data mobile line
  lineSpeed: string;
  homeInternet: number | null; // null = keep your current home internet
  homeSpeed: string | null;
  likeForLike: boolean; // same speeds as today
  kind: "switch" | "price_match";
  note?: string;
};

export const TELECOM_OFFERS_UPDATED = "2026-09-30";

export const TELECOM_OFFERS: TelecomOffer[] = [
  {
    id: "vire-duo",
    operator: "Vire",
    product: "Duo 1000M",
    perLine: 26.9,
    lineSpeed: "5G 1000M",
    homeInternet: 34.9,
    homeSpeed: "Fibre 1000M",
    likeForLike: true,
    kind: "switch",
    note: "Same speeds, no fixed term",
  },
  {
    id: "lumo-600",
    operator: "Lumo Mobiili",
    product: "Rajaton 600M",
    perLine: 21.9,
    lineSpeed: "5G 600M",
    homeInternet: null,
    homeSpeed: null,
    likeForLike: false,
    kind: "switch",
    note: "Cheapest, but slower phone lines. Keeps your current home fibre",
  },
  {
    id: "kaista-match",
    operator: "Kaista",
    product: "Ask your operator to lower the price",
    perLine: 27.96,
    lineSpeed: "5G 1000M",
    homeInternet: null,
    homeSpeed: null,
    likeForLike: true,
    kind: "price_match",
    note: "Solvo sends a price-match request. Nothing changes if they say no",
  },
];

export type TelecomTerms = {
  lines: number;
  perLine: number; // what you pay per line today
  homeInternet: number; // what you pay for home internet today, 0 if none
};

export type TelecomComparison = {
  currentMonthly: number;
  current: number; // yearly
  offers: (TelecomOffer & { monthly: number; yearly: number; saving: number })[]; // cheapest first
  recommended: TelecomOffer & { monthly: number; yearly: number; saving: number };
};

export function compareTelecom(t: TelecomTerms): TelecomComparison {
  const currentMonthly = t.lines * t.perLine + t.homeInternet;
  const current = currentMonthly * 12;
  const offers = TELECOM_OFFERS.map((o) => {
    const monthly = t.lines * o.perLine + (o.homeInternet ?? t.homeInternet);
    return { ...o, monthly, yearly: monthly * 12, saving: current - monthly * 12 };
  }).sort((a, b) => a.yearly - b.yearly);
  // The coach recommends the cheapest offer that keeps today's speeds: no hidden downgrade.
  const recommended = offers.find((o) => o.likeForLike && o.kind === "switch") ?? offers[0];
  return { currentMonthly, current, offers, recommended };
}
