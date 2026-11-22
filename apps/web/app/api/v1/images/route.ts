/**
 * Images through credits (feature 2.7, decisions §59.10): OpenRouter's
 * Images API (`POST /api/v1/images`, checked 22 Nov 2026), charged at
 * OpenRouter's `usage.cost` × 1.25 once the image is back. OpenRouter doesn't
 * bill failed or cancelled generations, and neither do we. The prompt and the
 * image pass through and are never stored or logged (§32).
 */
import {
  bearer,
  config,
  error,
  notConfigured,
  OPENROUTER,
  OPENROUTER_HEADERS,
  openCall,
  readBody,
  settle,
  UNKNOWN_COST_USD,
} from "../_lib/credits";

export const maxDuration = 300;

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) return notConfigured();
  const token = bearer(request);
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.prompt !== "string" || !body.prompt) return error(400, "BAD_REQUEST", "No prompt given.");

  const opened = await openCall(cfg, token, body.model as string);
  if (opened instanceof Response) return opened;
  const { callId } = opened;

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER}/images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.openrouterKey}`, "Content-Type": "application/json", ...OPENROUTER_HEADERS },
      // One answer with the image inside: no stream, no address that outlives the call.
      body: JSON.stringify({ ...body, stream: false, response_format: "b64_json" }),
      signal: request.signal,
    });
  } catch {
    await settle(cfg, callId, 0);
    return error(502, "UPSTREAM", "Couldn't reach the image provider. Please try again.");
  }
  if (!upstream.ok) {
    await settle(cfg, callId, 0);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }
  const json = (await upstream.json()) as { usage?: { cost?: number } };
  await settle(cfg, callId, typeof json.usage?.cost === "number" ? json.usage.cost : UNKNOWN_COST_USD);
  return Response.json(json);
}
