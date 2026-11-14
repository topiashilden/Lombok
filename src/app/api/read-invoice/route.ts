import { INVOICES } from "@/data/einvoices/CUST01787";
import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import { READING_PROMPT, READING_SCHEMA, type Reading } from "@/lib/einvoice";

// Reads one demo e-invoice with Gemini. Falls back to the saved reading so the demo never breaks.
// POST { id } -> { reading, source: "gemini" | "saved", model?, ms, error? }

export const maxDuration = 30;

// The free tier allows ~20 requests a day per model, so fall back to a lighter model on quota or overload errors.
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 25_000;

// Successful readings are kept for the life of the server instance, so a second visit is instant.
const cache = new Map<string, { reading: Reading; model: string }>();

async function readWithGemini(model: string, xml: string, key: string): Promise<Reading> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${READING_PROMPT}\n\n${xml}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: READING_SCHEMA,
        temperature: 0,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error("Gemini returned no text");
  return JSON.parse(text) as Reading;
}

export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  const invoice = INVOICES.find((i) => i.id === id);
  const saved = id ? SAVED_READINGS[id] : undefined;
  if (!invoice || !saved) return Response.json({ error: "Unknown invoice" }, { status: 404 });

  const hit = cache.get(invoice.id);
  if (hit) return Response.json({ ...hit, source: "gemini", ms: 0, cached: true });

  const started = Date.now();
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    let error: unknown;
    for (const model of MODELS) {
      try {
        const reading = await readWithGemini(model, invoice.xml, key);
        cache.set(invoice.id, { reading, model });
        return Response.json({ reading, source: "gemini", model, ms: Date.now() - started });
      } catch (e) {
        error = e;
        const status = (e as { status?: number }).status;
        if (status !== 429 && status !== 503) break;
      }
    }
    return Response.json({ reading: saved, source: "saved", ms: Date.now() - started, error: String(error) });
  }
  return Response.json({ reading: saved, source: "saved", ms: 0, error: "GEMINI_API_KEY not set" });
}
