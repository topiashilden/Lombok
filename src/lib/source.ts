// Which customer the app shows.
//   default                      the synthetic S-Pankki demo customer (what the public app always uses)
//                                Profile's "Demo account" switch picks Aino (CUST01787) or a new customer
//                                (CUST01590). The choice travels in the solvo-demo cookie so the server can read it.
//   npm run dev:nordea                the owner's own Nordea data, from data/private/nordea-customer.json
//                                     bound to 127.0.0.1 only, so other devices on the Wi-Fi cannot reach it.
//                                     (build it with scripts/nordea-psd2.mjs and scripts/build-nordea-customer.mjs)
// The private file is gitignored and never exists on Vercel. As a second guard this throws on Vercel.
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { cacheLife } from "next/cache";
import { DEMO_CUSTOMERS, MAIN_CUSTOMER, type DemoCustomer } from "@/lib/demo";
import { DEMO_COOKIE, type DemoMode } from "@/lib/demo-mode";

export type Source = { customer: DemoCustomer; local: boolean; mode: DemoMode };

const parse = (v: string | undefined): DemoMode => (v === "new" ? "new" : "aino");

/** The demo account for a page. Private cache: the client router keeps it, so tab switches stay instant. */
export async function pageMode(): Promise<DemoMode> {
  "use cache: private";
  cacheLife({ stale: 300 });
  return parse((await cookies()).get(DEMO_COOKIE)?.value);
}

/** The demo account for a route handler. */
export async function requestMode(): Promise<DemoMode> {
  return parse((await cookies()).get(DEMO_COOKIE)?.value);
}

export function getSource(mode: DemoMode = "aino"): Source {
  if (process.env.SOLVO_SOURCE !== "nordea") {
    return { customer: mode === "new" ? DEMO_CUSTOMERS.CUST01590 : MAIN_CUSTOMER, local: false, mode };
  }
  if (process.env.VERCEL) throw new Error("SOLVO_SOURCE=nordea is local only and must not be set on Vercel");
  const file = path.join(process.cwd(), "data/private/nordea-customer.json");
  if (!existsSync(file)) {
    throw new Error("Missing data/private/nordea-customer.json. Run scripts/build-nordea-customer.mjs first.");
  }
  return { customer: JSON.parse(readFileSync(file, "utf8")) as DemoCustomer, local: true, mode: "aino" };
}
