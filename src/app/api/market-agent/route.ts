import { runElectricityAgent } from "@/lib/market-agent";

// Runs the electricity market agent and streams its steps as NDJSON, one event per line.
// The last line is { type: "result", db, live }. Without keys, or on any failure, db is the saved database.
// In production this runs nightly for everyone; "Run now" in the app calls it live for the demo.

export const maxDuration = 60;

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of runElectricityAgent()) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
