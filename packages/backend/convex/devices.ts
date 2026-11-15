/**
 * Desktop sign-in and devices (decisions §17, §39; architecture §6):
 *
 * 1. The app opens /desktop/sign-in in the browser with a PKCE challenge and
 *    the port it listens on at 127.0.0.1.
 * 2. The signed-in user confirms; `startSignIn` makes a one-time code, kept
 *    hashed, valid five minutes, bound to that challenge. The page hands it
 *    to the app on this laptop.
 * 3. The app sends the code and its PKCE verifier to /desktop/exchange
 *    (http.ts) and receives a device token, kept in the OS keychain. We keep
 *    only the token's SHA-256.
 * 4. With that token the app fetches its signed licence lease
 *    (/desktop/lease) and calls the credits proxy.
 */
import { LEASE_OFFLINE_DAYS, PLANS, type LeasePayload } from "@titan117/shared";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { entitlementOf, isUsable } from "./lib/credits";
import { fail, userAction, userMutation, userQuery } from "./lib/functions";
import { randomToken, sha256Hex } from "./lib/tokens";

const CODE_TTL_MS = 5 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function cleanName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} ._()-]/gu, "")
      .trim()
      .slice(0, 60) || "Desktop"
  );
}

async function activeDevices(ctx: QueryCtx, userId: Id<"users">) {
  return (
    await ctx.db
      .query("devices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  ).filter((d) => d.revokedAt === undefined);
}

// --- For the web app ---

/** The caller's signed-in devices for the account page. Never the token or its hash. */
export const list = userQuery({
  args: {},
  handler: async (ctx) =>
    (await activeDevices(ctx, ctx.user._id)).map((d) => ({
      id: d._id,
      name: d.name,
      createdAt: d.createdAt ?? d._creationTime,
      lastSeenAt: d.lastSeenAt ?? null,
    })),
});

/** Signs a device out for good: its token stops working and its next lease check locks it. */
export const revoke = userMutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const device = await ctx.db.get(deviceId);
    // Another user's device looks the same as one that doesn't exist.
    if (!device || device.userId !== ctx.user._id) fail("NOT_FOUND");
    if (device.revokedAt === undefined) await ctx.db.patch(deviceId, { revokedAt: Date.now() });
  },
});

/** Step 2: the signed-in user approved this laptop; returns the one-time code for the app. */
export const startSignIn = userAction({
  args: { challenge: v.string(), name: v.string() },
  handler: async (ctx, { challenge, name }): Promise<{ code: string }> => {
    // A PKCE S256 challenge is 43 base64url characters.
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) fail("FORBIDDEN");
    const code = randomToken();
    await ctx.runMutation(internal.devices.storeSignIn, {
      userId: ctx.userId,
      codeHash: await sha256Hex(code),
      challenge,
      name: cleanName(name),
    });
    return { code };
  },
});

export const storeSignIn = internalMutation({
  args: { userId: v.id("users"), codeHash: v.string(), challenge: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("deviceSignIns", { ...args, expiresAt: Date.now() + CODE_TTL_MS });
  },
});

// --- For the desktop app (through http.ts) ---

/**
 * Step 3: a valid, unused, unexpired code whose challenge matches the app's
 * verifier becomes a device. The token is made by the HTTP action; only its
 * hash arrives here.
 */
export const redeemSignIn = internalMutation({
  args: { codeHash: v.string(), challengeFromVerifier: v.string(), tokenHash: v.string(), appVersion: v.string() },
  handler: async (ctx, { codeHash, challengeFromVerifier, tokenHash, appVersion }) => {
    const now = Date.now();
    const signIn = await ctx.db
      .query("deviceSignIns")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (!signIn || signIn.usedAt !== undefined || signIn.expiresAt <= now) return { error: "NOT_FOUND" as const };
    // Used once, even when the verifier is wrong: a stolen code can't be retried.
    await ctx.db.patch(signIn._id, { usedAt: now });
    if (signIn.challenge !== challengeFromVerifier) return { error: "FORBIDDEN" as const };

    const entitlement = await entitlementOf(ctx, signIn.userId);
    if (entitlement && isUsable(entitlement, now) && entitlement.plan !== "custom") {
      const allowed = PLANS[entitlement.plan].devices;
      if ((await activeDevices(ctx, signIn.userId)).length >= allowed) return { error: "DEVICE_LIMIT" as const };
    }
    const deviceId = await ctx.db.insert("devices", {
      userId: signIn.userId,
      name: signIn.name,
      tokenHash,
      createdAt: now,
      lastSeenAt: now,
      appVersion: appVersion.slice(0, 40),
    });
    return { deviceId };
  },
});

/** The device behind a token, or null for an unknown or signed-out one. */
export async function deviceByTokenHash(ctx: QueryCtx, tokenHash: string) {
  const device = await ctx.db
    .query("devices")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  return device && device.revokedAt === undefined ? device : null;
}

/**
 * Step 4: what this device's lease should say right now, and when it was
 * last seen. Unknown or signed-out devices get null.
 */
export const leaseFor = internalMutation({
  args: { tokenHash: v.string(), appVersion: v.string() },
  handler: async (ctx, { tokenHash, appVersion }): Promise<LeasePayload | null> => {
    const device = await deviceByTokenHash(ctx, tokenHash);
    if (!device) return null;
    const now = Date.now();
    await ctx.db.patch(device._id, { lastSeenAt: now, appVersion: appVersion.slice(0, 40) });

    const entitlement = await entitlementOf(ctx, device.userId);
    const base = { v: 1 as const, sub: device.userId, dev: device._id, iat: now };
    if (!entitlement || !isUsable(entitlement, now)) return { ...base, plan: null, devices: 0, exp: now };

    // A plan that renews may be used offline for the full 14 days; one that is
    // ending (cancelled, or a payment failing) never past its last usable moment.
    const offline = now + LEASE_OFFLINE_DAYS * DAY;
    const renews = !entitlement.cancelAtPeriodEnd && entitlement.status === "active";
    return {
      ...base,
      plan: entitlement.plan,
      devices: entitlement.plan === "custom" ? 0 : PLANS[entitlement.plan].devices,
      exp: renews ? offline : Math.min(offline, entitlement.activeUntil),
    };
  },
});

/** Daily (crons.ts): expired sign-in codes go. */
export const pruneSignIns = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const old = await ctx.db
      .query("deviceSignIns")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now() - DAY))
      .take(500);
    for (const row of old) await ctx.db.delete(row._id);
  },
});
