/**
 * OpenRouter tells us when a video job ends (decisions §59.13), so every job
 * is charged even if the desktop never polls it to the end. Deliveries are
 * signed with our workspace's secret (`OPENROUTER_WEBHOOK_SECRET`); anything
 * unsigned, forged or stale is refused with a non-2xx answer. Retries are
 * harmless: a call is charged once.
 */
import { api } from "@titan117/backend/api";
import { ConvexHttpClient } from "convex/browser";

import { config, error, notConfigured, UNKNOWN_COST_USD } from "../../_lib/credits";
import { readVideoEvent, verifySignature } from "../../_lib/webhook";

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) return notConfigured();
  const secret = process.env.OPENROUTER_WEBHOOK_SECRET;
  if (!secret) return error(503, "NOT_CONFIGURED", "Webhooks aren't set up.");
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "TOO_LARGE", "Too large.");
  if (!verifySignature(raw, request.headers.get("x-openrouter-signature"), secret))
    return error(401, "BAD_SIGNATURE", "Bad signature.");
  const event = readVideoEvent(raw);
  // Signed, but not an ending we charge for: accepted, nothing to do.
  if (!event) return Response.json({ ok: true });
  const costUsd = event.costUsd ?? (event.status === "completed" ? UNKNOWN_COST_USD : 0);
  let found: boolean;
  try {
    ({ found } = await new ConvexHttpClient(cfg.convexUrl).mutation(api.proxy.settleJob, {
      proxySecret: cfg.proxySecret,
      jobId: event.jobId,
      costUsd,
    }));
  } catch {
    // Convex is down: a non-2xx answer makes OpenRouter retry.
    console.error("video webhook: settling failed");
    return error(500, "SETTLE_FAILED", "Try again.");
  }
  // Not recorded yet (the delivery beat the job's own answer): a retry will find it.
  if (!found) return error(404, "NOT_FOUND", "Unknown job.");
  return Response.json({ ok: true });
}
