/**
 * The team relay (11.6; decisions §68.3): sync's design (§65) per team.
 *
 * Convex keeps each member laptop's team public key, whether it's in or
 * waiting, the team key sealed to it by a laptop already in, and sealed
 * packages with routing fields only: the kind (`item`: an agent or app being
 * shared; `data`: apps' records) and the sender's role when it was sent.
 * Roles are enforced here before a package is stored, and again on every
 * receiving laptop (the role travels beside the package).
 *
 * Only an owner's or admin's laptop may let a laptop in, after the people
 * compared a code (the laptop's and theirs); Convex can't add a laptop.
 */
import {
  PUBLIC_KEY_PATTERN,
  SYNC_MAX_PACKAGE_BYTES,
  TEAM_LIMITS,
  actionForPackage,
  teamCan,
  type TeamPackageKind,
} from "@titan117/shared";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { audit, coveredMembers, membersOf, membershipOf } from "./lib/teams";
import { brandForUser } from "./teams";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
export const TEAM_KEEP_MS = 30 * DAY;
export const TEAM_UPLOADS_PER_MINUTE = 120;
const PAGE = 20;
const MSG_ID = /^[A-Za-z0-9_-]{8,64}$/;
const SEALED = /^[A-Za-z0-9_-]{40,4000}$/;
const SEALED_NOTE = /^[A-Za-z0-9_-]{40,2000}$/;

type Refusal = { error: "UNAUTHENTICATED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" };

function cleanName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} ._()'-]/gu, "")
      .trim()
      .slice(0, 60) || "Laptop"
  );
}

async function laptopsOf(ctx: QueryCtx, teamId: Id<"teams">) {
  return await ctx.db
    .query("teamLaptops")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .take(300);
}

async function topSeq(ctx: QueryCtx, teamId: Id<"teams">) {
  const last = await ctx.db
    .query("teamChanges")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .order("desc")
    .first();
  return last?.seq ?? 0;
}

async function dropChange(ctx: MutationCtx, row: Doc<"teamChanges">) {
  await ctx.storage.delete(row.storageId);
  await ctx.db.delete(row._id);
}

/** A device of a member the team's plan covers (the owner always is while the plan is usable). */
async function access(ctx: QueryCtx, deviceId: Id<"devices">, teamId: Id<"teams">) {
  const device = await ctx.db.get(deviceId);
  if (!device || device.revokedAt !== undefined) return { error: "UNAUTHENTICATED" } as Refusal;
  const team = await ctx.db.get(teamId);
  const member = team ? await membershipOf(ctx, teamId, device.userId) : null;
  // Another team looks the same as one that doesn't exist.
  if (!team || !member) return { error: "NOT_FOUND" } as Refusal;
  const { plan, covered } = await coveredMembers(ctx, team);
  if (!plan || !covered.has(device.userId)) return { error: "PAYMENT_REQUIRED" } as Refusal;
  return { device, team, member };
}

/** The device's teams, for the laptop's Team screen, with the brand its header shows. */
export const listForDevice = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, { deviceId }) => {
    const device = await ctx.db.get(deviceId);
    if (!device || device.revokedAt !== undefined) return { error: "UNAUTHENTICATED" } as Refusal;
    const out = [];
    for (const m of await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", device.userId))
      .take(100)) {
      const team = await ctx.db.get(m.teamId);
      if (!team) continue;
      const { plan, covered } = await coveredMembers(ctx, team);
      out.push({ id: team._id, name: team.name, role: m.role, active: !!plan && covered.has(device.userId) });
    }
    return { teams: out, brand: await brandForUser(ctx, device.userId) };
  },
});

const keyFor = v.object({ laptopId: v.id("teamLaptops"), sealedKey: v.string(), keyMsgId: v.string() });

/** One call per team every few seconds while the laptop is in it (as sync.laptop). */
export const laptop = internalMutation({
  args: {
    deviceId: v.id("devices"),
    teamId: v.id("teams"),
    on: v.boolean(),
    publicKey: v.optional(v.string()),
    cursor: v.optional(v.number()),
    admit: v.optional(v.object({ laptopId: v.id("teamLaptops"), sealedKey: v.string(), keyMsgId: v.string(), keyGen: v.number() })),
    refuse: v.optional(v.id("teamLaptops")),
    remove: v.optional(v.id("teamLaptops")),
    rekey: v.optional(v.object({ keyGen: v.number(), keys: v.array(keyFor) })),
    resend: v.optional(v.boolean()),
    notes: v.optional(v.array(v.object({ action: v.union(v.literal("item.shared"), v.literal("item.updated"), v.literal("item.removed")), sealed: v.string() }))),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.revokedAt !== undefined) return { error: "UNAUTHENTICATED" } satisfies Refusal;
    let me = await ctx.db
      .query("teamLaptops")
      .withIndex("by_team_device", (q) => q.eq("teamId", args.teamId).eq("deviceId", device._id))
      .unique();

    // Leaving needs nothing: the laptop goes, and a laptop still in changes the key.
    if (!args.on) {
      if (me) await ctx.db.delete(me._id);
      return { on: false as const };
    }
    const got = await access(ctx, device._id, args.teamId);
    if ("error" in got) return got;
    const { team, member } = got;
    const now = Date.now();
    const actor = { userId: device.userId, name: member.name };

    if (me && args.publicKey && args.publicKey !== me.publicKey) {
      await ctx.db.delete(me._id);
      me = null;
    }
    if (!me) {
      if (!args.publicKey || !PUBLIC_KEY_PATTERN.test(args.publicKey)) return { error: "FORBIDDEN" } satisfies Refusal;
      const all = await laptopsOf(ctx, team._id);
      if (all.some((l) => l.publicKey === args.publicKey)) return { error: "FORBIDDEN" } satisfies Refusal;
      if (all.filter((l) => l.userId === device.userId).length >= TEAM_LIMITS.laptopsPerMember)
        return { error: "FORBIDDEN" } satisfies Refusal;
      const anyoneIn = all.some((l) => l.status === "in");
      // The first laptop in a team is its owner's: it makes the key. Anyone else waits to be let in.
      if (!anyoneIn && member.role !== "owner") return { error: "FORBIDDEN" } satisfies Refusal;
      if (!anyoneIn) {
        for (const row of await ctx.db
          .query("teamChanges")
          .withIndex("by_team", (q) => q.eq("teamId", team._id))
          .take(1000))
          await dropChange(ctx, row);
        await ctx.db.patch(team._id, { keyGen: team.keyGen + 1 });
      }
      const fresh = (await ctx.db.get(team._id))!;
      const id = await ctx.db.insert("teamLaptops", {
        teamId: team._id,
        userId: device.userId,
        deviceId: device._id,
        name: cleanName(device.name),
        publicKey: args.publicKey,
        status: anyoneIn ? "waiting" : "in",
        createdAt: now,
        cursor: anyoneIn ? 0 : await topSeq(ctx, team._id),
        ...(anyoneIn ? {} : { keyGen: fresh.keyGen }),
      });
      if (anyoneIn) await audit(ctx, team._id, actor, "laptop.waiting", { targetName: cleanName(device.name) });
      me = (await ctx.db.get(id))!;
    }

    let currentGen = (await ctx.db.get(team._id))!.keyGen;
    let rekeyRefused = false;
    if (me.status === "in") {
      const mayAdmit = teamCan(member.role, "admitLaptop");
      if (args.admit && mayAdmit) {
        const a = args.admit;
        const target = await ctx.db.get(a.laptopId);
        if (
          target &&
          target.teamId === team._id &&
          target.status === "waiting" &&
          SEALED.test(a.sealedKey) &&
          MSG_ID.test(a.keyMsgId) &&
          a.keyGen === currentGen
        ) {
          await ctx.db.patch(target._id, {
            status: "in",
            sealedKey: a.sealedKey,
            sealedBy: me.publicKey,
            keyMsgId: a.keyMsgId,
            keyGen: a.keyGen,
            cursor: await topSeq(ctx, team._id),
          });
          await ctx.db.patch(team._id, { resendAt: now });
          await audit(ctx, team._id, actor, "laptop.admitted", { targetName: target.name });
        }
      }
      if (args.refuse && mayAdmit) {
        const target = await ctx.db.get(args.refuse);
        if (target && target.teamId === team._id && target.status === "waiting") {
          await ctx.db.delete(target._id);
          await audit(ctx, team._id, actor, "laptop.refused", { targetName: target.name });
        }
      }
      if (args.remove && args.remove !== me._id) {
        const target = await ctx.db.get(args.remove);
        // Admins remove any laptop; anyone removes their own others.
        if (target && target.teamId === team._id && (mayAdmit || target.userId === device.userId)) {
          await ctx.db.delete(target._id);
          await audit(ctx, team._id, actor, "laptop.removed", { targetName: target.name });
        }
      }
      if (args.rekey) {
        const { keyGen, keys } = args.rekey;
        const others = (await laptopsOf(ctx, team._id)).filter((l) => l.status === "in" && l._id !== me!._id);
        const covers =
          keys.length === others.length &&
          others.every((o) => keys.some((k) => k.laptopId === o._id)) &&
          keys.every((k) => SEALED.test(k.sealedKey) && MSG_ID.test(k.keyMsgId));
        if (keyGen === currentGen + 1 && covers) {
          for (const k of keys)
            await ctx.db.patch(k.laptopId, { sealedKey: k.sealedKey, sealedBy: me.publicKey, keyMsgId: k.keyMsgId, keyGen });
          await ctx.db.patch(me._id, { keyGen });
          await ctx.db.patch(team._id, { keyGen });
          currentGen = keyGen;
          await audit(ctx, team._id, actor, "key.changed");
        } else rekeyRefused = true;
      }
      if (args.resend) await ctx.db.patch(team._id, { resendAt: now });
      // Notes for the audit log about what was shared, sealed under the team key; only from roles that may share.
      if (args.notes?.length && teamCan(member.role, "shareItems"))
        for (const n of args.notes.slice(0, 10))
          if (SEALED_NOTE.test(n.sealed)) await audit(ctx, team._id, actor, n.action, { sealed: n.sealed });
      const top = await topSeq(ctx, team._id);
      if (args.cursor !== undefined && Number.isInteger(args.cursor) && args.cursor > me.cursor && args.cursor <= top)
        await ctx.db.patch(me._id, { cursor: args.cursor });
    }

    me = (await ctx.db.get(me._id))!;
    const laptops = await laptopsOf(ctx, team._id);
    const members = await membersOf(ctx, team._id);
    const fresh = (await ctx.db.get(team._id))!;

    const inside = laptops.filter((l) => l.status === "in");
    if (inside.length) {
      const readByAll = Math.min(...inside.map((l) => l.cursor));
      for (const row of await ctx.db
        .query("teamChanges")
        .withIndex("by_team", (q) => q.eq("teamId", team._id).lte("seq", readByAll))
        .take(50))
        await dropChange(ctx, row);
    }

    const changes = [];
    if (me.status === "in")
      for (const row of await ctx.db
        .query("teamChanges")
        .withIndex("by_team", (q) => q.eq("teamId", team._id).gt("seq", me!.cursor))
        .take(PAGE)) {
        const own = row.deviceId === device._id;
        changes.push({
          seq: row.seq,
          keyGen: row.keyGen,
          kind: row.kind,
          role: row.role,
          from: row.userId,
          size: row.size,
          own,
          url: own ? null : await ctx.storage.getUrl(row.storageId),
        });
      }

    return {
      on: true as const,
      team: { id: team._id, name: fresh.name, myRole: member.role, myUserId: device.userId },
      me: {
        id: me._id,
        status: me.status,
        keyGen: me.keyGen ?? null,
        sealedKey: me.sealedKey ?? null,
        sealedBy: me.sealedBy ?? null,
        keyMsgId: me.keyMsgId ?? null,
        cursor: me.cursor,
      },
      keyGen: fresh.keyGen,
      rekeyRefused,
      // Each laptop with its person and their role now: receiving laptops check roles again.
      laptops: laptops.map((l) => {
        const who = members.find((m) => m.userId === l.userId);
        return { id: l._id, name: l.name, publicKey: l.publicKey, status: l.status, keyGen: l.keyGen ?? null, person: who?.name ?? "Someone", userId: l.userId, role: who?.role ?? null };
      }),
      people: members.map((m) => ({ userId: m.userId, name: m.name, role: m.role })),
      changes,
      top: await topSeq(ctx, team._id),
      gap: me.status === "in" && (fresh.expiredTop ?? 0) > me.cursor,
      resendAt: fresh.resendAt ?? null,
    };
  },
});

/** Before an upload is stored: a laptop that's in, a role that may send this kind, under the rate. */
export const canUpload = internalQuery({
  args: { deviceId: v.id("devices"), teamId: v.id("teams"), keyGen: v.number(), kind: v.union(v.literal("item"), v.literal("data")), size: v.number() },
  handler: async (ctx, args) => {
    const got = await access(ctx, args.deviceId, args.teamId);
    if ("error" in got) return got.error;
    const me = await ctx.db
      .query("teamLaptops")
      .withIndex("by_team_device", (q) => q.eq("teamId", args.teamId).eq("deviceId", args.deviceId))
      .unique();
    if (!me || me.status !== "in" || args.keyGen !== got.team.keyGen) return "FORBIDDEN" as const;
    if (!teamCan(got.member.role, actionForPackage(args.kind as TeamPackageKind))) return "ROLE" as const;
    if (args.size <= 0 || args.size > SYNC_MAX_PACKAGE_BYTES) return "FORBIDDEN" as const;
    const recent = await ctx.db
      .query("teamChanges")
      .withIndex("by_team_time", (q) => q.eq("teamId", args.teamId).gt("createdAt", Date.now() - MINUTE))
      .take(TEAM_UPLOADS_PER_MINUTE + 1);
    if (recent.length >= TEAM_UPLOADS_PER_MINUTE) return "RATE_LIMITED" as const;
    return "ok" as const;
  },
});

/** A change the sender's role doesn't allow: refused and written in the audit log. */
export const refusedUpload = internalMutation({
  args: { deviceId: v.id("devices"), teamId: v.id("teams") },
  handler: async (ctx, { deviceId, teamId }) => {
    const device = await ctx.db.get(deviceId);
    const member = device ? await membershipOf(ctx, teamId, device.userId) : null;
    if (device && member) await audit(ctx, teamId, { userId: device.userId, name: member.name }, "upload.refused", { role: member.role });
  },
});

/** Records a stored upload, checking everything again; a refused one is deleted from storage. */
export const addChange = internalMutation({
  args: { deviceId: v.id("devices"), teamId: v.id("teams"), keyGen: v.number(), kind: v.union(v.literal("item"), v.literal("data")), size: v.number(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const got = await access(ctx, args.deviceId, args.teamId);
    const me =
      "error" in got
        ? null
        : await ctx.db
            .query("teamLaptops")
            .withIndex("by_team_device", (q) => q.eq("teamId", args.teamId).eq("deviceId", args.deviceId))
            .unique();
    if ("error" in got || !me || me.status !== "in" || args.keyGen !== got.team.keyGen || !teamCan(got.member.role, actionForPackage(args.kind))) {
      await ctx.storage.delete(args.storageId);
      return null;
    }
    const seq = (await topSeq(ctx, args.teamId)) + 1;
    await ctx.db.insert("teamChanges", {
      teamId: args.teamId,
      userId: got.device.userId,
      deviceId: args.deviceId,
      seq,
      keyGen: args.keyGen,
      kind: args.kind,
      role: got.member.role,
      size: args.size,
      storageId: args.storageId,
      createdAt: Date.now(),
    });
    if (me.cursor === seq - 1) await ctx.db.patch(me._id, { cursor: seq });
    return seq;
  },
});

/** Daily (crons.ts): packages nobody read in 30 days go; laptops behind them ask for everything again. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("teamChanges")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", Date.now() - TEAM_KEEP_MS))
      .take(500)) {
      const team = await ctx.db.get(row.teamId);
      if (team && (team.expiredTop ?? 0) < row.seq) await ctx.db.patch(team._id, { expiredTop: row.seq });
      await dropChange(ctx, row);
    }
  },
});
