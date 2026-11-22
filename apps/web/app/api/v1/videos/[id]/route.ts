/**
 * A video job's state (decisions §59.10): only its owner may poll it. When
 * the job has ended it is charged once: OpenRouter's `usage.cost` on a
 * finished job, nothing for a failed, cancelled or expired one. OpenRouter's
 * signed download addresses are left out; the video comes through
 * `/api/v1/videos/{id}/content`.
 */
import { bearer, config, error, notConfigured, OPENROUTER, OPENROUTER_HEADERS, ownJob, settle, UNKNOWN_COST_USD } from "../../_lib/credits";

const ENDED = new Set(["completed", "failed", "cancelled", "expired"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cfg = config();
  if (!cfg) return notConfigured();
  const token = bearer(request);
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
  const { id } = await params;
  const job = await ownJob(cfg, token, id);
  if (job instanceof Response) return job;

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER}/videos/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${cfg.openrouterKey}`, ...OPENROUTER_HEADERS },
    });
  } catch {
    return error(502, "UPSTREAM", "Couldn't reach the video provider. Please try again.");
  }
  if (!upstream.ok) return error(upstream.status, "UPSTREAM", "The video provider didn't answer.");
  const state = (await upstream.json()) as {
    status?: string;
    progress?: number;
    error?: unknown;
    usage?: { cost?: number | null };
  };
  const status = state.status ?? "pending";
  if (ENDED.has(status) && !job.settled) {
    const cost = state.usage?.cost;
    await settle(cfg, job.callId, typeof cost === "number" ? cost : status === "completed" ? UNKNOWN_COST_USD : 0);
  }
  return Response.json({
    id,
    status,
    progress: typeof state.progress === "number" ? state.progress : null,
    error: state.error ?? null,
    cost: typeof state.usage?.cost === "number" ? state.usage.cost : null,
  });
}
