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
import { after } from "next/server";

import {
  bearer,
  config,
  error,
  lookupCost,
  notConfigured,
  OPENROUTER,
  OPENROUTER_HEADERS,
  openCall,
  readBody,
  settle as charge,
  UNKNOWN_COST_USD,
} from "../../_lib/credits";

export const maxDuration = 300;

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) return notConfigured();

  const token = bearer(request);
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");

  const body = await readBody(request);
  if (body instanceof Response) return body;

  const opened = await openCall(cfg, token, body.model as string);
  if (opened instanceof Response) return opened;
  const { callId } = opened;

  let settled: Promise<unknown> | null = null;
  const settle = (costUsd: number) => (settled ??= charge(cfg, callId, costUsd));
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
        ...OPENROUTER_HEADERS,
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
