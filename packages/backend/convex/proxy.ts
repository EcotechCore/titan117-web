/**
 * The credits proxy's two calls into Convex (decisions §12, architecture §5):
 * `begin` before a cloud call, `settle` after it with OpenRouter's cost.
 * The proxy itself is the route in apps/web/app/api/v1/chat/completions.
 * Nothing here sees the prompt or the answer (decisions §32).
 */
import { creditsForCost } from "@titan117/shared";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { deviceByTokenHash } from "./devices";
import { balance, spend } from "./lib/credits";
import { fail, proxyMutation, proxyServerMutation } from "./lib/functions";

/** Calls one user may run at once; more wait (RATE_LIMITED). */
export const MAX_OPEN_CALLS = 4;
/** An open call older than this was lost (the proxy died); it no longer counts as open. */
const STALE_MS = 15 * 60 * 1000;

async function openCall(ctx: MutationCtx, userId: Id<"users">, model: string) {
  const now = Date.now();
  const credits = await balance(ctx, userId, now);
  if (!credits.active) fail("PAYMENT_REQUIRED");
  if (credits.total <= 0) fail("INSUFFICIENT_CREDITS");

  const open = await ctx.db
    .query("proxyCalls")
    .withIndex("by_user_open", (q) => q.eq("userId", userId).eq("settledAt", undefined))
    .collect();
  if (open.filter((c) => now - c.startedAt < STALE_MS).length >= MAX_OPEN_CALLS) fail("RATE_LIMITED");

  const callId = await ctx.db.insert("proxyCalls", { userId, model: model.slice(0, 120), startedAt: now });
  return { callId, credits: credits.total };
}

/** Before a cloud call from the web (a Clerk token): an active plan, credits left, not too many at once. */
export const begin = proxyMutation({
  args: { model: v.string() },
  handler: async (ctx, { model }) => await openCall(ctx, ctx.user._id, model),
});

/**
 * Before a cloud call from the desktop app, which signs its calls with its
 * device token. The proxy sends the token's SHA-256, never the token.
 */
export const beginForDevice = proxyServerMutation({
  args: { tokenHash: v.string(), model: v.string() },
  handler: async (ctx, { tokenHash, model }) => {
    const device = await deviceByTokenHash(ctx, tokenHash);
    if (!device) fail("UNAUTHENTICATED");
    return await openCall(ctx, device.userId, model);
  },
});

/** After the call: charge OpenRouter's cost × 1.25 in credits, once. */
export const settle = proxyServerMutation({
  args: { callId: v.id("proxyCalls"), costUsd: v.number() },
  handler: async (ctx, { callId, costUsd }) => {
    const call = await ctx.db.get(callId);
    if (!call) fail("NOT_FOUND");
    if (call.settledAt !== undefined) return { credits: call.credits ?? 0, duplicate: true };
    const credits = creditsForCost(costUsd);
    const now = Date.now();
    const result = await spend(ctx, call.userId, credits, `proxy:${callId}`, now);
    await ctx.db.patch(callId, { settledAt: now, credits });
    return { credits, shortfall: result.shortfall, duplicate: false };
  },
});
