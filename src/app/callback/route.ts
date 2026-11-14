import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, connection } from "next/server";
import { STATE_COOKIE, completeConsent, guard, liveEnabled } from "@/lib/live-nordea";
import { LINKED_COOKIE, SANDBOX_STATE_COOKIE, completeLinked, sandboxEnabled, sealSecret } from "@/lib/linked-bank";
import { originOf } from "@/lib/loopback";
import { seal } from "@/lib/sealed";

// Where a bank sends the person back after they approve, for BOTH connections that use Enable Banking. The state cookie says which:
//  - the demo bank (Enable Banking's sandbox, public, solvo_eb_state_sbx): keeps the session in the visitor's own encrypted cookie
//    and returns to Profile;
//  - the owner's real Nordea (LOCAL ONLY, SOLVO_LIVE=1, solvo_eb_state): saves the session under data/private/ and hands over to
//    /connect/nordea, which downloads the transactions with a visible progress state.
// Registered with Enable Banking as <origin>/callback (https://localhost:3000/callback locally).
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  await connection(); // always per request, never prerendered at build time
  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const state = params.get("state") ?? "";

  // The demo bank.
  const sandboxState = jar.get(SANDBOX_STATE_COOKIE)?.value;
  if (sandboxEnabled() && sandboxState && same(sandboxState, state)) {
    jar.delete(SANDBOX_STATE_COOKIE); // single use
    const profile = (query: string) => NextResponse.redirect(`${originOf(req)}/profile${query}`);
    if (params.get("error")) return profile("?bank=declined");
    const code = params.get("code");
    if (!code) return profile("?bank=failed");
    try {
      const linked = await completeLinked(code);
      jar.set(LINKED_COOKIE, seal(linked, sealSecret()), {
        httpOnly: true,
        sameSite: "lax",
        secure: originOf(req).startsWith("https:"),
        path: "/",
        maxAge: 30 * 86400,
      });
      return profile("?bank=connected");
    } catch {
      return profile("?bank=failed");
    }
  }

  // Not the demo bank. With real Nordea switched off there is nothing else this could be.
  if (!liveEnabled()) return NextResponse.redirect(`${originOf(req)}/profile?bank=failed`);

  // The owner's real Nordea.
  const refused = guard(req);
  if (refused) return refused;
  const back = (query = "") => NextResponse.redirect(`${originOf(req)}/connect/nordea${query}`);
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE); // single use

  if (!expected || !same(expected, state)) return back("?error=state");
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
