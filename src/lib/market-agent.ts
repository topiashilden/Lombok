import "server-only";
import type { AgentEvent } from "./market-agent-events";
import { SAVED_ELECTRICITY_DB, buildSegments, slug, type MarketDb, type MarketOffer } from "./market";

// The electricity market agent. Runs on Solvo's side (nightly in production, "Run now" in the demo),
// never per customer:
//   1. search  - Exa finds pages with current Finnish consumer electricity prices
//   2. read    - Gemini reads those pages into a fixed offer format, with the source page of each offer
//   3. check   - plausibility rules drop anything that doesn't look like a real consumer price
//   4. segment - offers are ranked per customer segment and stored in the market database
// If a key is missing or any step fails, the caller gets the saved database instead, so the demo never breaks.

export type { AgentEvent, AgentStep } from "./market-agent-events";

const QUERIES = [
  "määräaikainen sähkösopimus hinta snt/kWh perusmaksu kuluttaja",
  "pörssisähkö marginaali snt/kWh perusmaksu €/kk sähköyhtiö",
  "halvin sähkösopimus vertailu hinnat",
];
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
const PAGE_CHARS = 6000;

type ExaResult = { url: string; title?: string; publishedDate?: string; text?: string };

async function exaSearch(query: string, key: string): Promise<ExaResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 5,
      userLocation: "FI",
      startPublishedDate: new Date(Date.now() - 120 * 864e5).toISOString(),
      contents: { text: { maxCharacters: PAGE_CHARS }, livecrawl: "preferred" },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? []).filter((r) => r.text && r.text.length > 200);
}

const OFFER_SCHEMA = {
  type: "OBJECT",
  properties: {
    offers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          supplier: { type: "STRING" },
          product: { type: "STRING" },
          pricing: { type: "STRING", enum: ["fixed", "spot"] },
          centsPerKwh: { type: "NUMBER" },
          monthlyFee: { type: "NUMBER" },
          termMonths: { type: "NUMBER", nullable: true },
          conditions: { type: "STRING", nullable: true },
          sourceIndex: { type: "NUMBER" },
        },
        required: ["supplier", "product", "pricing", "centsPerKwh", "monthlyFee", "termMonths", "conditions", "sourceIndex"],
      },
    },
  },
  required: ["offers"],
};

const READ_PROMPT = `You collect Finnish consumer electricity offers for a price database. Below are web pages, each with an index.
Extract every concrete consumer electricity offer you can see, one per supplier product:
- pricing "fixed" for a fixed-term or fixed-price contract (määräaikainen, kiinteä hinta); "spot" for exchange price (pörssisähkö).
- centsPerKwh: for fixed, the energy price in euro cents per kWh INCLUDING VAT (alv 25.5%); for spot, only the supplier's margin (marginaali) in c/kWh incl. VAT.
- monthlyFee: the base fee (perusmaksu) in EUR per month incl. VAT.
- termMonths: the fixed term in months, null for spot or open-ended.
- conditions: short English note on limits such as "new customers only", "introductory price for 3 months", "only in the Helsinki area", or null.
- sourceIndex: the index of the page where you saw the offer.
Only include offers with an explicit price on the page. Never guess or average. Skip business (yritys) offers.`;

async function geminiRead(pages: ExaResult[], key: string) {
  const text = pages.map((p, i) => `=== PAGE ${i}: ${p.title ?? ""} (${p.url})\n${p.text}`).join("\n\n");
  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${READ_PROMPT}\n\n${text}` }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: OFFER_SCHEMA, temperature: 0, thinkingConfig: { thinkingLevel: "low" } },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}`), { status: res.status });
      const data = await res.json();
      const out: string | undefined = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
      if (!out) throw new Error("Gemini returned no text");
      return { model, offers: (JSON.parse(out) as { offers: (Omit<MarketOffer, "id" | "sourceUrl" | "sourceTitle" | "checkedAt"> & { sourceIndex: number })[] }).offers };
    } catch (e) {
      lastError = e;
      const status = (e as { status?: number }).status;
      if (status !== 429 && status !== 503) break;
    }
  }
  throw lastError;
}

/** Plausible consumer prices only. Anything outside these ranges is a misread, not a deal. */
function plausible(o: { pricing: string; centsPerKwh: number; monthlyFee: number }) {
  const cents = o.pricing === "spot" ? o.centsPerKwh >= 0 && o.centsPerKwh <= 3 : o.centsPerKwh >= 4 && o.centsPerKwh <= 30;
  return cents && o.monthlyFee >= 0 && o.monthlyFee <= 15;
}


export async function* runElectricityAgent(): AsyncGenerator<AgentEvent> {
  const exaKey = process.env.EXA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const saved = SAVED_ELECTRICITY_DB;
  const fallback = (error: string): AgentEvent => ({ type: "result", db: saved, live: false, error });

  yield { type: "step", step: "search", status: "running", detail: `Searching the web: ${QUERIES.length} searches` };
  if (!exaKey || !geminiKey) {
    yield { type: "step", step: "search", status: "failed", detail: "Live search is off, using the last saved run" };
    yield fallback(!exaKey ? "EXA_API_KEY not set" : "GEMINI_API_KEY not set");
    return;
  }

  let pages: ExaResult[];
  try {
    const all = (await Promise.all(QUERIES.map((q) => exaSearch(q, exaKey)))).flat();
    pages = [...new Map(all.map((p) => [p.url, p])).values()].slice(0, 10);
    if (!pages.length) throw new Error("no pages found");
  } catch (e) {
    yield { type: "step", step: "search", status: "failed", detail: "Search failed, using the last saved run" };
    yield fallback(String(e));
    return;
  }
  yield { type: "step", step: "search", status: "done", detail: `Found ${pages.length} pages with prices` };

  yield { type: "step", step: "read", status: "running", detail: `Reading ${pages.length} pages with Gemini` };
  let raw: Awaited<ReturnType<typeof geminiRead>>;
  try {
    raw = await geminiRead(pages, geminiKey);
  } catch (e) {
    yield { type: "step", step: "read", status: "failed", detail: "AI reading failed, using the last saved run" };
    yield fallback(String(e));
    return;
  }
  yield { type: "step", step: "read", status: "done", detail: `Pulled out ${raw.offers.length} offers` };

  yield { type: "step", step: "check", status: "running", detail: "Checking prices and removing duplicates" };
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map<string, MarketOffer>();
  for (const o of raw.offers) {
    const page = pages[o.sourceIndex];
    if (!page || !plausible(o)) continue;
    const id = slug(`${o.supplier}-${o.product}`);
    if (byId.has(id)) continue; // the first page that lists an offer is its source
    byId.set(id, {
      id,
      supplier: o.supplier,
      product: o.product,
      pricing: o.pricing,
      centsPerKwh: Math.round(o.centsPerKwh * 100) / 100,
      monthlyFee: Math.round(o.monthlyFee * 100) / 100,
      termMonths: o.pricing === "spot" ? null : o.termMonths,
      conditions: o.conditions,
      sourceUrl: page.url,
      sourceTitle: page.title ?? page.url,
      checkedAt: today,
    });
  }
  const offers = [...byId.values()];
  const dropped = raw.offers.length - offers.length;
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
    queries: QUERIES,
    pagesRead: pages.length,
    sources: pages.map((p) => ({ url: p.url, title: p.title ?? p.url })),
    spotExpectedAvgCents: saved.spotExpectedAvgCents,
    offers,
    segments: buildSegments(offers, saved.spotExpectedAvgCents),
  };
  yield { type: "step", step: "segment", status: "done", detail: `Best offers ready for ${db.segments.length} customer groups` };
  yield { type: "result", db, live: true };
}
