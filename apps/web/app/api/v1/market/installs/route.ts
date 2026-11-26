/**
 * The desktop app says it installed a marketplace item at a commit
 * (decisions §66.12). We send Convex only the device token's SHA-256 and our
 * server's secret; Convex counts one install per account and item.
 */
import { api } from "@titan117/backend/api";
import { ConvexHttpClient } from "convex/browser";

import { serverConfig, shareError, tokenHashOf } from "../../shares/shared";

const FULL_NAME = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, BAD_REQUEST: 400, NOT_FOUND: 404, RATE_LIMITED: 429 };

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return shareError(401, "UNAUTHENTICATED");
  let body: { repo?: unknown; commit?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  if (typeof body.repo !== "string" || !FULL_NAME.test(body.repo) || typeof body.commit !== "string")
    return shareError(400, "BAD_REQUEST");
  const convex = new ConvexHttpClient(cfg.convexUrl);
  const result = await convex.mutation(api.market.installedForDevice, {
    proxySecret: cfg.proxySecret,
    tokenHash,
    fullName: body.repo,
    commit: body.commit,
  });
  return result.ok ? Response.json({ ok: true }) : shareError(STATUS[result.code] ?? 400, result.code);
}
