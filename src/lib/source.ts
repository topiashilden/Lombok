// Which customer the home page shows.
//   default                      the synthetic S-Pankki demo customer (what the public app always uses)
//   npm run dev:nordea                the owner's own Nordea data, from data/private/nordea-customer.json
//                                     bound to 127.0.0.1 only, so other devices on the Wi-Fi cannot reach it.
//                                     (build it with scripts/nordea-psd2.mjs and scripts/build-nordea-customer.mjs)
// The private file is gitignored and never exists on Vercel. As a second guard this throws on Vercel.
import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MAIN_CUSTOMER, type DemoCustomer } from "@/lib/demo";

export type Source = { customer: DemoCustomer; local: boolean };

export function getSource(): Source {
  if (process.env.SOLVO_SOURCE !== "nordea") return { customer: MAIN_CUSTOMER, local: false };
  if (process.env.VERCEL) throw new Error("SOLVO_SOURCE=nordea is local only and must not be set on Vercel");
  const file = path.join(process.cwd(), "data/private/nordea-customer.json");
  if (!existsSync(file)) {
    throw new Error("Missing data/private/nordea-customer.json. Run scripts/build-nordea-customer.mjs first.");
  }
  return { customer: JSON.parse(readFileSync(file, "utf8")) as DemoCustomer, local: true };
}
