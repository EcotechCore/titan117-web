/**
 * Deleting an account (decisions §11, §42; privacy policy "How long we keep it"):
 *
 * 1. The user asks on the account page. Deletion is set for 30 days later and
 *    the plan stops renewing, so they aren't charged again; what they paid
 *    for keeps working until its period ends.
 * 2. Until then one click cancels it (and renewal comes back, if asking had
 *    stopped it).
 * 3. A daily run deletes what's due: the Stripe customer (which ends its
 *    subscriptions; Stripe keeps invoices as the law requires), the Clerk
 *    user, then every row in our database (users.deleteFromClerk, which
 *    follows the data table in decisions §11).
 */
import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { entitlementOf } from "./lib/credits";
import { userAction, userQuery } from "./lib/functions";
import { isActiveStatus, stripe, StripeError } from "./lib/stripe";

export const GRACE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
/** Accounts deleted per daily run; the rest wait for the next. */
const BATCH = 25;

/** For the account page. */
export const deletionStatus = userQuery({
  args: {},
  handler: async (ctx) => ({ deleteAfter: ctx.user.deleteAfter ?? null }),
});

export const markDeletion = internalMutation({
  args: { userId: v.id("users"), at: v.union(v.number(), v.null()) },
  handler: async (ctx, { userId, at }) => {
    const user = (await ctx.db.get(userId))!;
    const entitlement = await entitlementOf(ctx, userId);
    const renewing =
      !!entitlement?.subscriptionId &&
      !!entitlement.status &&
      isActiveStatus(entitlement.status) &&
      !entitlement.cancelAtPeriodEnd;
    if (at === null) {
      // Cancelling: renewal comes back only if asking had stopped it.
      const restore = user.deletionStoppedRenewal === true && !!entitlement?.subscriptionId;
      await ctx.db.patch(userId, { deleteAfter: undefined, deletionStoppedRenewal: undefined });
      return { subscriptionId: restore ? entitlement!.subscriptionId! : null };
    }
    if (user.deleteAfter !== undefined) return { subscriptionId: null, deleteAfter: user.deleteAfter };
    await ctx.db.patch(userId, { deleteAfter: at, deletionStoppedRenewal: renewing });
    return { subscriptionId: renewing ? entitlement!.subscriptionId! : null, deleteAfter: at };
  },
});

async function setRenewal(subscriptionId: string, renew: boolean) {
  // The webhook then records the change on the entitlement, as for any plan change.
  await stripe("POST", `/subscriptions/${subscriptionId}`, { cancel_at_period_end: !renew });
}

/** Asks for the account to be deleted in 30 days; stops the plan renewing. */
export const requestDeletion = userAction({
  args: {},
  handler: async (ctx): Promise<{ deleteAfter: number }> => {
    const at = Date.now() + GRACE_DAYS * DAY;
    const result = await ctx.runMutation(internal.account.markDeletion, { userId: ctx.userId, at });
    if (result.subscriptionId) await setRenewal(result.subscriptionId, false);
    return { deleteAfter: result.deleteAfter ?? at };
  },
});

/** Changes the user's mind back: no deletion, and renewal as it was. */
export const cancelDeletion = userAction({
  args: {},
  handler: async (ctx): Promise<null> => {
    const result = await ctx.runMutation(internal.account.markDeletion, { userId: ctx.userId, at: null });
    if (result.subscriptionId) await setRenewal(result.subscriptionId, true);
    return null;
  },
});

// --- The daily run (crons.ts) ---

export const due = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_deleteAfter", (q) => q.gt("deleteAfter", 0).lte("deleteAfter", Date.now()))
      .take(BATCH);
    return rows.map((u) => ({ userId: u._id, clerkId: u.clerkId }));
  },
});

/** Stripe customers can't be deleted from a mutation (no network there); this does it. */
export const deleteStripeCustomers = internalAction({
  args: { customerIds: v.array(v.string()) },
  handler: async (_ctx, { customerIds }) => {
    for (const id of customerIds) {
      try {
        await stripe("DELETE", `/customers/${id}`);
      } catch (error) {
        // Already gone is fine; anything else is retried by the next run's own delete.
        if (!(error instanceof StripeError && error.status === 404)) throw error;
      }
    }
  },
});

async function deleteClerkUser(clerkId: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set in the Convex environment");
  try {
    await createClerkClient({ secretKey }).users.deleteUser(clerkId);
  } catch (error) {
    // Already deleted in Clerk.
    if ((error as { status?: number }).status === 404) return;
    throw error;
  }
}

/** Daily: deletes every account whose 30 days are over. */
export const purgeDue = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const accounts: { userId: Id<"users">; clerkId: string }[] = await ctx.runQuery(internal.account.due, {});
    for (const { clerkId } of accounts) {
      // Clerk first: once it's gone nobody can sign in, then our rows (and, from
      // deleteFromClerk, the Stripe customer). Clerk's own user.deleted webhook
      // runs the same idempotent deletion.
      await deleteClerkUser(clerkId);
      await ctx.runMutation(internal.users.deleteFromClerk, { clerkId });
    }
    return accounts.length;
  },
});
