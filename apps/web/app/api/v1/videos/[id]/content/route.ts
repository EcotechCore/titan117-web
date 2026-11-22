/**
 * A finished video's bytes (decisions §59.10), streamed straight through
 * from OpenRouter with our key, only to the job's owner. Nothing is kept.
 */
import { bearer, config, error, notConfigured, OPENROUTER, OPENROUTER_HEADERS, ownJob } from "../../../_lib/credits";

export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cfg = config();
  if (!cfg) return notConfigured();
  const token = bearer(request);
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
  const { id } = await params;
  const job = await ownJob(cfg, token, id);
  if (job instanceof Response) return job;
  const index = Number(new URL(request.url).searchParams.get("index") ?? "0");
  if (!Number.isInteger(index) || index < 0 || index > 9) return error(400, "BAD_REQUEST", "Bad index.");

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER}/videos/${encodeURIComponent(id)}/content?index=${index}`, {
      headers: { Authorization: `Bearer ${cfg.openrouterKey}`, ...OPENROUTER_HEADERS },
      signal: request.signal,
    });
  } catch {
    return error(502, "UPSTREAM", "Couldn't reach the video provider. Please try again.");
  }
  if (!upstream.ok || !upstream.body) return error(upstream.status || 502, "UPSTREAM", "The video isn't ready.");
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
      "Cache-Control": "no-store",
    },
  });
}
