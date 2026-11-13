// Builds the static demo customers under src/data/demo/ from the S-Pankki CSVs.
// Usage: node scripts/build-demo-data.mjs [CUSTOMER_ID ...]
// Needs data/s-pankki/ (gitignored). No dependencies. The CSVs have no quoted fields.
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const DATA = "data/s-pankki";
const OUT = "src/data/demo";
const DEFAULT_IDS = ["CUST01787", "CUST01590"]; // CUST01787 is the main persona: 34, Espoo, ~EUR 2,400/yr utilities
const ids = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_IDS;

// The dataset is synthetic and ends here. The demo treats this as "today".
const AS_OF = "2026-09-30";

// S-Pankki's three baskets. Edit here if the team disagrees; the app reads this from the JSON.
//  1 = fixed and regular, 2 = fixed and irregular, 3 = everyday leakage
// Groceries and Transportation are in basket 3 on purpose (the plan puts taxis there);
// the coach can still call groceries "necessary" in the conversation.
const BASKET = {
  Housing: 1,
  Utilities: 1,
  Health: 2,
  "Home & Tech": 2,
  Travel: 2,
  Groceries: 3,
  Restaurants: 3,
  Transportation: 3,
  Entertainment: 3,
  Lifestyle: 3,
};
// Not spending in a basket: Salary, Other Income, Salary Sweep, Invest Deposit, Invest Withdraw.

const strip = (s) => s.replace(/^﻿/, "");
const customers = new Map();
{
  const [head, ...lines] = strip(readFileSync(`${DATA}/tx_customers_junction.csv`, "utf8")).trim().split(/\r?\n/);
  const cols = head.split(",");
  for (const line of lines) {
    const v = line.split(",");
    const r = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
    customers.set(r.customer_id, { id: r.customer_id, postalCode: r.customer_postal_code, age: Number(r.customer_age) });
  }
}
for (const id of ids) if (!customers.has(id)) throw new Error(`Unknown customer ${id}`);

const tx = new Map(ids.map((id) => [id, []]));
const rl = createInterface({ input: createReadStream(`${DATA}/tx_junction_transactions.csv`, "utf8"), crlfDelay: Infinity });
let cols = null;
for await (const raw of rl) {
  const line = strip(raw);
  if (!cols) { cols = line.split(","); continue; }
  const id = line.slice(0, line.indexOf(","));
  const bucket = tx.get(id);
  if (!bucket) continue;
  const v = line.split(",");
  const r = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
  bucket.push({
    date: r.tx_date,
    ts: r.tx_timestamp,
    account: r.bank_account_id,
    category: r.category,
    amount: Number(r.tx_amount_eur),
    balance: Number(r.balance_after_eur),
    type: r.transaction_type,
    merchant: r.merchant_id || null,
    mcc: r.mcc_code || null,
  });
}

const round2 = (n) => Math.round(n * 100) / 100;
mkdirSync(OUT, { recursive: true });
const index = [];
for (const id of ids) {
  const rows = tx.get(id).sort((a, b) => a.date.localeCompare(b.date));
  const monthly = {}; // month -> category -> sum (signed)
  for (const t of rows) {
    const m = t.date.slice(0, 7);
    monthly[m] ??= {};
    monthly[m][t.category] = round2((monthly[m][t.category] ?? 0) + t.amount);
  }
  const months = Object.keys(monthly).sort();
  const last12 = months.slice(-12);
  const basketYear = { 1: 0, 2: 0, 3: 0 };
  const categoryYear = {};
  for (const m of last12) {
    for (const [cat, sum] of Object.entries(monthly[m])) {
      if (BASKET[cat]) {
        basketYear[BASKET[cat]] = round2(basketYear[BASKET[cat]] - sum);
        categoryYear[cat] = round2((categoryYear[cat] ?? 0) - sum);
      }
    }
  }
  const salaryYear = round2(last12.reduce((s, m) => s + (monthly[m].Salary ?? 0), 0));
  const out = {
    ...customers.get(id),
    asOf: AS_OF,
    accounts: [...new Set(rows.map((r) => r.account))],
    basketOf: BASKET,
    summary: { last12Months: last12, basketYear, categoryYear, salaryYear },
    monthly,
    transactions: rows,
  };
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(out));
  index.push({ id, age: out.age, postalCode: out.postalCode, transactions: rows.length, ...out.summary.basketYear && { basketYear: out.summary.basketYear }, utilitiesYear: categoryYear.Utilities, restaurantsYear: categoryYear.Restaurants, salaryYear });
  console.log(id, `${rows.length} tx`, JSON.stringify(out.summary.basketYear), `utilities/yr ${categoryYear.Utilities}`);
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2) + "\n");
