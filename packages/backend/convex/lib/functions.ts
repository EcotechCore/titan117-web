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
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";

import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";

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

/**
 * Clerk's `fva` claim: minutes since the first and second factor were
 * verified, -1 when the second factor never was (clerk.com/docs, session
 * tokens, checked 9 Nov 2026). The Convex JWT template must carry it; wired up
 * with the portal in phase 5.
 */
export function hasSecondFactor(identity: Record<string, unknown>) {
  const fva = identity.fva;
  return Array.isArray(fva) && typeof fva[1] === "number" && fva[1] >= 0;
}

export async function requireAdmin(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  const user = await requireUser(ctx);
  if (user.role !== "admin") fail("FORBIDDEN");
  if (!identity || !hasSecondFactor(identity)) fail("FORBIDDEN");
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
