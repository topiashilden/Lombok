// Reads the account owner's own Nordnet accounts and holdings, READ ONLY, locally. Never deployed, never committed.
//
//   node --env-file=.env.local scripts/nordnet-api.mjs check      is Nordnet's API up? (needs no key)
//   node --env-file=.env.local scripts/nordnet-api.mjs selftest   does my private key load and sign? (offline, no key sent anywhere)
//   node --env-file=.env.local scripts/nordnet-api.mjs fetch      log in, read accounts and positions into data/private/nordnet-api/
//
// One-time setup (yours, in your own Nordnet account):
//   1. ssh-keygen -t ed25519 -a 150 -N "" -f ~/.ssh/nordnet_solvo      (empty passphrase: the connector reads unencrypted keys)
//   2. Nordnet web: My pages -> Settings -> My profile -> Security -> API key -> Add a new API key, paste nordnet_solvo.pub.
//      Nordnet shows an API key (a UUID). If that setting isn't there, API access isn't open for your account.
//   3. In .env.local (gitignored):  NORDNET_API_KEY=<the UUID>   NORDNET_KEY_PATH=/Users/you/.ssh/nordnet_solvo   NORDNET_COUNTRY=fi
// The API also has order endpoints. This script cannot call them: see isAllowed() in src/lib/nordnet-core.ts.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchSummary, readOpenSshEd25519, selfTest, status } from "../src/lib/nordnet-core.ts";

const country = process.env.NORDNET_COUNTRY ?? "fi";
const OUT = "data/private/nordnet-api";
const cmd = process.argv[2];

function privateKey() {
  const path = process.env.NORDNET_KEY_PATH;
  if (!path) throw new Error("Set NORDNET_KEY_PATH in .env.local to your private key file.");
  return readOpenSshEd25519(readFileSync(path, "utf8"));
}

if (cmd === "check") {
  const s = await status(country);
  console.log(`Nordnet API (${country}):`, { running: s.system_running, validVersion: s.valid_version });
} else if (cmd === "selftest") {
  const ok = selfTest(privateKey());
  console.log(ok ? "Key OK: it is an unencrypted ed25519 key and it signs correctly. Nothing was sent anywhere." : "Key loaded but the self-test failed.");
} else if (cmd === "fetch") {
  const apiKey = process.env.NORDNET_API_KEY;
  if (!apiKey) throw new Error("Set NORDNET_API_KEY in .env.local (the UUID Nordnet shows after you add your public key).");
  const summary = await fetchSummary({ apiKey, privateKey: privateKey(), country });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  chmodSync(`${OUT}/summary.json`, 0o600);
  console.log(`Saved to ${OUT}/summary.json: ${summary.accounts.length} account(s), ${summary.positions.length} position(s).`);
} else {
  console.error("Usage: nordnet-api.mjs check | selftest | fetch");
  process.exit(1);
}
