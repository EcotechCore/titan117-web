/**
 * The credits proxy (decisions §12, architecture §5): an OpenAI-compatible
 * chat completions endpoint the desktop engine calls with the user's own
 * device token (or a web sign-in token). It checks the plan and credits in Convex, forwards the call
 * to OpenRouter with our one server-side key, streams the answer back, and
 * charges OpenRouter's cost × 1.25 in credits when the call ends.
 *
 * Prompts and answers pass through and are never stored or logged (§32).
 * OpenRouter facts used here (checked 15 Nov 2026): every response carries
 * `usage.cost` in USD, the last streamed chunk included; `GET
 * /api/v1/generation?id=` returns `data.total_cost` for a call cut short.
 */
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { createHash } from "node:crypto";
import { ConvexError } from "convex/values";
import { after } from "next/server";

export const maxDuration = 300;

const OPENROUTER = "https://openrouter.ai/api/v1";
const MAX_BODY_BYTES = 8 * 1024 * 1024;
// When a call's cost can't be found at all, charge this much rather than nothing.
const UNKNOWN_COST_USD = 0.01;

const STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  PAYMENT_REQUIRED: 402,
  INSUFFICIENT_CREDITS: 402,
  RATE_LIMITED: 429,
};

function error(status: number, code: string, message: string) {
  // OpenAI's error shape, so existing clients show it.
  return Response.json({ error: { code, message } }, { status });
}

function config() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const proxySecret = process.env.PROXY_SECRET;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  return convexUrl && proxySecret && openrouterKey ? { convexUrl, proxySecret, openrouterKey } : null;
}

/**
 * OpenRouter's recorded cost for a generation. A cancelled call's record
 * appeared after 8–15 seconds when tested (15 Nov 2026), so this tries for
 * about half a minute.
 */
async function lookupCost(id: string | null, key: string): Promise<number | null> {
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

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) {
    console.error("credits proxy: NEXT_PUBLIC_CONVEX_URL, PROXY_SECRET or OPENROUTER_API_KEY is not set");
    return error(503, "NOT_CONFIGURED", "Cloud models through credits aren't available right now.");
  }

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "TOO_LARGE", "The request is too large.");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return error(400, "BAD_REQUEST", "The request isn't valid JSON.");
  }
  if (typeof body.model !== "string" || !body.model) return error(400, "BAD_REQUEST", "No model given.");

  // Open the call in Convex: the desktop app signs with its device token (we
  // send only its SHA-256); the web signs with the user's Clerk token. Either
  // way our server's secret goes too.
  let callId: Id<"proxyCalls">;
  try {
    if (token.startsWith("t117d_")) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      ({ callId } = await new ConvexHttpClient(cfg.convexUrl).mutation(api.proxy.beginForDevice, {
        proxySecret: cfg.proxySecret,
        tokenHash,
        model: body.model,
      }));
    } else {
      const asUser = new ConvexHttpClient(cfg.convexUrl);
      asUser.setAuth(token);
      ({ callId } = await asUser.mutation(api.proxy.begin, { proxySecret: cfg.proxySecret, model: body.model }));
    }
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code && STATUS[code]) return error(STATUS[code], code, code);
    // A token Convex can't verify arrives as a plain error.
    if (/auth|token|jwt/i.test(String(e))) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
    console.error("credits proxy: begin failed");
    return error(502, "UPSTREAM", "Couldn't start the call. Please try again.");
  }

  const server = new ConvexHttpClient(cfg.convexUrl);
  let settled: Promise<unknown> | null = null;
  const settle = (costUsd: number) =>
    (settled ??= server.mutation(api.proxy.settle, { proxySecret: cfg.proxySecret, callId, costUsd }).catch(() => {
      // Logged without details: the call id is enough to find it.
      console.error(`credits proxy: settle failed for ${callId}`);
    }));
  let finished!: () => void;
  const done = new Promise<void>((resolve) => (finished = resolve));
  // Keep the function alive until the call is charged, even after the client has gone.
  after(() => done);

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://titan117.com",
        "X-Title": "Titan117",
      },
      body: JSON.stringify(body),
      signal: request.signal,
    });
  } catch {
    await settle(0);
    finished();
    return error(502, "UPSTREAM", "Couldn't reach the model provider. Please try again.");
  }

  // OpenRouter refused the call (bad model, provider down): nothing was charged by them, nothing by us.
  if (!upstream.ok || !upstream.body) {
    await settle(0);
    finished();
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  if (!(upstream.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const json = (await upstream.json()) as { id?: string; usage?: { cost?: number } };
    const cost = json.usage?.cost ?? (await lookupCost(json.id ?? null, cfg.openrouterKey)) ?? UNKNOWN_COST_USD;
    await settle(cost);
    finished();
    return Response.json(json);
  }

  // Streaming: pass every byte through, reading the generation id and the cost on the way.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let generationId: string | null = null;
  let cost: number | null = null;

  const scan = (chunk: Uint8Array) => {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as { id?: string; usage?: { cost?: number } };
        if (event.id) generationId ??= event.id;
        if (typeof event.usage?.cost === "number") cost = event.usage.cost;
      } catch {
        // Not JSON (a keep-alive comment); passed through as it is.
      }
    }
  };

  const finish = async (complete: boolean) => {
    const known = complete && cost !== null ? cost : (cost ?? (await lookupCost(generationId, cfg.openrouterKey)));
    await settle(known ?? UNKNOWN_COST_USD);
    finished();
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done: end, value } = await reader.read();
        if (end) {
          controller.close();
          await finish(true);
          return;
        }
        scan(value);
        controller.enqueue(value);
      } catch {
        controller.error(new Error("upstream stream failed"));
        await finish(false);
      }
    },
    async cancel() {
      // The client went away: stop the model, then charge what it had done.
      await reader.cancel().catch(() => {});
      await finish(false);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
