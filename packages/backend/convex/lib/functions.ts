/**
 * The Convex guardrail (docs/guardrails.md §2): every check happens here,
 * before data leaves the server, whoever the caller is.
 *
 * Public functions are built only from these wrappers. ESLint blocks the raw
 * `query`, `mutation` and `action` builders (and their Generic versions)
 * outside convex/lib. Internal functions and httpAction are not callable from
 * clients and stay allowed.
 *
 * Every paid, device or admin function needs a denial test; the coverage test
 * in checks/guardrails.test.ts fails for one without.
 */
import type { ErrorCode } from "@titan117/shared";
import { ConvexError, v } from "convex/values";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";

import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { action, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** Errors are codes from @titan117/shared (guardrails §2), never stack traces or other users' data. */
export function fail(code: ErrorCode): never {
  throw new ConvexError(code);
}

export async function getCurrentUserOrNull(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireUser(ctx: Ctx) {
  const user = await getCurrentUserOrNull(ctx);
  if (!user) fail("UNAUTHENTICATED");
  return user;
}

export async function requirePlan(ctx: Ctx) {
  const user = await requireUser(ctx);
  const entitlement = await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if (!entitlement || entitlement.activeUntil <= Date.now()) fail("PAYMENT_REQUIRED");
  return { user, entitlement };
}

export async function requireDevice(ctx: Ctx, deviceId: Id<"devices">) {
  const user = await requireUser(ctx);
  const device = await ctx.db.get(deviceId);
  // Another user's device looks the same as one that doesn't exist.
  if (!device || device.userId !== user._id) fail("NOT_FOUND");
  if (device.revokedAt !== undefined) fail("FORBIDDEN");
  return { user, device };
}

/** Staff stay admitted this long after confirming a second factor (decisions §65.8). */
export const STAFF_SECOND_FACTOR_MS = 8 * 60 * 60 * 1000;

/**
 * Whether a staff member confirmed a second factor recently enough. Convex
 * never sees Clerk's `fva` claim, so the portal confirms it through
 * `staff.confirmSecondFactor` (an action that verifies the session token)
 * and the time is kept on the user. PORTAL_TWO_FACTOR set to exactly
 * `off-until-clerk-pro` skips this until Clerk Pro (decisions §37).
 */
export function staffSecondFactorFresh(user: { staffSecondFactorAt?: number }, now: number) {
  if (process.env.PORTAL_TWO_FACTOR === "off-until-clerk-pro") return true;
  const at = user.staffSecondFactorAt;
  return typeof at === "number" && at <= now && now - at <= STAFF_SECOND_FACTOR_MS;
}

export async function requireAdmin(ctx: Ctx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin") fail("FORBIDDEN");
  if (!staffSecondFactorFresh(user, Date.now())) fail("FORBIDDEN");
  return { user };
}

/** Anyone. Only for data that is truly public (marketplace listings, shared artifacts by link). */
export const publicQuery = query;

/**
 * Signed in with Clerk, whether or not the `users` row exists yet. Adds
 * `ctx.identity`. Only for creating that row (users.ensureUser); everything
 * else uses userQuery / userMutation.
 */
export const identityMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) fail("UNAUTHENTICATED");
    return { identity };
  }),
);

/** A signed-in user. Adds `ctx.user`. */
export const userQuery = customQuery(query, customCtx(async (ctx) => ({ user: await requireUser(ctx) })));
export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
);

/** For userAction: actions can't read the database, so they ask through this. */
export const userIdByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) =>
    (
      await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
        .unique()
    )?._id ?? null,
});

/** A signed-in user, in an action (for calls to Stripe). Adds `ctx.userId`. */
export const userAction = customAction(
  action,
  customCtx(async (ctx): Promise<{ userId: Id<"users"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) fail("UNAUTHENTICATED");
    const userId: Id<"users"> | null = await ctx.runQuery(internal.lib.functions.userIdByClerkId, { clerkId: identity.subject });
    if (!userId) fail("UNAUTHENTICATED");
    return { userId };
  }),
);

/** A user with an active plan. Adds `ctx.user` and `ctx.entitlement`. */
export const paidQuery = customQuery(query, customCtx(requirePlan));
export const paidMutation = customMutation(mutation, customCtx(requirePlan));

/**
 * A paired, not revoked desktop engine of the signed-in user. Takes a
 * `deviceId` argument; adds `ctx.user` and `ctx.device`.
 */
const deviceArgs = { deviceId: v.id("devices") };
export const deviceQuery = customQuery(query, {
  args: deviceArgs,
  input: async (ctx, { deviceId }) => ({ ctx: await requireDevice(ctx, deviceId), args: {} }),
});
export const deviceMutation = customMutation(mutation, {
  args: deviceArgs,
  input: async (ctx, { deviceId }) => ({ ctx: await requireDevice(ctx, deviceId), args: {} }),
});

/**
 * An admin with a verified second factor (guardrails §12b). The role is set
 * only from the Convex CLI. Writing the `adminAudit` row comes with that
 * table in phase 5.
 */
export const adminQuery = customQuery(query, customCtx(requireAdmin));
export const adminMutation = customMutation(mutation, customCtx(requireAdmin));

/**
 * Only our own server (the credits proxy on Vercel) knows PROXY_SECRET, kept
 * in both deployments' environments (guardrails §8). Compared in constant time.
 */
export function isProxySecret(given: string) {
  const expected = process.env.PROXY_SECRET ?? "";
  if (expected.length < 32 || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/**
 * Called by the credits proxy on behalf of a signed-in user: needs both the
 * user's own token (Convex checks it) and our server's secret, so neither a
 * user alone nor a leaked secret alone can open a call. Adds `ctx.user`.
 */
export const proxyMutation = customMutation(mutation, {
  args: { proxySecret: v.string() },
  input: async (ctx, { proxySecret }) => {
    if (!isProxySecret(proxySecret)) fail("FORBIDDEN");
    return { ctx: { user: await requireUser(ctx) }, args: {} };
  },
});

/** Called by the credits proxy alone, to close a call it opened. Needs our server's secret. */
export const proxyServerMutation = customMutation(mutation, {
  args: { proxySecret: v.string() },
  input: async (_ctx, { proxySecret }) => {
    if (!isProxySecret(proxySecret)) fail("FORBIDDEN");
    return { ctx: {}, args: {} };
  },
});
