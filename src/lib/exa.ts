import "server-only";

// One Exa /search call with structured output, shared by Solvo's market agents.
// Request shape follows Exa's build-with-exa skill: query + objective + systemPrompt + outputSchema + highlights.
// Items whose price citation Exa rates as low confidence are flagged, so the agent can drop them.

type Grounding = { field: string; confidence?: "low" | "medium" | "high" };
type ExaResponse = {
  results?: { url: string; title?: string }[];
  output?: { content?: Record<string, unknown> | string; grounding?: Grounding[] };
};

/** The Exa key. EXA_KEY is accepted too, since that's the name it was first given in Vercel. */
export const exaKey = () => process.env.EXA_API_KEY || process.env.EXA_KEY;

export async function exaStructured<T>(opts: {
  query: string;
  objective: string;
  systemPrompt: string;
  outputSchema: object;
  arrayKey: string; // the array in the schema that holds the items
  priceFields: string[]; // fields whose low-confidence citation drops the item
}): Promise<{ results: { url: string; title: string }[]; items: (T & { lowConfidence: boolean })[] }> {
  const key = exaKey();
  if (!key) throw new Error("EXA_API_KEY not set");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query: opts.query,
      type: "auto",
      userLocation: "FI", // Finnish market only
      objective: opts.objective,
      systemPrompt: opts.systemPrompt,
      outputSchema: opts.outputSchema,
      contents: { highlights: true },
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = (await res.json()) as ExaResponse;
  const content = typeof data.output?.content === "string" ? JSON.parse(data.output.content) : data.output?.content;
  const fieldRe = new RegExp(`^${opts.arrayKey}\\[(\\d+)\\]\\.(${opts.priceFields.join("|")})$`);
  const low = new Set(
    (data.output?.grounding ?? [])
      .filter((g) => g.confidence === "low")
      .map((g) => g.field.match(fieldRe)?.[1])
      .filter((i): i is string => i != null)
      .map(Number),
  );
  const items = ((content?.[opts.arrayKey] ?? []) as T[]).map((o, i) => ({ ...o, lowConfidence: low.has(i) }));
  return { results: (data.results ?? []).map((r) => ({ url: r.url, title: r.title ?? r.url })), items };
}

/** Pages Exa found across several searches, deduplicated by URL. */
export const uniqueSources = (lists: { url: string; title: string }[][]) => [
  ...new Map(lists.flat().map((r) => [r.url, r])).values(),
];
