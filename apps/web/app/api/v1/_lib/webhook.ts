/**
 * OpenRouter's signed webhooks for video jobs (decisions §59.13), checked on
 * OpenRouter's own pages on 22 Nov 2026 (Videos API, video generation guide):
 * the `X-OpenRouter-Signature` header is `t=<unix seconds>,v1=<hex>`, the
 * HMAC-SHA256 of `{timestamp},{raw request body}` with the workspace's signing
 * secret, in lowercase hex; timestamps more than 5 minutes away are refused.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_TOLERANCE_SECONDS = 300;

/** Whether a delivery really came from OpenRouter, recently. Missing anything means no. */
export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const at = p.indexOf("=");
      return at > 0 ? [p.slice(0, at).trim(), p.slice(at + 1).trim()] : ["", ""];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !/^\d{1,12}$/.test(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowSeconds - Number(t)) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${t},${rawBody}`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface VideoEvent {
  jobId: string;
  status: string;
  costUsd: number | null;
}

const ENDED = new Set(["completed", "failed", "cancelled", "expired"]);

/** The job, how it ended and what it cost; null for anything else. */
export function readVideoEvent(rawBody: string): VideoEvent | null {
  let body: { type?: unknown; data?: { id?: unknown; status?: unknown; usage?: { cost?: unknown } } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof body.type !== "string" || !body.type.startsWith("video.generation.")) return null;
  const id = body.data?.id;
  const status = body.data?.status;
  if (typeof id !== "string" || !/^[0-9A-Za-z_-]{1,128}$/.test(id)) return null;
  if (typeof status !== "string" || !ENDED.has(status)) return null;
  const cost = body.data?.usage?.cost;
  return { jobId: id, status, costUsd: typeof cost === "number" && cost >= 0 ? cost : null };
}
