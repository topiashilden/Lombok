import { explainLinked, sandboxBanks, sandboxEnabled } from "@/lib/linked-bank";

// The bank picker's list, straight from Enable Banking (the demo uses its sandbox: test banks). 404 when the demo connection is not set up.
export async function GET(req: Request) {
  if (!sandboxEnabled()) return new Response("Not found", { status: 404 });
  try {
    const country = new URL(req.url).searchParams.get("country") ?? "FI";
    if (!/^[A-Z]{2}$/.test(country)) return Response.json({ error: "Choose a country." }, { status: 400 });
    return Response.json({ banks: await sandboxBanks(country) });
  } catch (e) {
    return Response.json({ error: explainLinked(e) }, { status: 502 });
  }
}
