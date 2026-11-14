import { cookies } from "next/headers";
import { LINKED_COOKIE, currentLinked, endLinked } from "@/lib/linked-bank";
import { isSameOriginPost } from "@/lib/loopback";

// Ends the session at Enable Banking and forgets it in the browser.
export async function POST(req: Request) {
  if (!isSameOriginPost(req)) return Response.json({ error: "Refused: not sent from the app." }, { status: 403 });
  const linked = await currentLinked();
  if (linked) await endLinked(linked);
  (await cookies()).delete(LINKED_COOKIE);
  return Response.json({ ok: true });
}
