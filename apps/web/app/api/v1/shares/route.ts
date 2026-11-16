/**
 * Share links (feature 17.13, decisions §44): the desktop app posts a
 * self-contained HTML snapshot of an artifact with its device token. We send
 * Convex only the token's SHA-256 and our server's secret; Convex checks the
 * device, the plan and the limits, and gives an upload address for the file.
 */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError, tokenHashOf } from "./shared";

/** Convex's own limit is the same (shares.ts); this refuses early, before reading more. */
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return shareError(401, "UNAUTHENTICATED");

  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES + 64 * 1024) return shareError(413, "TOO_LARGE");
  let body: { title?: unknown; kind?: unknown; html?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  const { title, kind, html } = body;
  if (typeof html !== "string" || !html || typeof title !== "string" || typeof kind !== "string")
    return shareError(400, "BAD_REQUEST");
  const bytes = new TextEncoder().encode(html);
  if (bytes.length > MAX_BYTES) return shareError(413, "TOO_LARGE");

  const convex = new ConvexHttpClient(cfg.convexUrl);
  try {
    const { uploadUrl } = await convex.mutation(api.shares.beginForDevice, {
      proxySecret: cfg.proxySecret,
      tokenHash,
      bytes: bytes.length,
    });
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: bytes,
    });
    if (!upload.ok) return shareError(502, "UPSTREAM");
    const { storageId } = (await upload.json()) as { storageId: string };
    const result = await convex.mutation(api.shares.finishForDevice, {
      proxySecret: cfg.proxySecret,
      tokenHash,
      // The upload address only ever returns a storage id.
      storageId: storageId as never,
      title,
      kind,
    });
    if (!result.ok) return shareError(statusOf(result.code), result.code);
    const url = new URL(`/s/${result.publicId}`, request.url).toString();
    return Response.json({ id: result.publicId, url });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code) return shareError(statusOf(code), code);
    console.error("shares: upload failed");
    return shareError(502, "UPSTREAM");
  }
}

function statusOf(code: string) {
  return (
    { UNAUTHENTICATED: 401, PAYMENT_REQUIRED: 402, FORBIDDEN: 403, NOT_FOUND: 404, RATE_LIMITED: 429 }[code] ?? 400
  );
}
