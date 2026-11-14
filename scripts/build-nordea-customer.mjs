// Turns the owner's cached Nordea API data into a DemoCustomer-shaped JSON (the same shape as src/data/demo/*.json).
// LOCAL ONLY. Input and output live in data/private/ (gitignored). Nothing here is deployed.
//
//   node scripts/build-nordea-customer.mjs
//
// Reads  data/private/nordea-api/tx_account*.json   (from the in-app Connect Nordea flow, or scripts/nordea-psd2.mjs fetch)
// Writes data/private/nordea-customer.json
//
// The mapping rules live in src/lib/nordea-customer.ts, shared with the app. Only counts and euros are printed.
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { BASKET, buildNordeaCustomer } from "../src/lib/nordea-customer.ts";

const IN = "data/private/nordea-api";
const OUT = "data/private/nordea-customer.json";

const files = readdirSync(IN).filter((f) => /^tx_account\d+\.json$/.test(f)).sort();
const { customer, unmapped } = buildNordeaCustomer(files.map((f) => JSON.parse(readFileSync(`${IN}/${f}`, "utf8"))));
mkdirSync("data/private", { recursive: true });
writeFileSync(OUT, JSON.stringify(customer));
chmodSync(OUT, 0o600);

const { last12Months, basketYear, categoryYear, salaryYear } = customer.summary;
console.log(`wrote ${OUT}: ${customer.transactions.length} transactions, ${customer.accounts.length} accounts, asOf ${customer.asOf}`);
console.log(`window: ${last12Months[0]} .. ${last12Months.at(-1)} (${last12Months.length} complete months)`);
console.log("baskets per year:", basketYear, "salary per year:", salaryYear);
console.log("categories per year (EUR):");
for (const [k, v] of Object.entries(categoryYear).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(14)} ${String(Math.round(v)).padStart(7)}  basket ${BASKET[k]}`);
console.log("largest unmapped merchants (businesses only, EUR over whole period):");
for (const [k, v] of Object.entries(unmapped).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k.slice(0, 28).padEnd(28)} ${Math.round(v)}`);
