// Builds src/data/lookalike.json: a compact 12-month summary of every customer in the S-Pankki dataset,
// so the app can find "a customer like you" (by age and postal code) without reading the CSV at runtime.
// Usage: node scripts/build-lookalike-index.mjs [DATA_DIR]   (default data/s-pankki, gitignored)
// No dependencies. The CSVs have no quoted fields and start with a UTF-8 BOM.
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const DATA = process.argv[2] ?? "data/s-pankki";
const OUT = "src/data/lookalike.json";
const FROM = "2025-10-01"; // last 12 months up to the dataset's last day
const TO = "2026-09-30";

// Same basket mapping as scripts/build-demo-data.mjs.
const BASKET = {
  Housing: 1, Utilities: 1,
  Health: 2, "Home & Tech": 2, Travel: 2,
  Groceries: 3, Restaurants: 3, Transportation: 3, Entertainment: 3, Lifestyle: 3,
};
const LEAK = ["Groceries", "Restaurants", "Transportation", "Entertainment", "Lifestyle"];

const strip = (s) => s.replace(/^﻿/, "");
const customers = new Map();
{
  const [head, ...lines] = strip(readFileSync(`${DATA}/tx_customers_junction.csv`, "utf8")).trim().split(/\r?\n/);
  const cols = head.split(",");
  for (const line of lines) {
    const v = line.split(",");
    const r = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
    customers.set(r.customer_id, {
      age: Number(r.customer_age), postal: r.customer_postal_code,
      salary: 0, b: [0, 0, 0, 0], cat: {}, utilN: 0, taxi: 0,
    });
  }
}

const rl = createInterface({ input: createReadStream(`${DATA}/tx_junction_transactions.csv`, "utf8"), crlfDelay: Infinity });
let first = true;
for await (const raw of rl) {
  if (first) { first = false; continue; }
  const v = raw.split(",");
  const [id, , date, , category, amountStr, , , , mcc] = v;
  if (date < FROM || date > TO) continue;
  const c = customers.get(id);
  if (!c) continue;
  const amount = Number(amountStr);
  if (category === "Salary") { c.salary += amount; continue; }
  const basket = BASKET[category];
  if (!basket || amount >= 0) continue;
  c.b[basket] -= amount;
  c.cat[category] = (c.cat[category] ?? 0) - amount;
  if (category === "Utilities") c.utilN++;
  if (mcc === "4121") c.taxi -= amount;
}

const r0 = (n) => Math.round(n);
// [id, age, postal, salaryYear, basket1, basket2, basket3, utilitiesYear, utilityPaymentsYear, restaurantsYear, taxiYear, topLeakCategory, topLeakYear]
const rows = [...customers.entries()]
  .filter(([, c]) => c.salary > 0)
  .map(([id, c]) => {
    const [topCat, topVal] = LEAK.map((k) => [k, c.cat[k] ?? 0]).sort((a, b) => b[1] - a[1])[0];
    return [id, c.age, c.postal, r0(c.salary), r0(c.b[1]), r0(c.b[2]), r0(c.b[3]), r0(c.cat.Utilities ?? 0), c.utilN,
      r0(c.cat.Restaurants ?? 0), r0(c.taxi), topCat, r0(topVal)];
  });

writeFileSync(OUT, JSON.stringify({ from: FROM, to: TO, columns: ["id", "age", "postal", "salaryYear", "basket1", "basket2", "basket3", "utilitiesYear", "utilityPayments", "restaurantsYear", "taxiYear", "topLeak", "topLeakYear"], rows }));
console.log(`${OUT}: ${rows.length} customers`);
