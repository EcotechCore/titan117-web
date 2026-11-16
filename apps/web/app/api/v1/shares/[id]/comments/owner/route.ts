/**
 * The owner's side of comments (feature 17.14), from the desktop app with its
 * device token: list every comment, reply on the page, hide or show one.
 */
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import { isErrorCode } from "@titan117/shared";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";

import { serverConfig, shareError, tokenHashOf } from "../../../shared";

export async function POST(request: Request, { params }: RouteContext<"/api/v1/shares/[id]/comments/owner">) {
  const cfg = serverConfig();
  if (!cfg) return shareError(503, "NOT_CONFIGURED");
  const tokenHash = tokenHashOf(request);
  if (!tokenHash) return shareError(401, "UNAUTHENTICATED");
  let body: { op?: unknown; text?: unknown; commentId?: unknown; hidden?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return shareError(400, "BAD_REQUEST");
  }
  const { id: publicId } = await params;
  const convex = new ConvexHttpClient(cfg.convexUrl);
  const base = { proxySecret: cfg.proxySecret, tokenHash, publicId };
  try {
    if (body.op === "list") return Response.json({ comments: await convex.mutation(api.shares.commentsForDevice, base) });
    if (body.op === "reply" && typeof body.text === "string")
      return Response.json(await convex.mutation(api.shares.replyForDevice, { ...base, text: body.text.slice(0, 4000) }));
    if (body.op === "hide" && typeof body.commentId === "string" && typeof body.hidden === "boolean")
      return Response.json(
        await convex.mutation(api.shares.hideForDevice, {
          ...base,
          commentId: body.commentId as Id<"shareComments">,
          hidden: body.hidden,
        }),
      );
    return shareError(400, "BAD_REQUEST");
  } catch (e) {
    const code = e instanceof ConvexError && isErrorCode(e.data) ? e.data : null;
    if (code === "UNAUTHENTICATED") return shareError(401, code);
    if (code === "NOT_FOUND") return shareError(404, code);
    if (code === "FORBIDDEN") return shareError(400, "BAD_REQUEST");
    // A comment id from another table is refused by Convex's validator.
    if (e instanceof Error && /Validator|ArgumentValidationError|not a valid ID/i.test(e.message))
      return shareError(400, "BAD_REQUEST");
    return shareError(502, "UPSTREAM");
  }
}
