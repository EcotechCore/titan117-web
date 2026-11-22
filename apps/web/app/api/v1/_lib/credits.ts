/**
 * What every credits-proxy route shares (decisions §12, §59.10): our
 * settings, OpenAI-shaped errors, opening a call in Convex for the desktop's
 * device token or a web sign-in, charging it once, and finding OpenRouter's
 * cost when a response didn't carry it.
 *
 * Prompts, images and videos pass through and are never stored or logged (§32).
 */
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { createHash } from "node:crypto";

export const OPENROUTER = "https://openrouter.ai/api/v1";
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
/** When a call's cost can't be found at all, charge this much rather than nothing. */
export const UNKNOWN_COST_USD = 0.01;

export const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://titan117.com",
  "X-Title": "Titan117",
};

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  PAYMENT_REQUIRED: 402,
  INSUFFICIENT_CREDITS: 402,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
};

export interface ProxyConfig {
  convexUrl: string;
  proxySecret: string;
  openrouterKey: string;
}

export function error(status: number, code: string, message: string) {
  // OpenAI's error shape, so existing clients show it.
  return Response.json({ error: { code, message } }, { status });
}

export function config(): ProxyConfig | null {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const proxySecret = process.env.PROXY_SECRET;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  return convexUrl && proxySecret && openrouterKey ? { convexUrl, proxySecret, openrouterKey } : null;
}

export function notConfigured() {
  console.error("credits proxy: NEXT_PUBLIC_CONVEX_URL, PROXY_SECRET or OPENROUTER_API_KEY is not set");
  return error(503, "NOT_CONFIGURED", "Cloud models through credits aren't available right now.");
}

export function bearer(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? null;
}

/** A Convex refusal as an HTTP answer; null when it wasn't one we know. */
function refusal(e: unknown): Response | null {
  const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
  if (code && STATUS[code]) return error(STATUS[code], code, code);
  // A token Convex can't verify arrives as a plain error.
  if (/auth|token|jwt/i.test(String(e))) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
  return null;
}

/**
 * Run a Convex mutation as the caller: the desktop app signs with its device
 * token (we send only its SHA-256); the web signs with the user's Clerk token.
 * Our server's secret goes either way.
 */
async function asCaller<T>(
  cfg: ProxyConfig,
  token: string,
  device: (client: ConvexHttpClient, tokenHash: string) => Promise<T>,
  user: (client: ConvexHttpClient) => Promise<T>,
): Promise<T> {
  const client = new ConvexHttpClient(cfg.convexUrl);
  if (token.startsWith("t117d_")) return device(client, createHash("sha256").update(token).digest("hex"));
  client.setAuth(token);
  return user(client);
}

/** Open a call before it goes to OpenRouter: an active plan, credits left, not too many at once. */
export async function openCall(
  cfg: ProxyConfig,
  token: string,
  model: string,
): Promise<{ callId: Id<"proxyCalls"> } | Response> {
  try {
    const { callId } = await asCaller(
      cfg,
      token,
      (c, tokenHash) => c.mutation(api.proxy.beginForDevice, { proxySecret: cfg.proxySecret, tokenHash, model }),
      (c) => c.mutation(api.proxy.begin, { proxySecret: cfg.proxySecret, model }),
    );
    return { callId };
  } catch (e) {
    const answer = refusal(e);
    if (answer) return answer;
    console.error("credits proxy: begin failed");
    return error(502, "UPSTREAM", "Couldn't start the call. Please try again.");
  }
}

/** A video job of this caller's, or a refusal. Someone else's job is "not found". */
export async function ownJob(
  cfg: ProxyConfig,
  token: string,
  jobId: string,
): Promise<{ callId: Id<"proxyCalls">; settled: boolean } | Response> {
  try {
    return await asCaller(
      cfg,
      token,
      (c, tokenHash) => c.mutation(api.proxy.jobForDevice, { proxySecret: cfg.proxySecret, tokenHash, jobId }),
      (c) => c.mutation(api.proxy.jobForUser, { proxySecret: cfg.proxySecret, jobId }),
    );
  } catch (e) {
    const answer = refusal(e);
    if (answer) return answer;
    console.error("credits proxy: job lookup failed");
    return error(502, "UPSTREAM", "Couldn't check the job. Please try again.");
  }
}

/** Charge a call once: OpenRouter's cost × 1.25 in credits. */
export async function settle(cfg: ProxyConfig, callId: Id<"proxyCalls">, costUsd: number): Promise<void> {
  await new ConvexHttpClient(cfg.convexUrl)
    .mutation(api.proxy.settle, { proxySecret: cfg.proxySecret, callId, costUsd })
    .catch(() => {
      // Logged without details: the call id is enough to find it.
      console.error(`credits proxy: settle failed for ${callId}`);
    });
}

export async function attachJob(cfg: ProxyConfig, callId: Id<"proxyCalls">, jobId: string): Promise<boolean> {
  try {
    await new ConvexHttpClient(cfg.convexUrl).mutation(api.proxy.attachJob, {
      proxySecret: cfg.proxySecret,
      callId,
      jobId,
    });
    return true;
  } catch {
    console.error(`credits proxy: attaching a job failed for ${callId}`);
    return false;
  }
}

/**
 * OpenRouter's recorded cost for a generation. A cancelled call's record
 * appeared after 8–15 seconds when tested (15 Nov 2026), so this tries for
 * about half a minute.
 */
export async function lookupCost(id: string | null, key: string): Promise<number | null> {
  if (!id || !/^gen-[0-9A-Za-z-]{1,124}$/.test(id)) return null;
  for (const wait of [1000, 2000, 3000, 5000, 8000, 12000]) {
    await new Promise((r) => setTimeout(r, wait));
    const res = await fetch(`${OPENROUTER}/generation?id=${id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const cost = ((await res.json()) as { data?: { total_cost?: number } }).data?.total_cost;
      if (typeof cost === "number") return cost;
    }
  }
  return null;
}

/** The request's JSON body, size-checked, with a model; or a refusal. */
export async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "TOO_LARGE", "The request is too large.");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return error(400, "BAD_REQUEST", "The request isn't valid JSON.");
  }
  if (typeof body.model !== "string" || !body.model) return error(400, "BAD_REQUEST", "No model given.");
  return body;
}
