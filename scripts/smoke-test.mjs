// Smoke test: starts the built app (`next start`) and checks that the key pages and API routes respond.
// Runs in CI after `npm run build`. Locally: `npm run build && npm run smoke`.
// Needs no GEMINI_API_KEY: without it the API routes answer from saved readings and the offline coach.
import { spawn } from "node:child_process";

const PORT = process.env.SMOKE_PORT ?? "3123";
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", PORT, "-H", "127.0.0.1"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, GEMINI_API_KEY: "" },
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("Server did not start in 30 s");
}

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL  ${name}: ${e.message}`);
  }
}

async function page(path) {
  const res = await fetch(BASE + path);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!html.includes("<html")) throw new Error("no HTML in response");
  if (html.includes("Application error")) throw new Error("page shows an application error");
}

async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  return res.json();
}

try {
  await waitForServer();
  for (const path of ["/", "/bills", "/coach", "/manifest.webmanifest"]) {
    await check(`GET ${path}`, () => (path.endsWith(".webmanifest") ? fetch(BASE + path).then((r) => {
      if (r.status !== 200) throw new Error(`status ${r.status}`);
    }) : page(path)));
  }
  await check("POST /api/read-invoice (saved reading)", async () => {
    const data = await postJson("/api/read-invoice", { id: "electricity" });
    if (!data.reading) throw new Error("no reading in response");
  });
  await check("POST /api/coach (offline answer)", async () => {
    const data = await postJson("/api/coach", { messages: [{ role: "user", text: "How much did I spend on restaurants?" }] });
    if (typeof data.answer !== "string" || !data.answer) throw new Error(`unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  });
} catch (e) {
  failures.push(e.message);
  console.log(`FAIL  ${e.message}`);
} finally {
  server.kill();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed. Server log:\n${serverLog.slice(-3000)}`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
process.exit(0);
