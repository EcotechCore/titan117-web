/**
 * Credits outside the webhook: the daily grant and expiry run, and the
 * charge the credits proxy makes after a cloud call (phase 2, proxy part).
 * All internal: no client can grant or charge credits.
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { balance, grantDue, spend, sweepExpired } from "./lib/credits";

const DAY = 24 * 60 * 60 * 1000;
// Expiries older than this were swept on an earlier run.
const SWEEP_WINDOW = 40 * DAY;

/** Daily (crons.ts): monthly credits for every plan that has a month due, then expiries. */
export const daily = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let granted = 0;
    const due = await ctx.db
      .query("entitlements")
      .withIndex("by_nextGrantAt", (q) => q.gt("nextGrantAt", 0).lte("nextGrantAt", now))
      .take(500);
    for (const entitlement of due) granted += await grantDue(ctx, entitlement, now);

    const users = new Set<string>();
    const expiring = await ctx.db
      .query("creditBuckets")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now - SWEEP_WINDOW).lte("expiresAt", now))
      .collect();
    let expired = 0;
    for (const bucket of expiring) {
      if (bucket.remaining <= 0 || users.has(bucket.userId)) continue;
      users.add(bucket.userId);
      expired += await sweepExpired(ctx, bucket.userId, now);
    }
    return { granted, expired };
  },
});

/** For the credits proxy: may this user start a cloud call? */
export const available = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await balance(ctx, userId, Date.now()),
});

/** For the credits proxy: charge a finished call. Idempotent by the request id. */
export const charge = internalMutation({
  args: { userId: v.id("users"), credits: v.number(), ref: v.string() },
  handler: async (ctx, { userId, credits, ref }) => await spend(ctx, userId, credits, ref, Date.now()),
});
