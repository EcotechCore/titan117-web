/**
 * The Report button on a shared page (the Digital Services Act's notice and
 * action, decisions §30 and §44). Anyone may report; Convex limits how many
 * reports one page collects in a day. Staff decide in the product owner portal.
 */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError } from "../../shared";

const REASONS = ["illegal", "privacy", "copyright", "abuse", "other"] as const;
type Reason = (typeof REASONS)[number];

export async function POST(request: Request, { params }: RouteContext<"/api/v1/shares/[id]/report">) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  // Only our own page posts here (a form on another site can't).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return shareError(403, "FORBIDDEN");
  let body: { reason?: unknown; note?: unknown; email?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  if (!REASONS.includes(body.reason as Reason) || typeof body.note !== "string" || body.note.length > 4000)
    return shareError(400, "BAD_REQUEST");
  const { id } = await params;
  try {
    await new ConvexHttpClient(cfg.convexUrl).mutation(api.shares.report, {
      proxySecret: cfg.proxySecret,
      publicId: id,
      reason: body.reason as Reason,
      note: body.note,
      ...(typeof body.email === "string" && body.email.trim() ? { email: body.email.slice(0, 200) } : {}),
    });
    return Response.json({ ok: true });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code === "NOT_FOUND") return shareError(404, code);
    if (code === "RATE_LIMITED") return shareError(429, code);
    return shareError(502, "UPSTREAM");
  }
}
