/**
 * The shared artifact itself, framed by /s/<id>. Served with a `sandbox`
 * content policy, so even opened directly it runs in an opaque origin with no
 * access to our cookies or pages, and with no network: only its own inline
 * scripts, styles and images (decisions §44, guardrails §7).
 */
import { api } from "@titan117/backend/api";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";

const CSP = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src data:",
  "media-src data: blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(_request: Request, { params }: RouteContext<"/s/[id]/raw">) {
  await connection();
  const { id } = await params;
  let share: Awaited<ReturnType<typeof fetchQuery<typeof api.shares.view>>> = null;
  try {
    share = await fetchQuery(api.shares.view, { publicId: id });
  } catch {
    return new Response("Not available right now.", { status: 502 });
  }
  if (!share || share.state !== "live" || !share.url) return new Response("Not found.", { status: 404 });
  const file = await fetch(share.url);
  if (!file.ok) return new Response("Not found.", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
