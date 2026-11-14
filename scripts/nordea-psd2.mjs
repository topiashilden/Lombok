// Command-line version of the Nordea connection, for debugging. The app does the same from Profile > Connect Nordea
// (src/lib/live-nordea.ts); both use src/lib/enable-banking-core.ts and write the same files. Local only, never deployed.
//
//   node --env-file=.env.local scripts/nordea-psd2.mjs check      verify the key and application
//   node --env-file=.env.local scripts/nordea-psd2.mjs auth       start a new consent (prints a URL to approve)
//   node --env-file=.env.local scripts/nordea-psd2.mjs session    exchange the callback code for a session
//   node --env-file=.env.local scripts/nordea-psd2.mjs fetch      download transactions into the cache
//
// Needs in .env.local (gitignored): ENABLE_APP_ID, ENABLE_KEY_PATH (path to the .pem, kept outside the repo).
// Output goes to data/private/nordea-api/ (gitignored). Raw data is never printed: only counts and dates.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { appStatus, configFromEnv, createSession, fetchAccountTransactions, nordeaDateFrom, startAuth } from "../src/lib/enable-banking-core.ts";

const OUT = "data/private/nordea-api";
const SESSION_FILE = `${OUT}/session.json`;
const cfg = configFromEnv(process.env);
if (!cfg) {
  console.error("Set ENABLE_APP_ID and ENABLE_KEY_PATH in .env.local and run with --env-file=.env.local");
  process.exit(1);
}

function save(file, data) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
  chmodSync(file, 0o600);
}

const cmd = process.argv[2];

if (cmd === "check") {
  const app = await appStatus(cfg);
  console.log("key and application OK:", { name: app.name, active: app.active, environment: app.environment, countries: app.countries });
} else if (cmd === "auth") {
  // Prints a URL to open in a browser and approve with Nordea ID. Afterwards the browser lands on the redirect URL (the page
  // will not load unless the app is running); copy that address. The in-app flow does all of this for you.
  const r = await startAuth(cfg, {
    bank: "Nordea",
    country: "FI",
    state: `solvo-${Date.now()}`,
    redirectUrl: process.env.ENABLE_REDIRECT_URL ?? "https://localhost:3000/callback",
    validDays: Number(process.env.NORDEA_CONSENT_DAYS ?? 30),
  });
  console.log("Open this URL in your browser and approve with Nordea ID:\n" + r.url);
} else if (cmd === "session") {
  // The callback code is single-use and short-lived: run this right after consenting.
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("Paste the callback URL (or just the code) here, in this terminal only: ")).trim();
  rl.close();
  let code = answer;
  try { code = new URL(answer).searchParams.get("code") ?? answer; } catch { /* not a URL: treat as the code */ }
  if (!code) throw new Error("No code found");
  const s = await createSession(cfg, code);
  save(SESSION_FILE, s);
  console.log("session saved to", SESSION_FILE);
  console.log("accounts:", (s.accounts ?? []).length, "valid until:", s.access?.valid_until ?? "(not given)");
} else if (cmd === "fetch") {
  if (!existsSync(SESSION_FILE)) throw new Error("No session yet: run the session step first");
  const s = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  const dateFrom = process.env.NORDEA_DATE_FROM ?? nordeaDateFrom();
  for (const [i, acc] of (s.accounts ?? []).entries()) {
    const { transactions, pages } = await fetchAccountTransactions(cfg, acc.uid, dateFrom);
    save(`${OUT}/tx_account${i + 1}.json`, transactions);
    const dates = transactions.map((t) => t.booking_date ?? t.value_date ?? t.transaction_date).filter(Boolean).sort();
    console.log(`account ${i + 1}: ${transactions.length} transactions, ${dates[0] ?? "?"} -> ${dates.at(-1) ?? "?"} (${pages} pages)`);
  }
} else {
  console.error("Usage: nordea-psd2.mjs check | auth | session | fetch");
  process.exit(1);
}
