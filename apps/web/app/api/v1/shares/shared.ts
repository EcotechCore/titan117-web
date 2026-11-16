/** What the share routes have in common: our server's settings and the device token's hash. */
import { createHash } from "node:crypto";

export function serverConfig() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const proxySecret = process.env.PROXY_SECRET;
  return convexUrl && proxySecret ? { convexUrl, proxySecret } : null;
}

/** The desktop app's device token, hashed: Convex never sees the token itself (decisions §39). */
export function tokenHashOf(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (t117d_[A-Za-z0-9_-]{16,200})$/)?.[1];
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

/** Errors are codes (guardrails §2). */
export function shareError(status: number, code: string) {
  return Response.json({ error: { code } }, { status });
}
