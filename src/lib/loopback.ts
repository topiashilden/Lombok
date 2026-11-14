// Guards for anything that touches real bank data. The dev server is also bound to 127.0.0.1 (npm run dev:live); these checks are
// a second lock, so a request that reaches it through a proxy or a forwarded port, or from another website, is refused.

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostOf = (req: Request) => req.headers.get("host") ?? "";

/** True when the request was addressed to this machine itself (localhost, 127.0.0.1 or ::1). */
export function isLoopbackRequest(req: Request): boolean {
  try {
    return LOOPBACK.has(new URL(`http://${hostOf(req)}`).hostname);
  } catch {
    return false;
  }
}

/** True when a browser sent this request from our own page. Browsers always send Origin on a POST; scripts and other sites fail it. */
export function isSameOriginPost(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === hostOf(req);
  } catch {
    return false;
  }
}

/** The address the browser used, for redirects back to ourselves: the Host header (what the person typed) with the request's own scheme. */
export function originOf(req: Request): string {
  return `${new URL(req.url).protocol}//${hostOf(req)}`;
}
