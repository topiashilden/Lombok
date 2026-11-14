// A small fetch helper for the connect buttons: always answers with ok/data or ok:false and a sentence a person can read.
export type Reply = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

export async function request(path: string, init?: RequestInit): Promise<Reply> {
  try {
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: typeof data.error === "string" ? data.error : `Something went wrong (${res.status}).` };
  } catch {
    return { ok: false, error: "Couldn't reach the app. Try again." };
  }
}

export const postJson = (path: string, body?: unknown) =>
  request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
