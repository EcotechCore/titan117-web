/**
 * Comments on a shared page (feature 17.14, decisions §50): anyone with the
 * link may comment from the page itself. Convex limits how many a page
 * collects in a day; the owner hides or answers them from the desktop app.
 */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError } from "../../shared";

export async function POST(request: Request, { params }: RouteContext<"/api/v1/shares/[id]/comments">) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  // Only our own page posts here.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return shareError(403, "FORBIDDEN");
  let body: { name?: unknown; text?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 4000)
    return shareError(400, "BAD_REQUEST");
  const { id } = await params;
  try {
    await new ConvexHttpClient(cfg.convexUrl).mutation(api.shares.comment, {
      proxySecret: cfg.proxySecret,
      publicId: id,
      name: typeof body.name === "string" ? body.name.slice(0, 200) : "",
      text: body.text,
    });
    return Response.json({ ok: true });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code === "NOT_FOUND") return shareError(404, code);
    if (code === "RATE_LIMITED") return shareError(429, code);
    if (code === "FORBIDDEN") return shareError(400, "BAD_REQUEST");
    return shareError(502, "UPSTREAM");
  }
}
