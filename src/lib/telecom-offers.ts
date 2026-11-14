// Phone and internet offers and the comparison. Plans come from Solvo's market database
// (src/lib/market.ts), which the telecom market agent fills with real public prices and their sources.
// All prices are EUR per month incl. VAT, regular prices after any campaign. Switching is simulated.
import { SAVED_TELECOM_DB, type TelecomDb } from "./market";

export type TelecomOffer = {
  id: string;
  operator: string;
  product: string;
  perLine: number; // unlimited-data mobile line
  lineSpeed: string;
  lineSpeedMbps: number;
  homeInternet: number | null; // null = keep your current home internet
  homeSpeed: string | null;
  likeForLike: boolean; // same speeds as today
  kind: "switch" | "price_match";
  note?: string;
  sourceUrl: string | null;
  checkedAt: string | null;
};

export const TELECOM_OFFERS_UPDATED = SAVED_TELECOM_DB.ranAt.slice(0, 10);

export type TelecomTerms = {
  lines: number;
  perLine: number; // what you pay per line today
  homeInternet: number; // what you pay for home internet today, 0 if none
  lineSpeedMbps?: number; // today's mobile speed, 1000 if unknown
  homeSpeedMbps?: number; // today's home speed, 1000 if unknown
  currentOperator?: string;
};

/** Today's terms from an e-invoice reading. Speeds are read from the product name ("5G Rajaton 1000M"). */
export function telecomTermsFrom(r: {
  supplier: string;
  product: string;
  mobileLines: number | null;
  pricePerLine: number | null;
  homeInternetMonthly: number | null;
  monthlyCost: number;
}): TelecomTerms {
  const speeds = [...r.product.matchAll(/(\d{2,4})\s*M/g)].map((m) => Number(m[1]));
  return {
    lines: r.mobileLines ?? 1,
    perLine: r.pricePerLine ?? r.monthlyCost,
    homeInternet: r.homeInternetMonthly ?? 0,
    lineSpeedMbps: speeds[0] ?? 1000,
    homeSpeedMbps: speeds[1] ?? speeds[0] ?? 1000,
    currentOperator: r.supplier.replace(/\s+Oy$/, ""),
  };
}

type Priced = TelecomOffer & { monthly: number; yearly: number; saving: number };

export type TelecomComparison = {
  currentMonthly: number;
  current: number; // yearly
  offers: Priced[]; // cheapest first
  recommended: Priced;
};

const mbit = (n: number) => `5G ${n}M`;

export function compareTelecom(t: TelecomTerms, db: TelecomDb = SAVED_TELECOM_DB): TelecomComparison {
  const lineSpeed = t.lineSpeedMbps ?? 1000;
  const homeSpeed = t.homeSpeedMbps ?? 1000;
  const currentMonthly = t.lines * t.perLine + t.homeInternet;
  const current = currentMonthly * 12;
  const shortlist = new Set(db.segments.flatMap((s) => s.best));
  const plans = db.offers.filter((p) => shortlist.has(p.id));

  // Home internet: only suggest a new one if it's cheaper at the same speed. Fibre depends on the building.
  const home = plans
    .filter((p) => p.kind === "home" && p.speedMbps >= homeSpeed && t.homeInternet > 0 && p.monthlyPrice < t.homeInternet)
    .sort((a, b) => a.monthlyPrice - b.monthlyPrice)[0];

  const price = (o: TelecomOffer): Priced => {
    const monthly = t.lines * o.perLine + (o.homeInternet ?? t.homeInternet);
    return { ...o, monthly, yearly: monthly * 12, saving: current - monthly * 12 };
  };

  const switches = plans
    .filter((p) => p.kind === "mobile")
    .map((p) =>
      price({
        id: p.id,
        operator: p.operator,
        product: p.product,
        perLine: p.monthlyPrice,
        lineSpeed: mbit(p.speedMbps),
        lineSpeedMbps: p.speedMbps,
        homeInternet: home?.monthlyPrice ?? null,
        homeSpeed: home ? `${home.operator} fibre ${home.speedMbps}M` : null,
        likeForLike: p.speedMbps >= lineSpeed,
        kind: "switch",
        note:
          p.speedMbps < lineSpeed
            ? `Slower than your ${lineSpeed} Mbit/s today${p.speedMbps >= 300 ? ", still plenty for video calls and 4K streaming" : ""}`
            : p.conditions ?? undefined,
        sourceUrl: p.sourceUrl,
        checkedAt: p.checkedAt,
      }),
    );

  // Ask the current operator to match the cheapest like-for-like price, if there is a cheaper one.
  const bestSame = switches.filter((o) => o.likeForLike).sort((a, b) => a.perLine - b.perLine)[0];
  const match =
    bestSame && bestSame.perLine < t.perLine
      ? [
          price({
            id: "price-match",
            operator: t.currentOperator ?? "Your operator",
            product: "Ask your operator to lower the price",
            perLine: bestSame.perLine,
            lineSpeed: mbit(lineSpeed),
            lineSpeedMbps: lineSpeed,
            homeInternet: null,
            homeSpeed: null,
            likeForLike: true,
            kind: "price_match",
            note: `Solvo shows them ${bestSame.operator}'s price. Nothing changes if they say no`,
            sourceUrl: bestSame.sourceUrl,
            checkedAt: bestSame.checkedAt,
          }),
        ]
      : [];

  const all = [...switches, ...match].sort((a, b) => a.yearly - b.yearly);
  const saving = all.filter((o) => o.saving > 0);
  const offers = (saving.length ? saving : all).slice(0, 5);
  // The coach prefers keeping today's speeds; if that costs more, the cheapest plan that is still fast enough.
  const recommended =
    offers.find((o) => o.likeForLike && o.saving > 0) ??
    offers.find((o) => o.lineSpeedMbps >= 300 && o.saving > 0) ??
    offers[0];
  return { currentMonthly, current, offers, recommended };
}
