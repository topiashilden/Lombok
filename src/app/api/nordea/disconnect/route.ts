import { disconnectLive, explain, guard } from "@/lib/live-nordea";

// LOCAL ONLY (SOLVO_LIVE=1). Ends the consent at Enable Banking and deletes the session, the raw cache and the customer file.
export async function POST(req: Request) {
  const refused = guard(req, { post: true });
  if (refused) return refused;
  try {
    await disconnectLive();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: explain(e) }, { status: 500 });
  }
}
