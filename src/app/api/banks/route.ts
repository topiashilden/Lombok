import { explainLinked, sandboxBanks, sandboxEnabled } from "@/lib/linked-bank";

// The bank picker's list, straight from Enable Banking (the demo uses its sandbox: test banks). 404 when the demo connection is not set up.
export async function GET() {
  if (!sandboxEnabled()) return new Response("Not found", { status: 404 });
  try {
    return Response.json({ banks: await sandboxBanks("FI") });
  } catch (e) {
    return Response.json({ error: explainLinked(e) }, { status: 502 });
  }
}
