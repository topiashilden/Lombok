import { currentLinked, explainLinked, linkedSummary } from "@/lib/linked-bank";
import { isSameOriginPost } from "@/lib/loopback";

// Reads the linked bank again from Enable Banking, skipping the short cache.
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return Response.json({ error: "Refused: not sent from the app." }, { status: 403 });
  const linked = await currentLinked();
  if (!linked) return Response.json({ error: "No bank is connected." }, { status: 404 });
  try {
    const s = await linkedSummary(linked, { fresh: true });
    return Response.json({ transactions: s.transactions, syncedAt: s.syncedAt });
  } catch (e) {
    return Response.json({ error: explainLinked(e) }, { status: 502 });
  }
}
