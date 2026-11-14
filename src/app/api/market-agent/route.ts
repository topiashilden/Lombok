import { runElectricityAgent } from "@/lib/market-agent";
import { runTelecomAgent } from "@/lib/telecom-agent";

// Runs one of Solvo's market agents and streams its steps as NDJSON, one event per line.
// POST { agent: "electricity" | "telecom" }. The last line is { type: "result", db, live }.
// Without a key, or on any failure, db is the saved database.
// In production the agents run nightly for everyone; "Run now" in the app calls them live for the demo.

export const maxDuration = 60;

const AGENTS = { electricity: runElectricityAgent, telecom: runTelecomAgent };

export async function POST(request: Request) {
  const { agent = "electricity" } = (await request.json().catch(() => ({}))) as { agent?: string };
  const run = AGENTS[agent as keyof typeof AGENTS];
  if (!run) return Response.json({ error: "Unknown agent" }, { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of run()) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
