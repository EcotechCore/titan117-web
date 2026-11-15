/** "Fixed in 1.4, update now?" (feature 19.5): which of this device's reports a release has fixed. */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError as apiError, tokenHashOf } from "../../shares/shared";

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return apiError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return apiError(401, "UNAUTHENTICATED");
  let refs: string[] = [];
  try {
    const body = (await request.json()) as { refs?: unknown };
    refs = Array.isArray(body.refs) ? body.refs.filter((r): r is string => typeof r === "string").slice(0, 50) : [];
  } catch {
    return apiError(400, "BAD_REQUEST");
  }
  try {
    const fixed = await new ConvexHttpClient(cfg.convexUrl).mutation(api.errorReports.fixedForDevice, {
      proxySecret: cfg.proxySecret,
      tokenHash,
      refs,
    });
    return Response.json({ fixed });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code === "UNAUTHENTICATED") return apiError(401, code);
    return apiError(502, "UPSTREAM");
  }
}
