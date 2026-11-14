import "server-only";
import { exaKey, exaStructured, uniqueSources } from "./exa";
import type { AgentEvent } from "./market-agent-events";
import { SAVED_TELECOM_DB, buildTelecomSegments, slug, type TelecomDb, type TelecomPlan } from "./market";

// The phone and internet market agent. Same four steps as the electricity agent (src/lib/market-agent.ts):
// Exa searches unlimited mobile plans and home broadband, pulls each plan with its source page,
// the agent drops implausible or low-confidence prices, then ranks the plans per speed tier.

type Kind = TelecomPlan["kind"];

const SEARCHES: Record<Kind, { query: string; objective: string }> = {
  mobile: {
    query: "rajaton 5G liittymä hinta €/kk Elisa Telia DNA Moi",
    objective:
      "Build a price list of current Finnish consumer unlimited-data mobile subscriptions. Operator price lists and comparison tables rank first. Pull operator, plan name, regular monthly price in EUR and max download speed in Mbit/s.",
  },
  home: {
    query: "kuitu kotinetti 1000M hinta €/kk",
    objective:
      "Build a price list of current Finnish consumer home broadband (fibre, cable or 5G home internet) subscriptions. Operator price lists and comparison tables rank first. Pull operator, plan name, regular monthly price in EUR and download speed in Mbit/s.",
  },
};

const SYSTEM_PROMPT =
  "Include only consumer plans with an explicit monthly price on the page; skip business plans. " +
  "If the price shown is a campaign price for the first months, report the regular monthly price after the campaign and describe the campaign in conditions, in English. " +
  "conditions also notes fixed terms or area limits stated on the page; omit it when the page states none. " +
  "product is the plan name without the operator name. Never guess a price.";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    plans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          operator: { type: "string" },
          product: { type: "string" },
          monthlyPrice: { type: "number" },
          speedMbps: { type: "number" },
          conditions: { type: "string" },
          sourceUrl: { type: "string" },
        },
        required: ["operator", "product", "monthlyPrice", "speedMbps", "sourceUrl"],
      },
    },
  },
  required: ["plans"],
};

type RawPlan = { operator: string; product: string; monthlyPrice: number; speedMbps: number; conditions?: string; sourceUrl: string };

const plausible = (p: RawPlan) => p.monthlyPrice >= 5 && p.monthlyPrice <= 120 && p.speedMbps >= 10 && p.speedMbps <= 10_000;

export async function* runTelecomAgent(): AsyncGenerator<AgentEvent> {
  const saved = SAVED_TELECOM_DB;
  const fallback = (error: string): AgentEvent => ({ type: "result", db: saved, live: false, error });

  yield { type: "step", step: "search", status: "running", detail: "Searching Finnish mobile and broadband prices with Exa" };
  if (!exaKey()) {
    yield { type: "step", step: "search", status: "failed", detail: "Live search is off, using the last saved run" };
    yield fallback("EXA_API_KEY not set");
    return;
  }

  let found: { kind: Kind; results: { url: string; title: string }[]; items: (RawPlan & { lowConfidence: boolean })[] }[];
  try {
    found = await Promise.all(
      (["mobile", "home"] as const).map(async (kind) => ({
        kind,
        ...(await exaStructured<RawPlan>({
          ...SEARCHES[kind],
          systemPrompt: SYSTEM_PROMPT,
          outputSchema: OUTPUT_SCHEMA,
          arrayKey: "plans",
          priceFields: ["monthlyPrice", "speedMbps"],
        })),
      })),
    );
  } catch (e) {
    yield { type: "step", step: "search", status: "failed", detail: "Search failed, using the last saved run" };
    yield fallback(String(e));
    return;
  }
  const sources = uniqueSources(found.map((f) => f.results));
  yield { type: "step", step: "search", status: "done", detail: `Found ${sources.length} pages with prices` };

  const raw = found.flatMap((f) => f.items.map((p) => ({ ...p, kind: f.kind })));
  yield { type: "step", step: "read", status: "running", detail: "Reading plans from the pages" };
  yield { type: "step", step: "read", status: "done", detail: `Pulled out ${raw.length} plans, each with its source` };

  yield { type: "step", step: "check", status: "running", detail: "Checking prices and removing duplicates" };
  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map<string, TelecomPlan>();
  for (const p of raw) {
    if (p.lowConfidence || !plausible(p) || !/^https?:\/\//.test(p.sourceUrl)) continue;
    const product = p.product.replace(new RegExp(`^${p.operator.split(" ")[0]}\\s+`, "i"), "") || p.product;
    // One id per plan, however the page writes the speed ("200M", "200 Mbit", "200 Mbit/s").
    const id = slug(`${p.operator}-${product.replace(/(\d+)\s*(Mbit\/s|Mbit|Mbps|M)\b/gi, "$1m")}`);
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      operator: p.operator.replace(/\s+(Oy|Oyj|Ab)$/i, ""),
      product,
      kind: p.kind,
      monthlyPrice: Math.round(p.monthlyPrice * 100) / 100,
      speedMbps: Math.round(p.speedMbps),
      conditions: p.conditions && !/^(none|standard (contract|offer|price))/i.test(p.conditions) ? p.conditions : null,
      sourceUrl: p.sourceUrl,
      sourceTitle: sources.find((s) => s.url === p.sourceUrl)?.title ?? p.sourceUrl,
      checkedAt: today,
    });
  }
  const offers = [...byId.values()];
  if (offers.filter((p) => p.kind === "mobile").length < 3) {
    yield { type: "step", step: "check", status: "failed", detail: "Too few reliable prices, keeping the last saved run" };
    yield fallback("fewer than 3 mobile plans passed the checks");
    return;
  }
  const operators = new Set(offers.map((p) => p.operator)).size;
  yield { type: "step", step: "check", status: "done", detail: `${offers.length} plans from ${operators} operators passed` };

  // The database keeps what earlier runs found: offers seen today replace their old entry,
  // offers not seen today stay with their older check date. One weak search can't empty the market.
  const fresh = new Set(offers.map((x) => x.id));
  const merged = [...offers, ...saved.offers.filter((x) => !fresh.has(x.id))];

  yield { type: "step", step: "segment", status: "running", detail: "Ranking plans for each speed tier" };
  const db: TelecomDb = {
    agent: "telecom",
    ranAt: new Date().toISOString(),
    mode: "exa",
    queries: Object.values(SEARCHES).map((s) => s.query),
    pagesRead: sources.length,
    sources: uniqueSources([sources, saved.sources]).filter((s) => merged.some((x) => x.sourceUrl === s.url)),
    offers: merged,
    segments: buildTelecomSegments(merged),
  };
  yield { type: "step", step: "segment", status: "done", detail: `${merged.length} plans in the database, best ones ready for ${db.segments.length} speed tiers` };
  yield { type: "result", db, live: true };
}
