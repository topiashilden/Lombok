// Nordnet's External API, READ ONLY, for the account owner, run locally. No dependencies on the app, so scripts/nordnet-api.mjs
// can use it directly. Docs: https://www.nordnet.fi/externalapi/docs/api and the official examples at
// https://github.com/nordnet/next-api-v2-examples (this signing matches their sign.py: Ed25519 over the challenge's UTF-8 bytes).
//
// What it can do: log in with the owner's own API key, then GET the account list, each account's summary and its positions.
// What it will never do: anything else. Nordnet's API also has order endpoints; request() below refuses every call that is
// not a login or one of those GETs, so this code cannot trade, however it is called.
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// (Plain fields, not constructor shorthand: Node's built-in TypeScript mode, which runs scripts/nordnet-api.mjs, rejects shorthand.)
class Reader {
  private b: Buffer;
  private o: number;
  constructor(b: Buffer, start = 0) {
    this.b = b;
    this.o = start;
  }
  u32() {
    const v = this.b.readUInt32BE(this.o);
    this.o += 4;
    return v;
  }
  str() {
    const n = this.u32();
    const out = this.b.subarray(this.o, this.o + n);
    this.o += n;
    return out;
  }
}

/** Reads an unencrypted OpenSSH ed25519 private key (what `ssh-keygen -t ed25519` writes) into a Node key. */
export function readOpenSshEd25519(text: string): KeyObject {
  const m = text.match(/-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+?)-----END OPENSSH PRIVATE KEY-----/);
  if (!m) throw new Error("That file is not an OpenSSH private key.");
  const buf = Buffer.from(m[1].replace(/\s+/g, ""), "base64");
  const magic = "openssh-key-v1\0";
  if (buf.subarray(0, magic.length).toString("latin1") !== magic) throw new Error("Unrecognised OpenSSH key format.");
  const r = new Reader(buf, magic.length);
  const cipher = r.str().toString();
  const kdf = r.str().toString();
  r.str();
  if (cipher !== "none" || kdf !== "none") {
    throw new Error('This key has a passphrase. Make a key without one: ssh-keygen -t ed25519 -a 150 -N "" -f <file>');
  }
  if (r.u32() !== 1) throw new Error("Expected exactly one key in the file.");
  r.str(); // public key blob
  const p = new Reader(r.str());
  if (p.u32() !== p.u32()) throw new Error("The key file looks corrupted.");
  const type = p.str().toString();
  if (type !== "ssh-ed25519") throw new Error(`Nordnet needs an ed25519 key, this one is ${type}.`);
  p.str(); // public key
  const secret = p.str(); // 64 bytes: seed then public key
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, secret.subarray(0, 32)]), format: "der", type: "pkcs8" });
}

/** The base64 signature Nordnet's /login/verify wants for a challenge string. */
export const signChallenge = (key: KeyObject, challenge: string) => edSign(null, Buffer.from(challenge, "utf8"), key).toString("base64");

/** Offline check that a key loads and signs. Returns true if a signature verifies against the key's own public half. */
export function selfTest(key: KeyObject): boolean {
  const sig = Buffer.from(signChallenge(key, "solvo-selftest"), "base64");
  return edVerify(null, Buffer.from("solvo-selftest"), createPublicKey(key), sig);
}

/** The raw 32 bytes of the public half of an OpenSSH `.pub` line, as a Node public key. For tests. */
export function publicKeyFromOpenSshPub(line: string): KeyObject {
  const blob = Buffer.from(line.trim().split(/\s+/)[1], "base64");
  const r = new Reader(blob);
  r.str();
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, r.str()]), format: "der", type: "spki" });
}

export type Country = "fi" | "se" | "no" | "dk";
export type NordnetConfig = { apiKey: string; privateKey: KeyObject; country: Country };
const base = (c: Country) => `https://public.nordnet.${c}`;

/** The only calls this connector will ever make: the two login POSTs and a few GETs. Orders and everything else are refused. */
export function isAllowed(method: string, path: string): boolean {
  if (method === "POST") return path === "/api/2/login/start" || path === "/api/2/login/verify";
  return method === "GET" && READ_PATHS.some((re) => re.test(path.split("?")[0]));
}

const READ_PATHS = [/^\/api\/2$/, /^\/api\/2\/accounts$/, /^\/api\/2\/accounts\/\d+\/(info|positions|ledgers)$/];

async function request(cfg: NordnetConfig, method: "GET" | "POST", path: string, opts: { body?: unknown; session?: string } = {}, retry = true): Promise<unknown> {
  if (!isAllowed(method, path)) throw new Error(`Refused: ${method} ${path} is not part of the read-only connector.`);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.session) headers.Authorization = `Basic ${Buffer.from(`${opts.session}:${opts.session}`).toString("base64")}`;
  const res = await fetch(base(cfg.country) + path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 10_500)); // Nordnet asks for a 10 second wait
    return request(cfg, method, path, opts, false);
  }
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export async function status(country: Country) {
  return request({ apiKey: "", privateKey: null as unknown as KeyObject, country }, "GET", "/api/2");
}

async function login(cfg: NordnetConfig): Promise<string> {
  const start = (await request(cfg, "POST", "/api/2/login/start", { body: { api_key: cfg.apiKey } })) as { challenge: string };
  const verified = (await request(cfg, "POST", "/api/2/login/verify", {
    body: { service: "NEXTAPI", api_key: cfg.apiKey, signature: signChallenge(cfg.privateKey, start.challenge) },
  })) as { session_key: string };
  return verified.session_key;
}

type Amount = number | { value?: number; currency?: string } | null | undefined;
const amt = (a: Amount) => (typeof a === "number" ? a : (a?.value ?? 0));
const cur = (a: Amount) => (typeof a === "object" && a ? a.currency : undefined);

export type NordnetSummary = {
  fetchedAt: string;
  accounts: { label: string; currency: string; cash: number; marketValue: number; ownCapital: number }[];
  positions: { name: string; quantity: number; marketValue: number; currency: string }[];
};

/** Logs in and reads the owner's accounts and positions. Account numbers are never stored, only labels and amounts. */
export async function fetchSummary(cfg: NordnetConfig): Promise<NordnetSummary> {
  const session = await login(cfg);
  const accounts = (await request(cfg, "GET", "/api/2/accounts", { session })) as { accid: number; alias?: string; type?: string }[];
  const out: NordnetSummary = { fetchedAt: new Date().toISOString(), accounts: [], positions: [] };
  for (const [i, a] of accounts.entries()) {
    const info = (await request(cfg, "GET", `/api/2/accounts/${a.accid}/info`, { session })) as Record<string, Amount> | Record<string, Amount>[];
    const row = Array.isArray(info) ? info[0] : info;
    const currency = cur(row.account_sum) ?? cur(row.own_capital) ?? "EUR";
    out.accounts.push({ label: a.alias || a.type || `Account ${i + 1}`, currency, cash: amt(row.account_sum), marketValue: amt(row.full_marketvalue), ownCapital: amt(row.own_capital) });
    const positions = (await request(cfg, "GET", `/api/2/accounts/${a.accid}/positions`, { session })) as { qty?: number; market_value_acc?: Amount; instrument?: { name?: string; symbol?: string } }[];
    for (const p of positions) {
      out.positions.push({ name: p.instrument?.name ?? p.instrument?.symbol ?? "Holding", quantity: p.qty ?? 0, marketValue: amt(p.market_value_acc), currency });
    }
  }
  return out;
}
