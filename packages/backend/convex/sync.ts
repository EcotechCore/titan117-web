/**
 * Sync between the user's own laptops (decisions §58.12, §65; §32: sync, end
 * to end encrypted).
 *
 * Convex only relays. It keeps each laptop's sync public key, whether the
 * laptop is in or waiting, the account's sync key sealed to each laptop by a
 * laptop already in, and sealed packages (sidebar apps' records and
 * conversations) in file storage with routing fields only. It can't open a
 * package or the key, and it can't let a laptop in: a laptop already in seals
 * the key to it after the user compared a code on both.
 *
 * The laptop talks through two HTTP routes with its device token (http.ts):
 * `/desktop/sync` (`laptop` below) and `/desktop/sync/package` (an upload).
 */
import { PUBLIC_KEY_PATTERN, SYNC_MAX_PACKAGE_BYTES } from "@titan117/shared";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { entitlementOf, isUsable } from "./lib/credits";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
/** A package nobody read goes after this long (decisions §65.6). */
export const SYNC_KEEP_MS = 30 * DAY;
/** Uploads per account per minute (guardrails §2: rate limits). */
export const SYNC_UPLOADS_PER_MINUTE = 120;
/** Packages handed to a laptop per call. */
const PAGE = 20;
const MSG_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SEALED = /^[A-Za-z0-9_-]{40,4000}$/;
const MAX_MEMBERS = 10;

type Refusal = { error: "UNAUTHENTICATED" | "PAYMENT_REQUIRED" | "FORBIDDEN" };

function cleanName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} ._()'-]/gu, "")
      .trim()
      .slice(0, 60) || "Laptop"
  );
}

async function membersOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("syncMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_MEMBERS + 5);
}

async function memberOfDevice(ctx: QueryCtx, deviceId: Id<"devices">) {
  return await ctx.db
    .query("syncMembers")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .first();
}

async function topSeq(ctx: QueryCtx, userId: Id<"users">) {
  const last = await ctx.db
    .query("syncChanges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  return last?.seq ?? 0;
}

async function usable(ctx: QueryCtx, userId: Id<"users">) {
  const entitlement = await entitlementOf(ctx, userId);
  return !!entitlement && isUsable(entitlement, Date.now());
}

async function dropChange(ctx: MutationCtx, row: Doc<"syncChanges">) {
  await ctx.storage.delete(row.storageId);
  await ctx.db.delete(row._id);
}

/** Every package of an account (a new key with nobody left to read the old ones, account deletion). */
export async function dropAllChanges(ctx: MutationCtx, userId: Id<"users">) {
  for (const row of await ctx.db
    .query("syncChanges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(1000))
    await dropChange(ctx, row);
}

/** A laptop signed out or the account's devices removed: it leaves sync (devices.ts, users.ts). */
export async function leaveSync(ctx: MutationCtx, deviceId: Id<"devices">) {
  const me = await memberOfDevice(ctx, deviceId);
  if (me) await ctx.db.delete(me._id);
}

const keyFor = v.object({ memberId: v.id("syncMembers"), sealedKey: v.string(), keyMsgId: v.string() });

/**
 * Everything a laptop does in one call while sync is on: join or leave, let
 * a waiting laptop in (with the key sealed to it) or refuse it, remove a
 * laptop, hand out a new key generation, move its read cursor, ask for
 * everything again, and get the packages after its cursor.
 */
export const laptop = internalMutation({
  args: {
    deviceId: v.id("devices"),
    on: v.boolean(),
    publicKey: v.optional(v.string()),
    cursor: v.optional(v.number()),
    admit: v.optional(v.object({ memberId: v.id("syncMembers"), sealedKey: v.string(), keyMsgId: v.string(), keyGen: v.number() })),
    refuse: v.optional(v.id("syncMembers")),
    remove: v.optional(v.id("syncMembers")),
    rekey: v.optional(v.object({ keyGen: v.number(), keys: v.array(keyFor) })),
    resend: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.revokedAt !== undefined) return { error: "UNAUTHENTICATED" } satisfies Refusal;
    const userId = device.userId;
    const now = Date.now();
    let me = await memberOfDevice(ctx, device._id);

    // Switching off needs nothing, plan or not: the laptop leaves, and a laptop still in changes the key.
    if (!args.on) {
      if (me) await ctx.db.delete(me._id);
      return { on: false as const };
    }
    if (!(await usable(ctx, userId))) return { error: "PAYMENT_REQUIRED" } satisfies Refusal;
    const user = (await ctx.db.get(userId))!;

    // A laptop with a new sync key (its keychain lost the old one) joins again from the start.
    if (me && args.publicKey && args.publicKey !== me.publicKey) {
      await ctx.db.delete(me._id);
      me = null;
    }
    if (!me) {
      if (!args.publicKey || !PUBLIC_KEY_PATTERN.test(args.publicKey)) return { error: "FORBIDDEN" } satisfies Refusal;
      const members = await membersOf(ctx, userId);
      if (members.length >= MAX_MEMBERS || members.some((m) => m.publicKey === args.publicKey))
        return { error: "FORBIDDEN" } satisfies Refusal;
      const anyoneIn = members.some((m) => m.status === "in");
      let keyGen: number | undefined;
      if (!anyoneIn) {
        // The first laptop makes the key; packages under an older key have nobody left to read them.
        keyGen = (user.syncKeyGen ?? 0) + 1;
        await ctx.db.patch(userId, { syncKeyGen: keyGen });
        await dropAllChanges(ctx, userId);
      }
      const id = await ctx.db.insert("syncMembers", {
        userId,
        deviceId: device._id,
        name: cleanName(device.name),
        publicKey: args.publicKey,
        status: anyoneIn ? "waiting" : "in",
        createdAt: now,
        cursor: anyoneIn ? 0 : await topSeq(ctx, userId),
        ...(keyGen ? { keyGen } : {}),
      });
      me = (await ctx.db.get(id))!;
    }

    let currentGen = (await ctx.db.get(userId))!.syncKeyGen ?? 1;
    let rekeyRefused = false;
    if (me.status === "in") {
      if (args.admit) {
        const a = args.admit;
        const target = await ctx.db.get(a.memberId);
        if (
          target &&
          target.userId === userId &&
          target.status === "waiting" &&
          SEALED.test(a.sealedKey) &&
          MSG_ID.test(a.keyMsgId) &&
          a.keyGen === currentGen
        ) {
          // Everyone sends everything again, so the new laptop gets it all.
          await ctx.db.patch(target._id, {
            status: "in",
            sealedKey: a.sealedKey,
            sealedBy: me.publicKey,
            keyMsgId: a.keyMsgId,
            keyGen: a.keyGen,
            cursor: await topSeq(ctx, userId),
          });
          await ctx.db.patch(userId, { syncResendAt: now });
        }
      }
      if (args.refuse) {
        const target = await ctx.db.get(args.refuse);
        if (target && target.userId === userId && target.status === "waiting") await ctx.db.delete(target._id);
      }
      if (args.remove && args.remove !== me._id) {
        const target = await ctx.db.get(args.remove);
        if (target && target.userId === userId) await ctx.db.delete(target._id);
      }
      if (args.rekey) {
        const { keyGen, keys } = args.rekey;
        const others = (await membersOf(ctx, userId)).filter((m) => m.status === "in" && m._id !== me!._id);
        const covers =
          keys.length === others.length &&
          others.every((o) => keys.some((k) => k.memberId === o._id)) &&
          keys.every((k) => SEALED.test(k.sealedKey) && MSG_ID.test(k.keyMsgId));
        // Only the next generation, and only once: the first laptop to change the key wins.
        if (keyGen === currentGen + 1 && covers) {
          for (const k of keys)
            await ctx.db.patch(k.memberId, { sealedKey: k.sealedKey, sealedBy: me.publicKey, keyMsgId: k.keyMsgId, keyGen });
          await ctx.db.patch(me._id, { keyGen });
          await ctx.db.patch(userId, { syncKeyGen: keyGen });
          currentGen = keyGen;
        } else rekeyRefused = true;
      }
      if (args.resend) await ctx.db.patch(userId, { syncResendAt: now });
      const top = await topSeq(ctx, userId);
      if (args.cursor !== undefined && Number.isInteger(args.cursor) && args.cursor > me.cursor && args.cursor <= top)
        await ctx.db.patch(me._id, { cursor: args.cursor });
    }

    me = (await ctx.db.get(me._id))!;
    const members = await membersOf(ctx, userId);
    const fresh = (await ctx.db.get(userId))!;

    // A package every laptop in has read is gone (decisions §11: syncChanges).
    const inside = members.filter((m) => m.status === "in");
    if (inside.length) {
      const readByAll = Math.min(...inside.map((m) => m.cursor));
      for (const row of await ctx.db
        .query("syncChanges")
        .withIndex("by_user", (q) => q.eq("userId", userId).lte("seq", readByAll))
        .take(50))
        await dropChange(ctx, row);
    }

    const changes: { seq: number; keyGen: number; size: number; own: boolean; url: string | null }[] = [];
    if (me.status === "in")
      for (const row of await ctx.db
        .query("syncChanges")
        .withIndex("by_user", (q) => q.eq("userId", userId).gt("seq", me!.cursor))
        .take(PAGE)) {
        const own = row.deviceId === device._id;
        changes.push({ seq: row.seq, keyGen: row.keyGen, size: row.size, own, url: own ? null : await ctx.storage.getUrl(row.storageId) });
      }

    return {
      on: true as const,
      me: {
        id: me._id,
        status: me.status,
        keyGen: me.keyGen ?? null,
        sealedKey: me.sealedKey ?? null,
        sealedBy: me.sealedBy ?? null,
        keyMsgId: me.keyMsgId ?? null,
        cursor: me.cursor,
      },
      keyGen: fresh.syncKeyGen ?? 1,
      rekeyRefused,
      members: members.map((m) => ({ id: m._id, name: m.name, publicKey: m.publicKey, status: m.status, keyGen: m.keyGen ?? null })),
      changes,
      top: await topSeq(ctx, userId),
      // Packages this laptop never read were dropped at 30 days: it asks for everything again.
      gap: me.status === "in" && (fresh.syncExpiredTop ?? 0) > me.cursor,
      resendAt: fresh.syncResendAt ?? null,
    };
  },
});

/** Before an upload is stored: a laptop that's in, under the rate limit. */
export const canUpload = internalQuery({
  args: { deviceId: v.id("devices"), keyGen: v.number(), size: v.number() },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.revokedAt !== undefined) return "UNAUTHENTICATED" as const;
    if (!(await usable(ctx, device.userId))) return "PAYMENT_REQUIRED" as const;
    const me = await memberOfDevice(ctx, device._id);
    const user = await ctx.db.get(device.userId);
    if (!me || me.status !== "in" || args.keyGen !== (user?.syncKeyGen ?? 1)) return "FORBIDDEN" as const;
    if (args.size <= 0 || args.size > SYNC_MAX_PACKAGE_BYTES) return "FORBIDDEN" as const;
    const recent = await ctx.db
      .query("syncChanges")
      .withIndex("by_user_time", (q) => q.eq("userId", device.userId).gt("createdAt", Date.now() - MINUTE))
      .take(SYNC_UPLOADS_PER_MINUTE + 1);
    if (recent.length >= SYNC_UPLOADS_PER_MINUTE) return "RATE_LIMITED" as const;
    return "ok" as const;
  },
});

/** Records a stored upload; a refused one is deleted from storage again. */
export const addChange = internalMutation({
  args: { deviceId: v.id("devices"), keyGen: v.number(), size: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    const me = device && device.revokedAt === undefined ? await memberOfDevice(ctx, device._id) : null;
    const user = device ? await ctx.db.get(device.userId) : null;
    if (!device || !me || me.status !== "in" || args.keyGen !== (user?.syncKeyGen ?? 1)) {
      await ctx.storage.delete(args.storageId);
      return null;
    }
    const seq = (await topSeq(ctx, device.userId)) + 1;
    await ctx.db.insert("syncChanges", {
      userId: device.userId,
      deviceId: device._id,
      seq,
      keyGen: args.keyGen,
      size: args.size,
      storageId: args.storageId,
      createdAt: Date.now(),
    });
    // The sender has its own package already.
    if (me.cursor === seq - 1) await ctx.db.patch(me._id, { cursor: seq });
    return seq;
  },
});

/** Daily (crons.ts): packages nobody read in 30 days go; laptops behind them ask for everything again. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("syncChanges")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - SYNC_KEEP_MS))
      .take(500)) {
      const user = await ctx.db.get(row.userId);
      if (user && (user.syncExpiredTop ?? 0) < row.seq) await ctx.db.patch(user._id, { syncExpiredTop: row.seq });
      await dropChange(ctx, row);
    }
  },
});
