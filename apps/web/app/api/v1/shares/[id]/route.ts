/** The owner unshares from the desktop app: the snapshot is deleted at once (decisions §44). */
import { api } from "@titan117/backend/api";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError, tokenHashOf } from "../shared";

export async function DELETE(request: Request, { params }: RouteContext<"/api/v1/shares/[id]">) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return shareError(401, "UNAUTHENTICATED");
  const { id } = await params;
  try {
    await new ConvexHttpClient(cfg.convexUrl).mutation(api.shares.removeForDevice, {
      proxySecret: cfg.proxySecret,
      tokenHash,
      publicId: id,
    });
    return Response.json({ ok: true });
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code === "UNAUTHENTICATED") return shareError(401, code);
    if (code === "NOT_FOUND") return shareError(404, code);
    return shareError(502, "UPSTREAM");
  }
}
