/**
 * The marketplace's listing (features 10.3, 10.10; decisions §66.3, §66.11).
 * A public GitHub repository joins by having the `titan117-addon` topic and a
 * valid `titan.json` on its default branch. Every hour we search GitHub for
 * the topic and read each new or changed repository's `titan.json`. We keep
 * only the listing: the code stays on GitHub, and the laptop downloads it
 * from there, pinned to a commit, with its own checks (decisions §66.4).
 *
 * Without a token GitHub allows 10 searches a minute and 60 other calls an
 * hour per address, so one run reads at most READS_PER_RUN repositories.
 */
import { ADDON_TOPIC, ADDON_TYPES, parseAddonManifest } from "@titan117/shared";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { adminMutation, adminQuery, fail, publicQuery, userMutation } from "./lib/functions";

const GITHUB = "https://api.github.com";
/** Two calls each (the commit and titan.json); stays well under 60 an hour. */
export const READS_PER_RUN = 20;
/** Search pages per run (100 results each; GitHub returns the first 1,000 at most). */
const SEARCH_PAGES = 10;
export const MAX_REPORTS_PER_DAY = 10;
const DAY = 24 * 60 * 60 * 1000;
const FULL_NAME = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;

type Fetch = typeof fetch;
let fetcher: Fetch = (...args) => fetch(...args);
/** For tests: GitHub's answers. */
export function setGitHubFetch(f: Fetch | null) {
  fetcher = f ?? ((...args) => fetch(...args));
}

function clean(text: string, max: number) {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

/** What anyone may see of a listing. */
function publicView(item: Doc<"marketItems">) {
  return {
    fullName: item.fullName,
    owner: item.owner,
    repo: item.repo,
    name: item.name,
    type: item.type,
    title: item.title,
    version: item.version,
    description: item.description,
    license: item.license,
    stars: item.stars,
    commit: item.commit,
    pushedAt: item.pushedAt,
    verified: item.verifiedAt !== undefined,
    verifiedCommit: item.verifiedCommit ?? null,
  };
}

// ---------------------------------------------------------------- public

/** The listing: search, type, verified first, then stars. Taken-down items never show. */
export const list = publicQuery({
  args: { q: v.optional(v.string()), type: v.optional(v.string()) },
  handler: async (ctx, { q, type }) => {
    if (type !== undefined && !(ADDON_TYPES as readonly string[]).includes(type)) return [];
    const words = clean(q ?? "", 100)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const items = await ctx.db.query("marketItems").withIndex("by_stars").order("desc").take(2000);
    return items
      .filter((i) => i.takenDownAt === undefined)
      .filter((i) => !type || i.type === type)
      .filter((i) => {
        const hay = `${i.fullName} ${i.title} ${i.description} ${i.name}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(b.verifiedAt !== undefined) - Number(a.verifiedAt !== undefined) || b.stars - a.stars)
      .slice(0, 200)
      .map(publicView);
  },
});

/** One listing, or null when it isn't listed (or was taken down). */
export const get = publicQuery({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const item = await byFullName(ctx, fullName);
    return item && item.takenDownAt === undefined ? publicView(item) : null;
  },
});

/**
 * What the laptop checks before installing (decisions §66.11): whether we took
 * it down, and which commit staff verified. Public: a takedown is public anyway.
 */
export const status = publicQuery({
  args: { fullName: v.string() },
  handler: async (ctx, { fullName }) => {
    const item = await byFullName(ctx, fullName);
    if (!item) return { listed: false, takenDown: false, verifiedCommit: null };
    return {
      listed: item.takenDownAt === undefined,
      takenDown: item.takenDownAt !== undefined,
      verifiedCommit: item.verifiedCommit ?? null,
    };
  },
});

async function byFullName(ctx: { db: import("./_generated/server").QueryCtx["db"] }, fullName: string) {
  const key = fullName.trim().toLowerCase();
  if (!FULL_NAME.test(key)) return null;
  return await ctx.db
    .query("marketItems")
    .withIndex("by_fullName", (q) => q.eq("fullName", key))
    .unique();
}

/** Anyone signed in may report an item; ten a day, one open report per item. */
export const report = userMutation({
  args: {
    fullName: v.string(),
    reason: v.union(v.literal("malware"), v.literal("security"), v.literal("licence"), v.literal("spam"), v.literal("other")),
    note: v.string(),
  },
  handler: async (ctx, { fullName, reason, note }) => {
    const item = await byFullName(ctx, fullName);
    if (!item || item.takenDownAt !== undefined) fail("NOT_FOUND");
    const now = Date.now();
    const mine = await ctx.db
      .query("marketReports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", ctx.user._id).gt("at", now - DAY))
      .collect();
    if (mine.length >= MAX_REPORTS_PER_DAY) fail("RATE_LIMITED");
    const open = await ctx.db
      .query("marketReports")
      .withIndex("by_item", (q) => q.eq("itemId", item._id))
      .collect();
    if (open.some((r) => r.reporterId === ctx.user._id && r.handledAt === undefined)) return { ok: true };
    await ctx.db.insert("marketReports", { itemId: item._id, reporterId: ctx.user._id, reason, note: clean(note, 2000), at: now });
    return { ok: true };
  },
});

// ---------------------------------------------------------------- staff (portal)

/** Staff: every listing, taken down or not, with its open reports. */
export const adminItems = adminQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("marketItems").withIndex("by_stars").order("desc").take(1000);
    const open = await ctx.db
      .query("marketReports")
      .withIndex("by_handledAt", (q) => q.eq("handledAt", undefined))
      .collect();
    return items.map((i) => ({
      id: i._id,
      ...publicView(i),
      readAt: i.readAt,
      takenDownAt: i.takenDownAt ?? null,
      takedownReason: i.takedownReason ?? null,
      openReports: open
        .filter((r) => r.itemId === i._id)
        .map((r) => ({ id: r._id, reason: r.reason, note: r.note, at: r.at })),
    }));
  },
});

/** Staff: mark an item verified at the commit they read, or take the mark off. */
export const setVerified = adminMutation({
  args: { itemId: v.id("marketItems"), commit: v.union(v.string(), v.null()) },
  handler: async (ctx, { itemId, commit }) => {
    const item = await ctx.db.get(itemId);
    if (!item) fail("NOT_FOUND");
    if (commit === null) {
      await ctx.db.patch(itemId, { verifiedAt: undefined, verifiedCommit: undefined });
      return { ok: true };
    }
    if (!/^[0-9a-f]{40}$/.test(commit)) fail("FORBIDDEN");
    await ctx.db.patch(itemId, { verifiedAt: Date.now(), verifiedCommit: commit });
    return { ok: true };
  },
});

/**
 * Staff: decide on an item. "removed" takes it down (it leaves the listing and
 * the laptop refuses to install it); "kept" closes its reports. Either way
 * every open report is marked handled.
 */
export const decide = adminMutation({
  args: { itemId: v.id("marketItems"), decision: v.union(v.literal("removed"), v.literal("kept")), reason: v.string() },
  handler: async (ctx, { itemId, decision, reason }) => {
    const item = await ctx.db.get(itemId);
    if (!item) fail("NOT_FOUND");
    const now = Date.now();
    if (decision === "removed")
      await ctx.db.patch(itemId, { takenDownAt: now, takedownReason: clean(reason, 2000), verifiedAt: undefined, verifiedCommit: undefined });
    else if (item.takenDownAt !== undefined) await ctx.db.patch(itemId, { takenDownAt: undefined, takedownReason: undefined });
    const reports = await ctx.db
      .query("marketReports")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();
    for (const r of reports) if (r.handledAt === undefined) await ctx.db.patch(r._id, { handledAt: now, decision });
    return { ok: true };
  },
});

// ---------------------------------------------------------------- the index

interface SearchRepo {
  full_name: string;
  owner: { login: string };
  name: string;
  stargazers_count: number;
  default_branch: string;
  pushed_at: string;
  private: boolean;
  archived?: boolean;
  disabled?: boolean;
  license: { spdx_id: string | null } | null;
}

async function github(path: string, accept = "application/vnd.github+json") {
  const res = await fetcher(`${GITHUB}${path}`, {
    headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "titan117-marketplace" },
  });
  return res;
}

/** Listings as they are now, for the index to compare with. */
export const known = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("marketItems").collect();
    return items.map((i) => ({ fullName: i.fullName, pushedAt: i.pushedAt }));
  },
});

export const upsert = internalMutation({
  args: {
    fullName: v.string(),
    owner: v.string(),
    repo: v.string(),
    name: v.string(),
    type: v.string(),
    title: v.string(),
    version: v.string(),
    description: v.string(),
    license: v.union(v.string(), v.null()),
    stars: v.number(),
    defaultBranch: v.string(),
    commit: v.string(),
    pushedAt: v.number(),
  },
  handler: async (ctx, row) => {
    const existing = await byFullName(ctx, row.fullName);
    const now = Date.now();
    if (!existing) {
      await ctx.db.insert("marketItems", { ...row, readAt: now });
      return;
    }
    // A new commit isn't the one staff verified any more.
    const stillVerified = existing.verifiedCommit === row.commit;
    await ctx.db.patch(existing._id, {
      ...row,
      readAt: now,
      verifiedAt: stillVerified ? existing.verifiedAt : undefined,
      verifiedCommit: stillVerified ? existing.verifiedCommit : undefined,
    });
  },
});

/** Stars change without a push: kept up to date without reading titan.json again. */
export const setStars = internalMutation({
  args: { stars: v.array(v.object({ fullName: v.string(), stars: v.number() })) },
  handler: async (ctx, { stars }) => {
    for (const s of stars) {
      const item = await byFullName(ctx, s.fullName);
      if (item && item.stars !== s.stars) await ctx.db.patch(item._id, { stars: s.stars });
    }
  },
});

/** A repository that lost the topic or its titan.json leaves; a taken-down one stays, so it can't come back. */
export const remove = internalMutation({
  args: { fullNames: v.array(v.string()) },
  handler: async (ctx, { fullNames }) => {
    for (const fullName of fullNames) {
      const item = await byFullName(ctx, fullName);
      if (!item || item.takenDownAt !== undefined) continue;
      const reports = await ctx.db
        .query("marketReports")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();
      for (const r of reports) await ctx.db.delete(r._id);
      await ctx.db.delete(item._id);
    }
  },
});

/** Read one repository's titan.json at its default branch's commit. */
async function readRepo(repo: SearchRepo) {
  const fullName = repo.full_name.toLowerCase();
  const commitRes = await github(
    `/repos/${repo.full_name}/commits/${encodeURIComponent(repo.default_branch)}`,
    "application/vnd.github.sha",
  );
  if (!commitRes.ok) return { fullName, error: `commit ${commitRes.status}` } as const;
  const commit = (await commitRes.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) return { fullName, error: "commit" } as const;
  const fileRes = await github(`/repos/${repo.full_name}/contents/titan.json?ref=${commit}`, "application/vnd.github.raw+json");
  if (!fileRes.ok) return { fullName, error: `titan.json ${fileRes.status}`, missing: fileRes.status === 404 } as const;
  const text = await fileRes.text();
  if (text.length > 64 * 1024) return { fullName, error: "titan.json too large", missing: true } as const;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { fullName, error: "titan.json isn't JSON", missing: true } as const;
  }
  const parsed = parseAddonManifest(raw);
  if (!parsed.ok) return { fullName, error: parsed.error, missing: true } as const;
  const m = parsed.manifest;
  return {
    fullName,
    row: {
      fullName,
      owner: repo.owner.login,
      repo: repo.name,
      name: m.name,
      type: m.type,
      title: m.title,
      version: m.version,
      description: m.description,
      license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : (m.license ?? null),
      stars: repo.stargazers_count,
      defaultBranch: repo.default_branch,
      commit,
      pushedAt: Date.parse(repo.pushed_at) || 0,
    },
  } as const;
}

/** The hourly index (crons.ts). */
export const refresh = internalAction({
  args: {},
  handler: async (ctx) => {
    const found: SearchRepo[] = [];
    let complete = false;
    for (let page = 1; page <= SEARCH_PAGES; page++) {
      const res = await github(
        `/search/repositories?q=${encodeURIComponent(`topic:${ADDON_TOPIC}`)}&sort=updated&order=desc&per_page=100&page=${page}`,
      );
      if (!res.ok) break;
      const body = (await res.json()) as { total_count: number; items: SearchRepo[] };
      found.push(...body.items);
      if (body.items.length < 100 || found.length >= body.total_count) {
        complete = true;
        break;
      }
    }
    const usable = found.filter((r) => !r.private && !r.archived && !r.disabled && FULL_NAME.test(r.full_name.toLowerCase()));
    const known = new Map((await ctx.runQuery(internal.market.known, {})).map((k) => [k.fullName, k.pushedAt]));
    const changed = usable.filter((r) => known.get(r.full_name.toLowerCase()) !== (Date.parse(r.pushed_at) || 0));
    const gone: string[] = [];
    let read = 0;
    for (const repo of changed.slice(0, READS_PER_RUN)) {
      const result = await readRepo(repo);
      read++;
      if ("row" in result && result.row) await ctx.runMutation(internal.market.upsert, result.row);
      else if ("missing" in result && result.missing) gone.push(result.fullName);
    }
    await ctx.runMutation(internal.market.setStars, {
      stars: usable.map((r) => ({ fullName: r.full_name.toLowerCase(), stars: r.stargazers_count })),
    });
    // Only a complete search can say a repository left.
    if (complete) {
      const seen = new Set(usable.map((r) => r.full_name.toLowerCase()));
      gone.push(...[...known.keys()].filter((k) => !seen.has(k)));
    }
    if (gone.length) await ctx.runMutation(internal.market.remove, { fullNames: gone });
    return { found: usable.length, read, removed: gone.length, complete };
  },
});

export type MarketItemId = Id<"marketItems">;
