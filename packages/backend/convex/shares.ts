/**
 * Share links (feature 17.13, decisions §30 and §44). The desktop app makes a
 * self-contained HTML snapshot of an artifact and uploads it through our web
 * app's `/api/v1/shares` route, which signs these calls with our server's
 * secret and the device token's SHA-256. Anyone with the random public id can
 * view the page; the owner unshares it from the app, staff take it down after
 * a report (the Digital Services Act's notice and action).
 */
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { deviceByTokenHash } from "./devices";
import { entitlementOf, isUsable } from "./lib/credits";
import { adminMutation, adminQuery, fail, proxyServerMutation, publicQuery } from "./lib/functions";

/** Limits per user (decisions §44); storage counts towards the plan. */
export const MAX_SHARE_BYTES = 5 * 1024 * 1024;
export const MAX_SHARES = 100;
export const MAX_SHARES_PER_DAY = 30;
/** Reports one page may collect in a day before more are refused (an abuse of the button). */
export const MAX_REPORTS_PER_DAY = 50;
const DAY = 24 * 60 * 60 * 1000;

const PUBLIC_ID = /^[A-Za-z0-9_-]{22}$/;

/** 128 random bits, URL-safe: the link is the only key to the page. */
function newPublicId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function deviceUser(ctx: QueryCtx, tokenHash: string) {
  const device = await deviceByTokenHash(ctx, tokenHash);
  if (!device) fail("UNAUTHENTICATED");
  // Sharing is a paid feature, checked on every call (guardrails §3).
  if (!isUsable(await entitlementOf(ctx, device.userId), Date.now())) fail("PAYMENT_REQUIRED");
  return device.userId;
}

async function sharesOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("sharedArtifacts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

async function checkLimits(ctx: QueryCtx, userId: Id<"users">, bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_SHARE_BYTES) fail("FORBIDDEN");
  const mine = (await sharesOf(ctx, userId)).filter((s) => s.takenDownAt === undefined);
  if (mine.length >= MAX_SHARES) fail("RATE_LIMITED");
  const since = Date.now() - DAY;
  if (mine.filter((s) => s.createdAt > since).length >= MAX_SHARES_PER_DAY) fail("RATE_LIMITED");
}

function clean(text: string, max: number) {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

/** Step 1, from our server: may this device share a page this big? Gives an upload address. */
export const beginForDevice = proxyServerMutation({
  args: { tokenHash: v.string(), bytes: v.number() },
  handler: async (ctx, { tokenHash, bytes }) => {
    const userId = await deviceUser(ctx, tokenHash);
    await checkLimits(ctx, userId, bytes);
    return { uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

/** Step 2, from our server: the snapshot is uploaded; make the link. */
export const finishForDevice = proxyServerMutation({
  args: { tokenHash: v.string(), storageId: v.id("_storage"), title: v.string(), kind: v.string() },
  handler: async (ctx, { tokenHash, storageId, title, kind }) => {
    let userId: Id<"users">;
    let bytes: number;
    try {
      userId = await deviceUser(ctx, tokenHash);
      const file = await ctx.db.system.get(storageId);
      if (!file) fail("NOT_FOUND");
      bytes = file.size;
      await checkLimits(ctx, userId, bytes);
    } catch (error) {
      // Nothing is kept from a refused share. A thrown error would roll the
      // deletion back with everything else, so the refusal is returned instead.
      if (!(error instanceof ConvexError)) throw error;
      await ctx.storage.delete(storageId).catch(() => {});
      return { ok: false as const, code: String(error.data), publicId: null };
    }
    const publicId = newPublicId();
    await ctx.db.insert("sharedArtifacts", {
      userId,
      publicId,
      title: clean(title, 200) || "Untitled",
      kind: clean(kind, 30) || "document",
      bytes,
      storageId,
      createdAt: Date.now(),
    });
    return { ok: true as const, code: null, publicId };
  },
});

async function removeShare(ctx: MutationCtx, share: Doc<"sharedArtifacts">) {
  if (share.storageId) await ctx.storage.delete(share.storageId).catch(() => {});
  await ctx.db.delete(share._id);
}

/** The owner unshares from the app: the snapshot and its row go at once. */
export const removeForDevice = proxyServerMutation({
  args: { tokenHash: v.string(), publicId: v.string() },
  handler: async (ctx, { tokenHash, publicId }) => {
    const device = await deviceByTokenHash(ctx, tokenHash);
    if (!device) fail("UNAUTHENTICATED");
    const share = await byPublicId(ctx, publicId);
    // Another user's page looks the same as one that doesn't exist.
    if (!share || share.userId !== device.userId) fail("NOT_FOUND");
    // A page staff took down stays as the record of that decision.
    if (share.takenDownAt === undefined) await removeShare(ctx, share);
    return { ok: true };
  },
});

async function byPublicId(ctx: QueryCtx, publicId: string) {
  if (!PUBLIC_ID.test(publicId)) return null;
  return await ctx.db
    .query("sharedArtifacts")
    .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
    .unique();
}

/**
 * Anyone with the link (guardrails §2: shared artifacts by link are public).
 * Only the title, type, date and the snapshot's address; never the owner.
 */
export const view = publicQuery({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const share = await byPublicId(ctx, publicId);
    if (!share) return null;
    if (share.takenDownAt !== undefined || !share.storageId)
      return { state: "removed" as const, title: null, kind: null, createdAt: null, url: null };
    return {
      state: "live" as const,
      title: share.title,
      kind: share.kind,
      createdAt: share.createdAt,
      url: await ctx.storage.getUrl(share.storageId),
    };
  },
});

/** A report from the Report button, through our server's route. */
export const report = proxyServerMutation({
  args: {
    publicId: v.string(),
    reason: v.union(
      v.literal("illegal"),
      v.literal("privacy"),
      v.literal("copyright"),
      v.literal("abuse"),
      v.literal("other"),
    ),
    note: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { publicId, reason, note, email }) => {
    const share = await byPublicId(ctx, publicId);
    if (!share) fail("NOT_FOUND");
    const since = Date.now() - DAY;
    const recent = await ctx.db
      .query("shareReports")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .collect();
    if (recent.filter((r) => r.at > since).length >= MAX_REPORTS_PER_DAY) fail("RATE_LIMITED");
    const mail = email ? clean(email, 200) : "";
    await ctx.db.insert("shareReports", {
      publicId,
      reason,
      note: clean(note, 2000),
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? { email: mail } : {}),
      at: Date.now(),
    });
    return { ok: true };
  },
});

/** Staff: reports waiting for a decision, oldest first. */
export const openReports = adminQuery({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db
      .query("shareReports")
      .withIndex("by_handledAt", (q) => q.eq("handledAt", undefined))
      .collect();
    return open.sort((a, b) => a.at - b.at).slice(0, 200);
  },
});

/**
 * Staff: decide on a page's reports. "removed" deletes the snapshot and keeps
 * the row with the reason (the statement of reasons); "kept" leaves it live.
 */
export const decide = adminMutation({
  args: {
    publicId: v.string(),
    decision: v.union(v.literal("removed"), v.literal("kept")),
    reason: v.string(),
  },
  handler: async (ctx, { publicId, decision, reason }) => {
    const share = await byPublicId(ctx, publicId);
    if (!share) fail("NOT_FOUND");
    const now = Date.now();
    if (decision === "removed" && share.takenDownAt === undefined) {
      if (share.storageId) await ctx.storage.delete(share.storageId).catch(() => {});
      await ctx.db.patch(share._id, { storageId: undefined, takenDownAt: now, takedownReason: clean(reason, 2000) });
    }
    const reports = await ctx.db
      .query("shareReports")
      .withIndex("by_publicId", (q) => q.eq("publicId", publicId))
      .collect();
    for (const r of reports) if (r.handledAt === undefined) await ctx.db.patch(r._id, { handledAt: now, decision });
    return { ok: true };
  },
});
