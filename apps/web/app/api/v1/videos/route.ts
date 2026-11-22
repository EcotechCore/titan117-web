/**
 * Video jobs through credits (feature 2.7, decisions §59.10): OpenRouter's
 * Videos API is asynchronous (checked 22 Nov 2026): a job is accepted with an
 * id, polled, and downloaded with our key. The job's id is kept on the call,
 * so only its owner can poll or download it, and it is charged once, when
 * the job ends (`usage.cost` on the finished job). The prompt and the video
 * pass through and are never stored (§32).
 */
import {
  attachJob,
  bearer,
  config,
  error,
  notConfigured,
  OPENROUTER,
  OPENROUTER_HEADERS,
  openCall,
  readBody,
  settle,
} from "../_lib/credits";

export const maxDuration = 60;

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) return notConfigured();
  const token = bearer(request);
  if (!token) return error(401, "UNAUTHENTICATED", "Sign in to Titan117 to use credits.");
  const body = await readBody(request);
  if (body instanceof Response) return body;
  // A caller can't point OpenRouter's webhook anywhere (ours is set below), or reuse someone else's job.
  delete body.callback_url;
  delete body.previous_job_id;

  const opened = await openCall(cfg, token, body.model as string);
  if (opened instanceof Response) return opened;
  const { callId } = opened;

  let upstream: Response;
  try {
    upstream = await fetch(`${OPENROUTER}/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.openrouterKey}`, "Content-Type": "application/json", ...OPENROUTER_HEADERS },
      // Our signed webhook charges the job when it ends, even if nobody polls it (§59.13).
      body: JSON.stringify(
        process.env.PROXY_WEBHOOK_URL ? { ...body, callback_url: process.env.PROXY_WEBHOOK_URL } : body,
      ),
    });
  } catch {
    await settle(cfg, callId, 0);
    return error(502, "UPSTREAM", "Couldn't reach the video provider. Please try again.");
  }
  if (!upstream.ok) {
    await settle(cfg, callId, 0);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }
  const job = (await upstream.json()) as { id?: string; status?: string };
  if (typeof job.id !== "string" || !(await attachJob(cfg, callId, job.id))) {
    // The job runs at OpenRouter but we can't follow it: charge a little rather than nothing.
    await settle(cfg, callId, 0.01);
    return error(502, "UPSTREAM", "The video job started but couldn't be followed. Please try again.");
  }
  return Response.json({ id: job.id, status: job.status ?? "pending" }, { status: 202 });
}
