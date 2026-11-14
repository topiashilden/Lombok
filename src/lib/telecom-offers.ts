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
  climate: string | null; // the operator's stated climate claim, if any
  sustainable: boolean;
  sourceUrl: string | null;
  checkedAt: string | null;
};

/**
 * What operators say about their own climate impact, as found by the market agent's sustainability search
 * (checked 14 Nov 2026). Only stated claims; an operator with no claim found counts as not stated.
 */
export const OPERATOR_CLIMATE: Record<string, { claim: string; sourceUrl: string; sustainable: boolean }> = {
  Elisa: { claim: "Carbon-neutral operations", sourceUrl: "https://elisa.fi/yhtiotieto/vastuullisuus/energiatehokkuus/", sustainable: true },
  Telia: {
    claim: "Carbon-neutral own operations since 2020, net zero target 2040",
    sourceUrl: "https://www.telia.fi/telia-yrityksena/medialle/artikkeli/telialle-karkipaikka-ymparistoselvityksessa-newsroom",
    sustainable: true,
  },
  DNA: {
    claim: "Aims to be carbon neutral by 2030",
    sourceUrl: "https://corporate.dna.fi/corporate-responsibility/climate-friendly-operations/climate-friendly-operations",
    sustainable: false,
  },
};

/** What the person wants. It decides the coach's pick; every option stays selectable. */
export type SpeedWish = "slower" | "same" | "faster";
export type TelecomPreference = { speed: SpeedWish; priority: "price" | "sustainable" };
export const DEFAULT_TELECOM_PREFERENCE: TelecomPreference = { speed: "same", priority: "price" };

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
  pickReason: string;
};

const mbit = (n: number) => `5G ${n}M`;

export function compareTelecom(
  t: TelecomTerms,
  db: TelecomDb = SAVED_TELECOM_DB,
  preference: TelecomPreference = DEFAULT_TELECOM_PREFERENCE,
): TelecomComparison {
  const lineSpeed = t.lineSpeedMbps ?? 1000;
  const homeSpeed = t.homeSpeedMbps ?? 1000;
  const currentMonthly = t.lines * t.perLine + t.homeInternet;
  const current = currentMonthly * 12;
  const shortlist = new Set(db.segments.flatMap((s) => s.best));
  // The segment shortlists, plus every plan from an operator with a climate claim, so a sustainable
  // choice exists at each speed.
  const plans = db.offers.filter((p) => shortlist.has(p.id) || OPERATOR_CLIMATE[p.operator]?.sustainable);

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
        climate: OPERATOR_CLIMATE[p.operator]?.claim ?? null,
        sustainable: OPERATOR_CLIMATE[p.operator]?.sustainable ?? false,
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
            climate: null,
            sustainable: false,
            note: `Solvo shows them ${bestSame.operator}'s price. Nothing changes if they say no`,
            sourceUrl: bestSame.sourceUrl,
            checkedAt: bestSame.checkedAt,
          }),
        ]
      : [];

  const all = [...switches, ...match].sort((a, b) => a.yearly - b.yearly);
  const saving = all.filter((o) => o.saving > 0);
  const green = preference.priority === "sustainable";

  // Plans that fit the speed the person asked for. "A bit slower" stays fast enough for video calls
  // and 4K streaming (300 Mbit/s or half of today's speed, whichever is lower).
  const fits = (o: Priced, speed: SpeedWish) =>
    speed === "slower"
      ? o.lineSpeedMbps < lineSpeed && o.lineSpeedMbps >= Math.min(300, lineSpeed / 2)
      : speed === "same"
        ? o.likeForLike && o.lineSpeedMbps <= Math.max(lineSpeed, 1000)
        : o.lineSpeedMbps > lineSpeed;
  const pickFrom = (speed: SpeedWish) => all.filter((o) => fits(o, speed) && (!green || o.sustainable))[0];

  let speed = preference.speed;
  let recommended = pickFrom(speed);
  let fallback = "";
  if (!recommended && speed === "faster") {
    speed = "same";
    recommended = pickFrom(speed);
    fallback = `nothing faster than your ${lineSpeed} Mbit/s is on sale, so this keeps your speed`;
  }
  if (!recommended && green) {
    // No sustainable plan at that speed: the one closest to it.
    const gap = (o: Priced) => Math.abs(Math.log(o.lineSpeedMbps / lineSpeed));
    recommended = all.filter((o) => o.sustainable).sort((a, b) => gap(a) - gap(b) || a.yearly - b.yearly)[0];
    fallback = "the closest speed from an operator with carbon-neutral operations";
  }
  recommended ??= saving[0] ?? all[0];

  const what =
    fallback ||
    (speed === "slower"
      ? "a bit slower, still plenty for video calls and 4K streaming"
      : speed === "faster"
        ? "faster than today"
        : recommended.kind === "price_match"
          ? "same speed, just ask for the lower price"
          : "same speed");
  const pickReason = `Coach's pick: ${what}${green && !fallback.includes("carbon") ? ", from an operator with carbon-neutral operations" : ""}${
    recommended.saving < 0 ? ". It costs more than today" : ""
  }`;

  // The cheapest options with a saving, plus the pick and the cheapest plan for each speed choice, so the
  // person can compare them. A plan that costs more than today is shown only when it answers a choice.
  const offers = (saving.length ? saving : all).slice(0, 5);
  for (const o of [recommended, pickFrom("slower"), pickFrom("same"), pickFrom("faster")])
    if (o && !offers.some((x) => x.id === o.id)) offers.push(o);
  offers.sort((a, b) => a.yearly - b.yearly);
  return { currentMonthly, current, offers, recommended, pickReason };
}
