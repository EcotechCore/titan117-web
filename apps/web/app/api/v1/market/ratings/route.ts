/**
 * Stars for a marketplace item from the desktop app (decisions §66.12): 1 to
 * 5, only from an account that installed it. Convex sees the device token's
 * SHA-256, never the token.
 */
import { api } from "@titan117/backend/api";
import { ConvexHttpClient } from "convex/browser";

import { serverConfig, shareError, tokenHashOf } from "../../shares/shared";

const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, BAD_REQUEST: 400, NOT_FOUND: 404, FORBIDDEN: 403 };

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return shareError(401, "UNAUTHENTICATED");
  let body: { repo?: unknown; stars?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  if (typeof body.repo !== "string" || !FULL_NAME.test(body.repo) || typeof body.stars !== "number")
    return shareError(400, "BAD_REQUEST");
  const convex = new ConvexHttpClient(cfg.convexUrl);
  const result = await convex.mutation(api.market.rateForDevice, {
    proxySecret: cfg.proxySecret,
    tokenHash,
    fullName: body.repo,
    stars: body.stars,
  });
  return result.ok ? Response.json({ ok: true }) : shareError(STATUS[result.code] ?? 400, result.code);
}
