/**
 * Staff's second factor (decisions §65.8, §37; guardrails §12b). Convex never
 * sees Clerk's `fva` claim, so `requireAdmin` can't read it: the portal sends
 * the staff member's Clerk session token here, this action verifies a second
 * factor from the last ten minutes with Clerk's own library, and the time is
 * kept on the user. `requireAdmin` admits an admin for 8 hours after it.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { fail, STAFF_SECOND_FACTOR_MS, userAction } from "./lib/functions";
import { hasFreshSecondFactor } from "./lib/secondFactor";

export const confirmSecondFactor = userAction({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ until: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !(await hasFreshSecondFactor(sessionToken, identity.subject, "PORTAL_TWO_FACTOR"))) fail("FORBIDDEN");
    return await ctx.runMutation(internal.staff.markSecondFactor, { userId: ctx.userId });
  },
});

export const markSecondFactor = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    // Only staff: anyone else gets the same refusal as a missing second factor.
    if (!user || user.role !== "admin") fail("FORBIDDEN");
    const now = Date.now();
    await ctx.db.patch(userId, { staffSecondFactorAt: now });
    return { until: now + STAFF_SECOND_FACTOR_MS };
  },
});
