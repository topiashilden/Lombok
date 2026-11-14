import "server-only";
import type { AgentEvent } from "./market-agent-events";
import { exaKey, exaStructured, uniqueSources } from "./exa";
import { SAVED_ELECTRICITY_DB, buildSegments, slug, type MarketDb, type MarketOffer } from "./market";

// The electricity market agent. Runs on Solvo's side (nightly in production, "Run now" in the demo),
// never per customer:
//   1. search  - Exa searches the Finnish market, once for fixed-price and once for spot offers
//   2. read    - Exa's structured output pulls each offer from the pages, with a citation per field
//   3. check   - plausibility rules and Exa's grounding confidence drop anything that isn't a clear consumer price
//   4. segment - offers are ranked per customer segment and stored in the market database
// If the key is missing or any step fails, the caller gets the saved database instead, so the demo never breaks.
// Exa request shape follows Exa's build-with-exa skill: query + objective + systemPrompt + outputSchema + highlights.

export type { AgentEvent, AgentStep } from "./market-agent-events";

type Pricing = MarketOffer["pricing"];

const SEARCHES: Record<Pricing, { query: string; objective: string }> = {
  fixed: {
    query: "määräaikainen sähkösopimus hinta snt/kWh perusmaksu",
    objective:
      "Build a price list of current Finnish consumer fixed-term electricity contracts. Comparison tables and supplier price lists covering several suppliers rank first. Pull supplier, product, energy price in c/kWh incl. VAT, monthly base fee in EUR incl. VAT, and the fixed term in months.",
  },
  spot: {
    query: "pörssisähkö marginaali snt/kWh perusmaksu sähköyhtiöt vertailu",
    objective:
      "Build a price list of current Finnish consumer spot-price (pörssisähkö) electricity contracts. Comparison tables and supplier price lists covering several suppliers rank first. Pull supplier, product, the supplier's margin in c/kWh incl. VAT, and the monthly base fee in EUR incl. VAT.",
  },
};

const SYSTEM_PROMPT =
  "Include only consumer (household) offers with an explicit price on the page; skip business (yritys) offers. " +
  "For spot contracts, centsPerKwh is only the supplier's margin, not the total price. " +
  "If a price is an introductory price for the first months, report the regular price that applies after it and mention the introductory offer in conditions. " +
  "conditions is a short English note on limits stated on the page for that offer, such as new customers only, an introductory discount, or a region limit. Omit the field when the page states none; never write that there are none or that terms may vary. " +
  "product is the product name without the supplier name. " +
  "Never guess or average a price; omit an offer whose price you cannot verify on the page.";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    offers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          supplier: { type: "string" },
          product: { type: "string" },
          centsPerKwh: { type: "number" },
          monthlyFee: { type: "number" },
          termMonths: { type: "number" },
          conditions: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["supplier", "product", "centsPerKwh", "monthlyFee", "sourceUrl"],
      },
    },
  },
  required: ["offers"],
};

type RawOffer = { supplier: string; product: string; centsPerKwh: number; monthlyFee: number; termMonths?: number; conditions?: string; sourceUrl: string };

async function exaSearch(pricing: Pricing) {
  const { results, items } = await exaStructured<RawOffer>({
    ...SEARCHES[pricing],
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: OUTPUT_SCHEMA,
    arrayKey: "offers",
    priceFields: ["centsPerKwh", "monthlyFee"],
  });
  return { results, offers: items.map((o) => ({ ...o, pricing })) };
}

/** Plausible consumer prices only. Anything outside these ranges is a misread, not a deal. */
function plausible(o: { pricing: Pricing; centsPerKwh: number; monthlyFee: number }) {
  const cents = o.pricing === "spot" ? o.centsPerKwh >= 0 && o.centsPerKwh <= 3 : o.centsPerKwh >= 4 && o.centsPerKwh <= 30;
  return cents && o.monthlyFee >= 0 && o.monthlyFee <= 15;
}

export async function* runElectricityAgent(): AsyncGenerator<AgentEvent> {
  const key = exaKey();
  const saved = SAVED_ELECTRICITY_DB;
  const fallback = (error: string): AgentEvent => ({ type: "result", db: saved, live: false, error });

  yield { type: "step", step: "search", status: "running", detail: "Searching Finnish electricity prices with Exa" };
  if (!key) {
    yield { type: "step", step: "search", status: "failed", detail: "Live search is off, using the last saved run" };
    yield fallback("EXA_API_KEY not set");
    return;
  }

  let found: Awaited<ReturnType<typeof exaSearch>>[];
  try {
    found = await Promise.all((["fixed", "spot"] as const).map((p) => exaSearch(p)));
  } catch (e) {
    yield { type: "step", step: "search", status: "failed", detail: "Search failed, using the last saved run" };
    yield fallback(String(e));
    return;
  }
  const sources = uniqueSources(found.map((f) => f.results));
  yield { type: "step", step: "search", status: "done", detail: `Found ${sources.length} pages with prices` };

  const raw = found.flatMap((f) => f.offers);
  yield { type: "step", step: "read", status: "running", detail: "Reading offers from the pages" };
  yield { type: "step", step: "read", status: "done", detail: `Pulled out ${raw.length} offers, each with its source` };

  yield { type: "step", step: "check", status: "running", detail: "Checking prices and removing duplicates" };
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map<string, MarketOffer>();
  for (const o of raw) {
    if (o.lowConfidence || !plausible(o) || !/^https?:\/\//.test(o.sourceUrl)) continue;
    const product = o.product.replace(new RegExp(`^${o.supplier.split(" ")[0]}\\s+`, "i"), "") || o.product;
    const id = slug(`${o.supplier}-${product}`);
    if (byId.has(id)) continue; // the first page that lists an offer is its source
    byId.set(id, {
      id,
      supplier: o.supplier,
      product,
      pricing: o.pricing,
      centsPerKwh: Math.round(o.centsPerKwh * 100) / 100,
      monthlyFee: Math.round(o.monthlyFee * 100) / 100,
      termMonths: o.pricing === "spot" ? null : (o.termMonths ?? null),
      conditions: o.conditions && !/^(none|no (specific )?conditions|standard contract)/i.test(o.conditions) ? o.conditions : null,
      sourceUrl: o.sourceUrl,
      sourceTitle: sources.find((s) => s.url === o.sourceUrl)?.title ?? o.sourceUrl,
      checkedAt: today,
    });
  }
  const offers = [...byId.values()];
  const dropped = raw.length - offers.length;
  if (offers.filter((o) => o.pricing === "fixed").length < 2) {
    yield { type: "step", step: "check", status: "failed", detail: "Too few reliable prices, keeping the last saved run" };
    yield fallback("fewer than 2 fixed offers passed the checks");
    return;
  }
  const suppliers = new Set(offers.map((o) => o.supplier)).size;
  yield { type: "step", step: "check", status: "done", detail: `${offers.length} offers from ${suppliers} suppliers passed${dropped ? `, ${dropped} dropped` : ""}` };

  yield { type: "step", step: "segment", status: "running", detail: "Ranking offers for each customer group" };
  const db: MarketDb = {
    agent: "electricity",
    ranAt: new Date().toISOString(),
    mode: "exa",
    queries: Object.values(SEARCHES).map((s) => s.query),
    pagesRead: sources.length,
    sources: sources.filter((s) => offers.some((o) => o.sourceUrl === s.url)),
    spotExpectedAvgCents: saved.spotExpectedAvgCents,
    offers,
    segments: buildSegments(offers, saved.spotExpectedAvgCents),
  };
  yield { type: "step", step: "segment", status: "done", detail: `Best offers ready for ${db.segments.length} customer groups` };
  yield { type: "result", db, live: true };
}
