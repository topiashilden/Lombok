import { READING_PROMPT, READING_SCHEMA, type Reading } from "@/lib/einvoice";

// Secondary path for bills that don't arrive as e-invoices (paper bills, other banks):
// Gemini reads a photo into the same fields as an e-invoice. The main path stays the e-invoice.
// POST { image: "data:image/jpeg;base64,..." } -> { reading, source: "gemini", model, ms } or { error }

export const maxDuration = 30;

const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 25_000;
const MAX_BASE64 = 4_000_000; // the client downsizes photos to well under this

const PHOTO_PROMPT = READING_PROMPT.replace(
  "You read Finnish Finvoice 3.0 e-invoices",
  "You read photos of Finnish paper bills",
).replace("from the XML below", "from the photo")
  .concat("\nIf the photo is not a bill or is unreadable, set kind to other, supplier to \"Unknown\", total and monthlyCost to 0, and say so in summary.");

async function readPhoto(model: string, mimeType: string, data: string, key: string, signal: AbortSignal): Promise<Reading> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: PHOTO_PROMPT }, { inlineData: { mimeType, data } }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: READING_SCHEMA,
        temperature: 0,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
    signal,
  });
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error("Gemini returned no text");
  return JSON.parse(text) as Reading;
}

export async function POST(request: Request) {
  const { image } = (await request.json().catch(() => ({}))) as { image?: string };
  const m = image?.match(/^data:(image\/(?:jpeg|png|webp|heic|heif));base64,(.+)$/);
  if (!m) return Response.json({ error: "Send a JPEG, PNG, WebP or HEIC photo." }, { status: 400 });
  const [, mimeType, data] = m;
  if (data.length > MAX_BASE64) return Response.json({ error: "Photo is too large." }, { status: 413 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "Photo reading needs the AI, which isn't configured." }, { status: 503 });

  const started = Date.now();
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let error: unknown;
  for (const model of MODELS) {
    try {
      const reading = await readPhoto(model, mimeType, data, key, signal);
      if (reading.supplier === "Unknown" || !reading.total) {
        return Response.json({ error: "That doesn't look like a bill Solvo can read. Try a sharper photo of the whole bill." }, { status: 422 });
      }
      return Response.json({ reading, source: "gemini", model, ms: Date.now() - started });
    } catch (e) {
      error = e;
      const status = (e as { status?: number }).status;
      if (status !== 429 && status !== 503) break;
    }
  }
  return Response.json({ error: "Couldn't read the photo right now. Try again in a moment.", detail: String(error) }, { status: 502 });
}
