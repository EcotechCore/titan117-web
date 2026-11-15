/**
 * The `users` row: only the Clerk user id (and, for staff, the admin role set
 * from the Convex CLI). Name, email and picture stay in Clerk, which already
 * holds them; nothing is copied that we don't need (guardrails §12,
 * decisions §32).
 *
 * The row is created right after sign-in by `ensureUser`, from the session
 * token, because Clerk's webhooks can arrive late, twice or out of order
 * (clerk.com/docs, syncing with webhooks, checked 12 Nov 2026). The webhook
 * (http.ts) covers sign-ups that never reach the app, and deletions.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { removeBilling } from "./lib/billing";
import { identityMutation, userQuery } from "./lib/functions";

async function findByClerkId(ctx: MutationCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .unique();
}

async function insertOnce(ctx: MutationCtx, clerkId: string) {
  const existing = await findByClerkId(ctx, clerkId);
  return existing?._id ?? (await ctx.db.insert("users", { clerkId }));
}

/** Creates the caller's row if it doesn't exist yet. Safe to call on every sign-in. */
export const ensureUser = identityMutation({
  args: {},
  handler: async (ctx) => await insertOnce(ctx, ctx.identity.subject),
});

/** What the apps need to know about the signed-in user. Nothing from other users. */
export const me = userQuery({
  args: {},
  handler: async (ctx) => ({ isAdmin: ctx.user.role === "admin" }),
});

/** Clerk webhook: user.created (and user.updated, which may arrive first). Idempotent. */
export const upsertFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    await insertOnce(ctx, clerkId);
  },
});

/**
 * Clerk webhook: user.deleted. Removes the user's rows from every table that
 * holds them (the data table in decisions §11). Idempotent. The grace period
 * before Clerk's own deletion comes with account deletion in phase 2.
 */
export const deleteFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await findByClerkId(ctx, clerkId);
    if (!user) return;
    // Billing rows and credits; then the Stripe customer itself, so nothing keeps charging,
    // however the account was deleted (here, or from Clerk's own profile screen).
    const customers = await removeBilling(ctx, user._id);
    if (customers.length) await ctx.scheduler.runAfter(0, internal.account.deleteStripeCustomers, { customerIds: customers });
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of devices) await ctx.db.delete(row._id);
    const signIns = await ctx.db
      .query("deviceSignIns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of signIns) await ctx.db.delete(row._id);
    const calls = await ctx.db
      .query("proxyCalls")
      .withIndex("by_user_open", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of calls) await ctx.db.delete(row._id);
    // Shared pages and their snapshots (decisions §44).
    const shares = await ctx.db
      .query("sharedArtifacts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of shares) {
      if (row.storageId) await ctx.storage.delete(row.storageId).catch(() => {});
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(user._id);
  },
});
