/**
 * Remote control (decisions §64; security.md A1, A2; guardrails §9).
 *
 * Convex only routes: it keeps public keys, pairings in progress and sealed
 * messages with their routing fields, and checks who may send what to whom.
 * It can't read a command or a result (§32 item 4), and it can't add a key
 * a laptop trusts: only the laptop's own confirmation does that.
 *
 * - The web page (signed in, paid plan) switches remote control on for a
 *   laptop and pairs itself, both with a fresh second factor (actions, since
 *   only an action can verify the Clerk session token, lib/secondFactor.ts).
 * - The browser sends sealed commands to a laptop's key and reads sealed
 *   events addressed to its own key.
 * - The laptop talks through one HTTP route with its device token
 *   (http.ts → `laptopSync`).
 */
import {
  PAIRING_TTL_MS,
  PLANS,
  PUBLIC_KEY_PATTERN,
  REMOTE_MAX_SEALED_BYTES,
  REMOTE_MESSAGE_TTL_MS,
  REMOTE_PROTOCOL_VERSION,
  SECOND_FACTOR_PROOF_TTL_MS,
} from "@titan117/shared";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { entitlementOf, isUsable } from "./lib/credits";
import { fail, paidMutation, paidQuery, userAction, userMutation, userQuery } from "./lib/functions";
import { hasFreshSecondFactor } from "./lib/secondFactor";
import { signSecondFactorProof } from "./lib/tokens";
import { isPushEndpoint, sendPush, vapidPublicKey } from "./lib/webPush";

const MINUTE = 60 * 1000;
/** A laptop counts as online when it looked in this recently. */
const ONLINE_MS = 90 * 1000;
/** Sends per user per minute, browsers and laptops counted apart (guardrails §2: rate limits). */
const BROWSER_SENDS_PER_MINUTE = 60;
const LAPTOP_SENDS_PER_MINUTE = 300;
const MSG_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SEALED = /^[A-Za-z0-9_-]+$/;

function cleanName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} ._()-]/gu, "")
      .trim()
      .slice(0, 60) || "Browser"
  );
}

async function usablePlan(ctx: QueryCtx, userId: Id<"users">) {
  const entitlement = await entitlementOf(ctx, userId);
  return entitlement && isUsable(entitlement, Date.now()) ? entitlement : null;
}

async function keyRow(ctx: QueryCtx, publicKey: string) {
  if (!PUBLIC_KEY_PATTERN.test(publicKey)) return null;
  const row = await ctx.db
    .query("deviceKeys")
    .withIndex("by_publicKey", (q) => q.eq("publicKey", publicKey))
    .first();
  return row && row.revokedAt === undefined ? row : null;
}

async function activeKeys(ctx: QueryCtx, userId: Id<"users">) {
  return (
    await ctx.db
      .query("deviceKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()
  ).filter((k) => k.revokedAt === undefined);
}

async function laptopKeyOf(ctx: QueryCtx, deviceId: Id<"devices">) {
  return (
    await ctx.db
      .query("deviceKeys")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .collect()
  ).find((k) => k.revokedAt === undefined && k.kind === "laptop");
}

async function sentLastMinute(ctx: QueryCtx, userId: Id<"users">, fromKinds: Set<string>, keys: Doc<"deviceKeys">[]) {
  const recent = await ctx.db
    .query("remoteMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId).gt("createdAt", Date.now() - MINUTE))
    .take(LAPTOP_SENDS_PER_MINUTE + 1);
  const kindOf = new Map(keys.map((k) => [k.publicKey, k.kind]));
  return recent.filter((m) => fromKinds.has(kindOf.get(m.from) ?? "")).length;
}

async function insertMessage(
  ctx: MutationCtx,
  userId: Id<"users">,
  m: { from: string; to: string; kind: "command" | "event" | "key"; msgId: string; sealed: string },
) {
  if (!MSG_ID.test(m.msgId) || !SEALED.test(m.sealed)) fail("FORBIDDEN");
  const size = Math.floor((m.sealed.length * 3) / 4);
  if (size > REMOTE_MAX_SEALED_BYTES) fail("FORBIDDEN");
  // One id once: a replayed message is refused here as well as on the laptop.
  const seen = await ctx.db
    .query("remoteMessages")
    .withIndex("by_msgId", (q) => q.eq("msgId", m.msgId))
    .first();
  if (seen) fail("FORBIDDEN");
  const now = Date.now();
  await ctx.db.insert("remoteMessages", { userId, ...m, size, createdAt: now, expiresAt: now + REMOTE_MESSAGE_TTL_MS });
}

// ------------------------------------------------------------ the web page

/** The caller's laptops, whether remote control is on, their key and whether they're online. */
export const laptops = paidQuery({
  args: {},
  handler: async (ctx) => {
    const devices = (
      await ctx.db
        .query("devices")
        .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
        .collect()
    ).filter((d) => d.revokedAt === undefined);
    return await Promise.all(
      devices.map(async (d) => {
        const key = await laptopKeyOf(ctx, d._id);
        return {
          id: d._id,
          name: d.name,
          remoteOn: d.remoteEnabledAt !== undefined,
          publicKey: d.remoteEnabledAt !== undefined ? (key?.publicKey ?? null) : null,
          lastSeenAt: d.lastSeenAt ?? null,
          online: d.lastSeenAt !== undefined && Date.now() - d.lastSeenAt < ONLINE_MS,
        };
      }),
    );
  },
});

/** The browsers and phones paired on this account (no keys' secrets: there are none here). */
export const pairedDevices = paidQuery({
  args: {},
  handler: async (ctx) =>
    (await activeKeys(ctx, ctx.user._id))
      .filter((k) => k.kind !== "laptop")
      .map((k) => ({ publicKey: k.publicKey, name: k.name, kind: k.kind, createdAt: k.createdAt })),
});

/**
 * Switch remote control on for a laptop (decisions §64.5): the caller's own
 * device, a paid plan and a second factor from the last ten minutes. The
 * laptop's own setting turns on when it sees this.
 */
export const enable = userAction({
  args: { deviceId: v.id("devices"), sessionToken: v.string() },
  handler: async (ctx, { deviceId, sessionToken }): Promise<{ ok: true }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !(await hasFreshSecondFactor(sessionToken, identity.subject))) fail("FORBIDDEN");
    await ctx.runMutation(internal.remote.markEnabled, { userId: ctx.userId, deviceId });
    return { ok: true };
  },
});

export const markEnabled = internalMutation({
  args: { userId: v.id("users"), deviceId: v.id("devices") },
  handler: async (ctx, { userId, deviceId }) => {
    const device = await ctx.db.get(deviceId);
    if (!device || device.userId !== userId || device.revokedAt !== undefined) fail("NOT_FOUND");
    if (!(await usablePlan(ctx, userId))) fail("PAYMENT_REQUIRED");
    await ctx.db.patch(deviceId, { remoteEnabledAt: Date.now() });
  },
});

/**
 * A proof of a fresh second factor for one answer to one laptop-only
 * approval (decisions §65.7), from one of the caller's paired browsers or
 * phones. The laptop checks the signature, the account, the device and the
 * approval; it accepts the answer only for a category the user switched on.
 */
export const secondFactorProof = userAction({
  args: { approvalId: v.string(), deviceKey: v.string(), sessionToken: v.string() },
  handler: async (ctx, args): Promise<{ proof: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !(await hasFreshSecondFactor(args.sessionToken, identity.subject))) fail("FORBIDDEN");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(args.approvalId)) fail("FORBIDDEN");
    const ok: boolean = await ctx.runQuery(internal.remote.proofAllowed, { userId: ctx.userId, deviceKey: args.deviceKey });
    if (!ok) fail("FORBIDDEN");
    const now = Date.now();
    return {
      proof: await signSecondFactorProof({
        v: 1,
        kind: "second-factor",
        sub: ctx.userId,
        key: args.deviceKey,
        approval: args.approvalId,
        iat: now,
        exp: now + SECOND_FACTOR_PROOF_TTL_MS,
      }),
    };
  },
});

/** The device key is the user's own paired browser or phone, and the plan is usable. */
export const proofAllowed = internalQuery({
  args: { userId: v.id("users"), deviceKey: v.string() },
  handler: async (ctx, { userId, deviceKey }) => {
    const row = await keyRow(ctx, deviceKey);
    return !!row && row.userId === userId && row.kind !== "laptop" && !!(await usablePlan(ctx, userId));
  },
});

/**
 * Pair this browser or phone (decisions §64.6): the pairing link's id, the
 * device's new public key, a fresh second factor. The laptop still has to
 * confirm the matching code before it trusts the key.
 */
export const claimPairing = userAction({
  args: {
    pairingId: v.id("pairings"),
    publicKey: v.string(),
    name: v.string(),
    kind: v.union(v.literal("browser"), v.literal("phone")),
    sessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ laptopKey: string; laptopName: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !(await hasFreshSecondFactor(args.sessionToken, identity.subject))) fail("FORBIDDEN");
    return await ctx.runMutation(internal.remote.claim, {
      userId: ctx.userId,
      pairingId: args.pairingId,
      publicKey: args.publicKey,
      name: args.name,
      kind: args.kind,
    });
  },
});

export const claim = internalMutation({
  args: {
    userId: v.id("users"),
    pairingId: v.id("pairings"),
    publicKey: v.string(),
    name: v.string(),
    kind: v.union(v.literal("browser"), v.literal("phone")),
  },
  handler: async (ctx, { userId, pairingId, publicKey, name, kind }) => {
    const pairing = await ctx.db.get(pairingId);
    // Someone else's pairing looks the same as one that doesn't exist.
    if (!pairing || pairing.userId !== userId || pairing.status !== "open" || pairing.expiresAt <= Date.now())
      fail("NOT_FOUND");
    const entitlement = await usablePlan(ctx, userId);
    if (!entitlement) fail("PAYMENT_REQUIRED");
    if (!PUBLIC_KEY_PATTERN.test(publicKey)) fail("FORBIDDEN");
    if (await ctx.db
      .query("deviceKeys")
      .withIndex("by_publicKey", (q) => q.eq("publicKey", publicKey))
      .first())
      fail("FORBIDDEN");
    // Device limits are enforced when pairing (guardrails §5): browsers and phones, per plan.
    const limit = entitlement.plan === "custom" ? 25 : PLANS[entitlement.plan].devices;
    const paired = (await activeKeys(ctx, userId)).filter((k) => k.kind !== "laptop").length;
    if (paired >= limit) fail("DEVICE_LIMIT");

    const laptop = await ctx.db.get(pairing.deviceId);
    if (!laptop || laptop.revokedAt !== undefined || laptop.remoteEnabledAt === undefined) fail("NOT_FOUND");
    await ctx.db.insert("deviceKeys", { userId, kind, name: cleanName(name), publicKey, createdAt: Date.now() });
    await ctx.db.patch(pairingId, { status: "claimed", claimedKey: publicKey, claimedName: cleanName(name) });
    await ctx.db.patch(laptop._id, { remoteWakeAt: Date.now() });
    return { laptopKey: pairing.laptopKey, laptopName: laptop.name };
  },
});

/** Whether the laptop has confirmed this browser's pairing yet. */
export const pairingStatus = paidQuery({
  args: { pairingId: v.id("pairings") },
  handler: async (ctx, { pairingId }) => {
    const pairing = await ctx.db.get(pairingId);
    if (!pairing || pairing.userId !== ctx.user._id) return { status: "gone" as const };
    if (pairing.status === "open" && pairing.expiresAt <= Date.now()) return { status: "expired" as const };
    return { status: pairing.status };
  },
});

/** A sealed command from one of the caller's paired browsers or phones to one of their laptops. */
export const send = paidMutation({
  args: { from: v.string(), to: v.string(), msgId: v.string(), sealed: v.string() },
  handler: async (ctx, { from, to, msgId, sealed }) => {
    const sender = await keyRow(ctx, from);
    const recipient = await keyRow(ctx, to);
    if (!sender || sender.userId !== ctx.user._id || sender.kind === "laptop") fail("FORBIDDEN");
    if (!recipient || recipient.userId !== ctx.user._id || recipient.kind !== "laptop" || !recipient.deviceId)
      fail("NOT_FOUND");
    const laptop = await ctx.db.get(recipient.deviceId);
    if (!laptop || laptop.revokedAt !== undefined || laptop.remoteEnabledAt === undefined) fail("FORBIDDEN");
    const keys = await activeKeys(ctx, ctx.user._id);
    if ((await sentLastMinute(ctx, ctx.user._id, new Set(["browser", "phone"]), keys)) >= BROWSER_SENDS_PER_MINUTE)
      fail("RATE_LIMITED");
    await insertMessage(ctx, ctx.user._id, { from, to, kind: "command", msgId, sealed });
    await ctx.db.patch(laptop._id, { remoteWakeAt: Date.now() });
  },
});

/** Sealed events for one of the caller's own keys, oldest first. */
export const inbox = paidQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const me = await keyRow(ctx, key);
    if (!me || me.userId !== ctx.user._id || me.kind === "laptop") return { paired: false as const, messages: [] };
    const messages = await ctx.db
      .query("remoteMessages")
      .withIndex("by_to", (q) => q.eq("to", key))
      .take(100);
    return {
      paired: true as const,
      messages: messages
        .filter((m) => m.expiresAt > Date.now() && m.sealed !== "")
        .map((m) => ({ id: m._id, from: m.from, kind: m.kind, msgId: m.msgId, sealed: m.sealed, createdAt: m.createdAt })),
    };
  },
});

/** The browser has read these: they go. */
export const ack = paidMutation({
  args: { key: v.string(), ids: v.array(v.id("remoteMessages")) },
  handler: async (ctx, { key, ids }) => {
    const me = await keyRow(ctx, key);
    if (!me || me.userId !== ctx.user._id) fail("FORBIDDEN");
    for (const id of ids.slice(0, 200)) {
      const m = await ctx.db.get(id);
      if (m && m.to === key && m.userId === ctx.user._id) await markRead(ctx, m);
    }
  },
});

/** Unpair one browser or phone. The laptop drops it and rotates its own key when it next looks (decisions §64.8). */
export const revokeKey = userMutation({
  args: { publicKey: v.string() },
  handler: async (ctx, { publicKey }) => {
    const row = await keyRow(ctx, publicKey);
    if (!row || row.userId !== ctx.user._id || row.kind === "laptop") fail("NOT_FOUND");
    await ctx.db.patch(row._id, { revokedAt: Date.now() });
    await deleteMessagesTo(ctx, publicKey);
  },
});

/**
 * A read message loses its content at once; its routing row stays an hour so
 * rate limits and the one-id-once rule still count it, then the prune drops it.
 */
async function markRead(ctx: MutationCtx, m: Doc<"remoteMessages">) {
  await ctx.db.patch(m._id, { sealed: "", expiresAt: Math.min(m.expiresAt, Date.now() + 60 * MINUTE) });
}

async function deleteMessagesTo(ctx: MutationCtx, publicKey: string) {
  for (const sub of await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_deviceKey", (q) => q.eq("deviceKey", publicKey))
    .collect())
    await ctx.db.delete(sub._id);
  for (const m of await ctx.db
    .query("remoteMessages")
    .withIndex("by_to", (q) => q.eq("to", publicKey))
    .take(500))
    await ctx.db.delete(m._id);
}

/**
 * "Revoke all devices" (decisions §64.8): every browser and phone key goes,
 * every waiting message and pairing goes, and laptops see the time, unlink
 * their chat channels and rotate their keys. Needs no second factor:
 * revoking only takes access away.
 */
export const revokeAll = userMutation({
  args: {},
  handler: async (ctx) => {
    await revokeAllFor(ctx, ctx.user._id);
  },
});

export async function revokeAllFor(ctx: MutationCtx, userId: Id<"users">) {
  const now = Date.now();
  for (const k of await activeKeys(ctx, userId)) {
    if (k.kind !== "laptop") await ctx.db.patch(k._id, { revokedAt: now });
  }
  for (const m of await ctx.db
    .query("remoteMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(1000))
    await ctx.db.delete(m._id);
  for (const p of await ctx.db
    .query("pairings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect())
    await ctx.db.delete(p._id);
  for (const sub of await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect())
    await ctx.db.delete(sub._id);
  await ctx.db.patch(userId, { remoteRevokedAllAt: now });
}

// ------------------------------------------------------------ Web Push

/** Our VAPID public key, for the browser's subscription; null until the owner set the keys. */
export const pushKey = userQuery({ args: {}, handler: async () => vapidPublicKey() });

/** Notifications on this paired browser or phone: keeps only the push service's address. */
export const subscribePush = paidMutation({
  args: { key: v.string(), endpoint: v.string() },
  handler: async (ctx, { key, endpoint }) => {
    const me = await keyRow(ctx, key);
    if (!me || me.userId !== ctx.user._id || me.kind === "laptop") fail("FORBIDDEN");
    if (!isPushEndpoint(endpoint)) fail("FORBIDDEN");
    for (const old of await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_deviceKey", (q) => q.eq("deviceKey", key))
      .collect())
      await ctx.db.delete(old._id);
    await ctx.db.insert("pushSubscriptions", { userId: ctx.user._id, deviceKey: key, endpoint, createdAt: Date.now() });
  },
});

export const unsubscribePush = userMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    for (const sub of await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_deviceKey", (q) => q.eq("deviceKey", key))
      .collect())
      if (sub.userId === ctx.user._id) await ctx.db.delete(sub._id);
  },
});

/** At most one push a minute per device; the page shows what's new when opened. */
const PUSH_GAP_MS = 60 * 1000;

export const pushTarget = internalMutation({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_deviceKey", (q) => q.eq("deviceKey", deviceKey))
      .first();
    if (!sub || (sub.lastPushAt && Date.now() - sub.lastPushAt < PUSH_GAP_MS)) return null;
    await ctx.db.patch(sub._id, { lastPushAt: Date.now() });
    return { id: sub._id, endpoint: sub.endpoint };
  },
});

export const dropSubscription = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});

export const push = internalAction({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) => {
    const target = await ctx.runMutation(internal.remote.pushTarget, { deviceKey });
    if (!target) return;
    if ((await sendPush(target.endpoint)) === "gone") await ctx.runMutation(internal.remote.dropSubscription, { id: target.id });
  },
});

/** For tests and the portal later: whether a device has notifications on. */
export const hasPush = internalQuery({
  args: { deviceKey: v.string() },
  handler: async (ctx, { deviceKey }) =>
    !!(await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_deviceKey", (q) => q.eq("deviceKey", deviceKey))
      .first()),
});

// ------------------------------------------------------------ the laptop (http.ts)

const outgoing = v.object({
  to: v.string(),
  kind: v.union(v.literal("event"), v.literal("key")),
  msgId: v.string(),
  sealed: v.string(),
  // Wake the device with a push that says only "Titan117 needs you" (decisions §64.10).
  notify: v.optional(v.boolean()),
});

/**
 * Everything a laptop does in one call, made every few seconds while remote
 * control is on: register its key, say whether its own setting is on, send
 * sealed events, drop what it has read, open or answer a pairing, and get
 * what's waiting for it.
 */
export const laptopSync = internalMutation({
  args: {
    deviceId: v.id("devices"),
    on: v.boolean(),
    laptopKey: v.optional(v.string()),
    outgoing: v.array(outgoing),
    ack: v.array(v.id("remoteMessages")),
    startPairing: v.optional(v.boolean()),
    answerPairing: v.optional(v.object({ pairingId: v.id("pairings"), accept: v.boolean() })),
    // Removing devices and "Revoke all" from the laptop itself (decisions §64.8).
    revokeKeys: v.optional(v.array(v.string())),
    revokeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.revokedAt !== undefined) return { error: "UNAUTHENTICATED" as const };
    const now = Date.now();
    const userId = device.userId;
    // Switching off on the laptop needs no second factor, and Convex follows at once.
    if (!args.on && device.remoteEnabledAt !== undefined) await ctx.db.patch(device._id, { remoteEnabledAt: undefined });
    if (!device.lastSeenAt || now - device.lastSeenAt > 30_000) await ctx.db.patch(device._id, { lastSeenAt: now });
    // Taking access away works with or without a plan.
    if (args.revokeAll) await revokeAllFor(ctx, userId);
    for (const publicKey of (args.revokeKeys ?? []).slice(0, 25)) {
      const row = await keyRow(ctx, publicKey);
      if (row && row.userId === userId && row.kind !== "laptop") {
        await ctx.db.patch(row._id, { revokedAt: now });
        await deleteMessagesTo(ctx, publicKey);
      }
    }
    if (!(await usablePlan(ctx, userId))) return { error: "PAYMENT_REQUIRED" as const };
    const user = await ctx.db.get(userId);
    const enabled = args.on && device.remoteEnabledAt !== undefined;
    const base = {
      v: REMOTE_PROTOCOL_VERSION,
      enabled,
      wakeAt: device.remoteWakeAt ?? null,
      revokedAllAt: user?.remoteRevokedAllAt ?? null,
    };
    if (!enabled) return { ...base, inbox: [], keys: [], pairings: [], openPairing: null };

    // The laptop's own key: one active at a time; a new one (rotation) replaces the old.
    let laptopKey = await laptopKeyOf(ctx, device._id);
    if (args.laptopKey && args.laptopKey !== laptopKey?.publicKey) {
      if (!PUBLIC_KEY_PATTERN.test(args.laptopKey)) return { error: "FORBIDDEN" as const };
      if (await ctx.db
        .query("deviceKeys")
        .withIndex("by_publicKey", (q) => q.eq("publicKey", args.laptopKey!))
        .first())
        return { error: "FORBIDDEN" as const };
      if (laptopKey) await ctx.db.patch(laptopKey._id, { revokedAt: now });
      const id = await ctx.db.insert("deviceKeys", {
        userId,
        kind: "laptop",
        deviceId: device._id,
        name: device.name,
        publicKey: args.laptopKey,
        createdAt: now,
      });
      laptopKey = (await ctx.db.get(id))!;
    }
    if (!laptopKey) return { ...base, inbox: [], keys: [], pairings: [], openPairing: null };

    const keys = await activeKeys(ctx, userId);
    const own = new Set(keys.filter((k) => k.kind !== "laptop").map((k) => k.publicKey));
    if (args.outgoing.length > 50) return { error: "FORBIDDEN" as const };
    if (args.outgoing.length) {
      const sent = await sentLastMinute(ctx, userId, new Set(["laptop"]), keys);
      if (sent + args.outgoing.length > LAPTOP_SENDS_PER_MINUTE) return { error: "RATE_LIMITED" as const };
    }
    const wake = new Set<string>();
    for (const { notify, ...m } of args.outgoing) {
      // Only to this account's own paired browsers and phones (a revoked one gets nothing).
      if (!own.has(m.to)) continue;
      await insertMessage(ctx, userId, { from: laptopKey.publicKey, ...m });
      if (notify) wake.add(m.to);
    }
    for (const deviceKey of wake) await ctx.scheduler.runAfter(0, internal.remote.push, { deviceKey });
    for (const id of args.ack.slice(0, 200)) {
      const m = await ctx.db.get(id);
      if (m && m.to === laptopKey.publicKey) await markRead(ctx, m);
    }

    let openPairing: { id: Id<"pairings">; expiresAt: number } | null = null;
    if (args.startPairing) {
      const id = await ctx.db.insert("pairings", {
        userId,
        deviceId: device._id,
        laptopKey: laptopKey.publicKey,
        expiresAt: now + PAIRING_TTL_MS,
        status: "open",
      });
      openPairing = { id, expiresAt: now + PAIRING_TTL_MS };
    }
    if (args.answerPairing) {
      const p = await ctx.db.get(args.answerPairing.pairingId);
      if (p && p.deviceId === device._id && p.status === "claimed") {
        await ctx.db.patch(p._id, { status: args.answerPairing.accept ? "confirmed" : "refused" });
        // A refused key is removed at once.
        if (!args.answerPairing.accept && p.claimedKey) {
          const row = await keyRow(ctx, p.claimedKey);
          if (row) await ctx.db.patch(row._id, { revokedAt: now });
        }
      }
    }

    const pairings = (
      await ctx.db
        .query("pairings")
        .withIndex("by_device", (q) => q.eq("deviceId", device._id))
        .collect()
    )
      .filter((p) => p.status === "claimed" && p.expiresAt > now - PAIRING_TTL_MS)
      .map((p) => ({ id: p._id, publicKey: p.claimedKey!, name: p.claimedName ?? "Browser" }));

    const inbox = (
      await ctx.db
        .query("remoteMessages")
        .withIndex("by_to", (q) => q.eq("to", laptopKey!.publicKey))
        .take(50)
    )
      .filter((m) => m.expiresAt > now && m.sealed !== "")
      .map((m) => ({ id: m._id, from: m.from, kind: m.kind, msgId: m.msgId, sealed: m.sealed, createdAt: m.createdAt }));

    return {
      ...base,
      laptopKey: laptopKey.publicKey,
      inbox,
      keys: keys.filter((k) => k.kind !== "laptop").map((k) => ({ publicKey: k.publicKey, name: k.name, kind: k.kind })),
      pairings,
      openPairing,
    };
  },
});

/** Hourly (crons.ts): expired messages and pairings go. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const m of await ctx.db
      .query("remoteMessages")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(1000))
      await ctx.db.delete(m._id);
    for (const p of await ctx.db
      .query("pairings")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now - PAIRING_TTL_MS))
      .take(500))
      await ctx.db.delete(p._id);
  },
});
