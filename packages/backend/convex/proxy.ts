/**
 * The credits proxy's two calls into Convex (decisions §12, architecture §5):
 * `begin` before a cloud call, `settle` after it with OpenRouter's cost.
 * The proxy itself is the route in apps/web/app/api/v1/chat/completions.
 * Nothing here sees the prompt or the answer (decisions §32).
 */
import { creditsForCost } from "@titan117/shared";
import { v } from "convex/values";

import { balance, spend } from "./lib/credits";
import { fail, proxyMutation, proxyServerMutation } from "./lib/functions";

/** Calls one user may run at once; more wait (RATE_LIMITED). */
export const MAX_OPEN_CALLS = 4;
/** An open call older than this was lost (the proxy died); it no longer counts as open. */
const STALE_MS = 15 * 60 * 1000;

/** Before a cloud call: an active plan, credits left, and not too many calls at once. */
export const begin = proxyMutation({
  args: { model: v.string() },
  handler: async (ctx, { model }) => {
    const now = Date.now();
    const credits = await balance(ctx, ctx.user._id, now);
    if (!credits.active) fail("PAYMENT_REQUIRED");
    if (credits.total <= 0) fail("INSUFFICIENT_CREDITS");

    const open = await ctx.db
      .query("proxyCalls")
      .withIndex("by_user_open", (q) => q.eq("userId", ctx.user._id).eq("settledAt", undefined))
      .collect();
    if (open.filter((c) => now - c.startedAt < STALE_MS).length >= MAX_OPEN_CALLS) fail("RATE_LIMITED");

    const callId = await ctx.db.insert("proxyCalls", { userId: ctx.user._id, model: model.slice(0, 120), startedAt: now });
    return { callId, credits: credits.total };
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
