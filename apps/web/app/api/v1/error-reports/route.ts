/**
 * Error reports (features 19.1-19.11, decisions §22 and §45): the desktop app
 * posts a report the user has read in full, with its device token. Convex
 * gets only the token's SHA-256 and our server's secret, scrubs the report
 * again, groups it and returns the reference the user sees (T117-…).
 */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError as apiError, tokenHashOf } from "../shares/shared";

const MAX_BYTES = 64 * 1024;

const STATUS: Record<string, number> = { UNAUTHENTICATED: 401, RATE_LIMITED: 429, FORBIDDEN: 403 };

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return apiError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return apiError(401, "UNAUTHENTICATED");
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return apiError(413, "TOO_LARGE");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return apiError(400, "BAD_REQUEST");
  }
  const text = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : "");
  const logLines = Array.isArray(body.logLines) ? body.logLines.filter((l): l is string => typeof l === "string") : [];
  try {
    const { ref } = await new ConvexHttpClient(cfg.convexUrl).mutation(api.errorReports.submitForDevice, {
      proxySecret: cfg.proxySecret,
      tokenHash,
      appVersion: text("appVersion"),
      os: text("os"),
      feature: text("feature"),
      message: text("message"),
      stack: text("stack"),
      logLines,
      note: text("note"),
    });
    return Response.json({ ref });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code && STATUS[code]) return apiError(STATUS[code], code);
    console.error("error-reports: submit failed");
    return apiError(502, "UPSTREAM");
  }
}
