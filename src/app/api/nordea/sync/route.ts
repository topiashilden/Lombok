import { explain, guard, syncLive } from "@/lib/live-nordea";

// LOCAL ONLY (SOLVO_LIVE=1). Downloads the owner's Nordea transactions and rebuilds the customer the whole app reads.
// Answers with counts and dates only, never transactions.
export async function POST(req: Request) {
  const refused = guard(req, { post: true });
  if (refused) return refused;
  try {
    const { transactions, accounts, asOf, syncedAt } = await syncLive();
    return Response.json({ transactions, accounts, asOf, syncedAt });
  } catch (e) {
    return Response.json({ error: explain(e) }, { status: 502 });
  }
}
