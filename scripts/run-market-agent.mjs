// Runs the electricity market agent against a running Solvo server and saves the result as the
// market database the app ships with (src/data/market/electricity.json). In production this is a nightly job.
// Usage: npm run dev (with EXA_API_KEY in .env.local), then: node scripts/run-market-agent.mjs [BASE_URL]
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const res = await fetch(`${base}/api/market-agent`, { method: "POST" });
const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
for (const e of events) if (e.type === "step") console.log(`${e.status.padEnd(7)} ${e.step.padEnd(8)} ${e.detail}`);
const result = events.at(-1);
if (result?.type !== "result" || !result.live) {
  console.error(`Not saved: the agent fell back to the saved database (${result?.error ?? "no result"}).`);
  process.exit(1);
}
writeFileSync("src/data/market/electricity.json", JSON.stringify(result.db, null, 2) + "\n");
console.log(`Saved ${result.db.offers.length} offers from ${result.db.sources.length} sources.`);
