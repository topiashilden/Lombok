import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, connection } from "next/server";
import { STATE_COOKIE, completeConsent, guard } from "@/lib/live-nordea";
import { originOf } from "@/lib/loopback";

// LOCAL ONLY (SOLVO_LIVE=1). Where Nordea sends the person back after Nordea ID. Registered with Enable Banking as
// https://localhost:3000/callback. It checks the state token, swaps the single-use code for a session, and hands over to the
// connect page, which downloads the transactions with a visible progress state.
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  await connection(); // always per request, never prerendered at build time
  const refused = guard(req);
  if (refused) return refused;

  const back = (query = "") => NextResponse.redirect(`${originOf(req)}/connect/nordea${query}`);
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE); // single use

  if (!expected || !same(expected, params.get("state") ?? "")) return back("?error=state");
  if (params.get("error")) return back("?error=declined");
  const code = params.get("code");
  if (!code) return back("?error=nocode");
  try {
    await completeConsent(code);
  } catch {
    return back("?error=session");
  }
  return back();
}
