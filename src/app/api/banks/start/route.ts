import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SANDBOX_STATE_COOKIE, beginLinked, explainLinked, sandboxEnabled } from "@/lib/linked-bank";
import { isSameOriginPost, originOf } from "@/lib/loopback";

// Starts connecting a bank through Enable Banking (the demo uses its sandbox). Returns the bank's approval URL; the app sends the
// person there and the bank sends them back to /callback. The state token goes into a short-lived httpOnly cookie and is checked there.
let windowStart = 0;
let starts = 0;

export async function POST(req: Request) {
  if (!sandboxEnabled()) return new Response("Not found", { status: 404 });
  if (!isSameOriginPost(req)) return Response.json({ error: "Refused: not sent from the app." }, { status: 403 });
  // A public endpoint that calls a third party with our key: cap it (30 starts a minute across all visitors).
  if (Date.now() - windowStart > 60_000) [windowStart, starts] = [Date.now(), 0];
  if (++starts > 30) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

  const { bank, country } = (await req.json().catch(() => ({}))) as { bank?: unknown; country?: unknown };
  if (typeof bank !== "string" || typeof country !== "string" || bank.length > 100 || !/^[A-Z]{2}$/.test(country)) {
    return Response.json({ error: "Choose a bank." }, { status: 400 });
  }
  const origin = originOf(req);
  const state = randomBytes(24).toString("base64url");
  try {
    const url = await beginLinked({ state, bank, country, redirectUrl: `${origin}/callback` });
    (await cookies()).set(SANDBOX_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https:"), path: "/", maxAge: 600 });
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: explainLinked(e) }, { status: 502 });
  }
}
