/**
 * Error reports (features 19.1-19.11; decisions §22, §45). The desktop app
 * sends a report the user has read in full, through our web app's
 * `/api/v1/error-reports` route, which signs the call with our server's
 * secret and the device token's SHA-256. Reports are grouped by signature for
 * the product owner portal, kept 90 days and deleted with the account.
 */
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { deviceByTokenHash } from "./devices";
import { adminMutation, adminQuery, fail, proxyServerMutation } from "./lib/functions";

export const KEEP_DAYS = 90;
/** Reports one user may send in a day; more are refused (RATE_LIMITED). */
export const MAX_REPORTS_PER_DAY = 20;
const DAY = 24 * 60 * 60 * 1000;
const MAX_LOG_LINES = 80;

/**
 * A second line of defence (guardrails §8): the app redacts before the user
 * sees the report, and anything shaped like a key or token is scrubbed here
 * again before it is stored.
 */
const SECRETS: RegExp[] = [
  /sk-or-v1-[0-9a-zA-Z]{8,}/g,
  /sk-ant-[0-9A-Za-z_-]{8,}/g,
  /sk-(?:proj-)?[0-9A-Za-z_-]{20,}/g,
  /sk_(?:live|test)_[0-9A-Za-z]{8,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /gh[pousr]_[0-9A-Za-z]{20,}/g,
  /github_pat_[0-9A-Za-z_]{20,}/g,
  /hf_[0-9A-Za-z]{20,}/g,
  /xox[abprs]-[0-9A-Za-z-]{10,}/g,
  /t117d_[0-9A-Za-z_-]{16,}/g,
  /eyJ[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function scrub(text: string, max: number) {
  let out = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  for (const pattern of SECRETS) out = out.replace(pattern, "[redacted]");
  return out.slice(0, max);
}

/**
 * The same error from different laptops gets the same signature: the
 * feature, the message with numbers, quoted text and addresses taken out, and
 * the first frames of the stack without paths or line numbers.
 */
export function signatureOf(feature: string, message: string, stack: string) {
  const msg = message
    .replace(/(["'`]).*?\1/g, "…")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8,}/gi, "#")
    .replace(/\d+/g, "#")
    .trim()
    .slice(0, 200);
  const frames = stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at "))
    .slice(0, 3)
    .map((l) =>
      l
        .replace(/\(.*\)$/, "")
        .replace(/[A-Za-z]:\\[^\s)]*|\/[^\s)]*/g, "")
        .replace(/:\d+:\d+/g, "")
        .trim(),
    );
  return `${feature}|${msg}|${frames.join("|")}`;
}

/** A short code the user can quote to support, e.g. T117-4F2A9C. */
function newRef() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `T117-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase().slice(0, 6)}`;
}

function remember(list: string[], value: string) {
  return list.includes(value) ? list : [...list, value].slice(-20);
}

async function deviceUserId(ctx: QueryCtx, tokenHash: string): Promise<Id<"users">> {
  const device = await deviceByTokenHash(ctx, tokenHash);
  // Any signed-in device may report, with or without an active plan: a locked app can break too.
  if (!device) fail("UNAUTHENTICATED");
  return device.userId;
}

/** A report the user read and chose to send, through our server's route. */
export const submitForDevice = proxyServerMutation({
  args: {
    tokenHash: v.string(),
    appVersion: v.string(),
    os: v.string(),
    feature: v.string(),
    message: v.string(),
    stack: v.string(),
    logLines: v.array(v.string()),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await deviceUserId(ctx, args.tokenHash);
    const now = Date.now();
    const today = await ctx.db
      .query("errorReports")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gt(q.field("at"), now - DAY))
      .collect();
    if (today.length >= MAX_REPORTS_PER_DAY) fail("RATE_LIMITED");

    const report = {
      appVersion: scrub(args.appVersion, 40),
      os: scrub(args.os, 80),
      feature: scrub(args.feature, 60) || "app",
      message: scrub(args.message, 2000),
      stack: scrub(args.stack, 8000),
      logLines: args.logLines.slice(-MAX_LOG_LINES).map((l) => scrub(l, 1000)),
      note: scrub(args.note, 4000),
    };
    const signature = signatureOf(report.feature, report.message, report.stack);
    let group = await ctx.db
      .query("errorGroups")
      .withIndex("by_signature", (q) => q.eq("signature", signature))
      .unique();
    if (!group) {
      const groupId = await ctx.db.insert("errorGroups", {
        signature,
        feature: report.feature,
        title: (report.message || report.note || "A problem report").slice(0, 160),
        count: 0,
        firstSeen: now,
        lastSeen: now,
        versions: [],
        os: [],
      });
      group = (await ctx.db.get(groupId))!;
    }
    await ctx.db.patch(group._id, {
      count: group.count + 1,
      lastSeen: now,
      versions: remember(group.versions, report.appVersion),
      os: remember(group.os, report.os),
    });
    const ref = newRef();
    await ctx.db.insert("errorReports", { userId, groupId: group._id, ref, at: now, ...report });
    return { ref };
  },
});

/** "Fixed in 1.4, update now?" (19.5): which of this device's reports a release has fixed. */
export const fixedForDevice = proxyServerMutation({
  args: { tokenHash: v.string(), refs: v.array(v.string()) },
  handler: async (ctx, { tokenHash, refs }) => {
    const userId = await deviceUserId(ctx, tokenHash);
    const out: { ref: string; fixedIn: string }[] = [];
    for (const ref of refs.slice(0, 50)) {
      const report = await ctx.db
        .query("errorReports")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .unique();
      // Another user's reference looks like an unknown one.
      if (!report || report.userId !== userId) continue;
      const group = await ctx.db.get(report.groupId);
      if (group?.fixedIn) out.push({ ref, fixedIn: group.fixedIn });
    }
    return out;
  },
});

/** Staff: the groups, most recent first (the portal's error screen, phase 5). */
export const groups = adminQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db.query("errorGroups").withIndex("by_lastSeen").order("desc").take(200)
    ).map((g) => {
      const out: Partial<typeof g> = { ...g };
      delete out.signature;
      return out;
    }),
});

/** Staff: the reports in one group, newest first. The user is shown only as their report's ref. */
export const groupReports = adminQuery({
  args: { groupId: v.id("errorGroups") },
  handler: async (ctx, { groupId }) => {
    const rows = await ctx.db
      .query("errorReports")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(100);
    return rows.map((r) => {
      const out: Partial<typeof r> = { ...r };
      delete out.userId;
      return out;
    });
  },
});

/** Staff: link a group to the release that fixed it, and its issue (19.5, 19.9). */
export const markFixed = adminMutation({
  args: { groupId: v.id("errorGroups"), fixedIn: v.string(), issueUrl: v.optional(v.string()) },
  handler: async (ctx, { groupId, fixedIn, issueUrl }) => {
    const group = await ctx.db.get(groupId);
    if (!group) fail("NOT_FOUND");
    if (!/^\d+\.\d+(\.\d+)?$/.test(fixedIn)) fail("FORBIDDEN");
    await ctx.db.patch(groupId, {
      fixedIn,
      ...(issueUrl && /^https:\/\//.test(issueUrl) ? { issueUrl: issueUrl.slice(0, 300) } : {}),
    });
    return { ok: true };
  },
});

/** Daily (crons.ts): reports older than 90 days go; groups keep their counts. */
export const prune = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const old = await ctx.db
      .query("errorReports")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - KEEP_DAYS * DAY))
      .take(500);
    for (const row of old) await ctx.db.delete(row._id);
    return { deleted: old.length };
  },
});
