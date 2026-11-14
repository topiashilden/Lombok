// Enable Banking (PSD2) fetch for the OWNER's own Nordea accounts. Local only, never deployed.
//
//   node --env-file=.env.local scripts/nordea-psd2.mjs check      verify the key and application
//   node --env-file=.env.local scripts/nordea-psd2.mjs auth       start a new consent (prints a URL to approve)
//   node --env-file=.env.local scripts/nordea-psd2.mjs session    exchange the callback code for a session
//   node --env-file=.env.local scripts/nordea-psd2.mjs fetch      download transactions into the cache
//
// Needs in .env.local (gitignored): ENABLE_APP_ID, ENABLE_KEY_PATH (path to the .pem, kept outside the repo).
// Output goes to data/private/nordea-api/ (gitignored). Raw data is never printed: only counts and dates.
// Endpoints follow https://enablebanking.com/docs/api/reference/ ; check them against the first real response.
import { createSign } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const API = "https://api.enablebanking.com";
const APP_ID = process.env.ENABLE_APP_ID;
const KEY_PATH = process.env.ENABLE_KEY_PATH;
const OUT = "data/private/nordea-api";
const SESSION_FILE = `${OUT}/session.json`;
// Nordea allows at most 540 days of history. Ask for 535 to stay inside the limit.
const DATE_FROM = process.env.NORDEA_DATE_FROM ?? new Date(Date.now() - 535 * 864e5).toISOString().slice(0, 10);

if (!APP_ID || !KEY_PATH) {
  console.error("Set ENABLE_APP_ID and ENABLE_KEY_PATH in .env.local and run with --env-file=.env.local");
  process.exit(1);
}

const b64url = (b) => Buffer.from(b).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: APP_ID }));
  const body = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(readFileSync(KEY_PATH, "utf8"));
  return `${head}.${body}.${b64url(sig)}`;
}

async function call(method, path, { query, body } = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    // Error bodies describe the problem; they do not contain account data.
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

function save(file, data) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
  chmodSync(file, 0o600);
}

const cmd = process.argv[2];

if (cmd === "check") {
  const app = await call("GET", "/application");
  console.log("key and application OK:", { name: app.name, active: app.active, environment: app.environment, countries: app.countries });
} else if (cmd === "auth") {
  // Starts a consent: prints a URL to open in a browser and approve with Nordea ID.
  // Afterwards the browser lands on the redirect URL (the page will not load); copy that address.
  const days = Number(process.env.NORDEA_CONSENT_DAYS ?? 30);
  const validUntil = new Date(Date.now() + days * 864e5).toISOString();
  const r = await call("POST", "/auth", {
    body: {
      access: { valid_until: validUntil },
      aspsp: { name: "Nordea", country: "FI" },
      state: `solvo-${Date.now()}`,
      redirect_url: process.env.ENABLE_REDIRECT_URL ?? "https://localhost:3000/callback",
      psu_type: "personal",
    },
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
  const s = await call("POST", "/sessions", { body: { code } });
  save(SESSION_FILE, s);
  console.log("session saved to", SESSION_FILE);
  console.log("accounts:", (s.accounts ?? []).length, "valid until:", s.access?.valid_until ?? "(not given)");
} else if (cmd === "fetch") {
  if (!existsSync(SESSION_FILE)) throw new Error("No session yet: run the session step first");
  const s = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
  for (const [i, acc] of (s.accounts ?? []).entries()) {
    const uid = acc.uid;
    const txs = [];
    const query = { date_from: DATE_FROM };
    let pages = 0;
    for (;;) {
      const d = await call("GET", `/accounts/${uid}/transactions`, { query });
      txs.push(...(d.transactions ?? []));
      pages++;
      if (!d.continuation_key || pages > 200) break;
      query.continuation_key = d.continuation_key;
    }
    save(`${OUT}/tx_account${i + 1}.json`, txs);
    const dates = txs.map((t) => t.booking_date ?? t.value_date ?? t.transaction_date).filter(Boolean).sort();
    console.log(`account ${i + 1}: ${txs.length} transactions, ${dates[0] ?? "?"} -> ${dates.at(-1) ?? "?"} (${pages} pages)`);
  }
} else {
  console.error("Usage: nordea-psd2.mjs check | auth | session | fetch");
  process.exit(1);
}
