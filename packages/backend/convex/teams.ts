/**
 * Teams, roles, invites, the audit log and white-label (11.6, 11.7;
 * decisions §68), for the web app. Every rule is checked here, whatever the
 * screen shows (guardrails §2); the role table is `@titan117/shared` teams.
 *
 * What a team shares (agents, sidebar apps and their data) never comes here
 * readable: laptops seal it under the team key (teamSync.ts).
 */
import {
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_TYPES,
  INVITE_CODE_PATTERN,
  PLANS,
  TEAM_LIMITS,
  brandProblem,
  canChangeMember,
  canInviteAs,
  cleanTeamName,
  teamCan,
} from "@titan117/shared";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type QueryCtx } from "./_generated/server";
import { entitlementOf, isUsable } from "./lib/credits";
import { fail, userAction, userMutation, userQuery } from "./lib/functions";
import { audit, coveredMembers, dropTeam, membersOf, membershipOf, requireMember, seatsOf, teamPlan } from "./lib/teams";
import { randomToken, sha256Hex } from "./lib/tokens";

const DAY = 24 * 60 * 60 * 1000;
const role = v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"));

function personName(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N} .'-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "Someone"
  );
}

/** The caller's own per-seat plan, if usable: what lets them make teams. */
async function ownTeamPlan(ctx: QueryCtx, userId: Id<"users">) {
  const own = await entitlementOf(ctx, userId);
  if (!own || !isUsable(own, Date.now()) || own.plan === "custom" || !PLANS[own.plan].perSeat) return null;
  return own;
}

async function ownedTeams(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("teams")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .take(100);
}

/** Seats are shared by all of an agency's teams: everyone in any of the owner's teams, counted once. */
async function seatsUsed(ctx: QueryCtx, ownerId: Id<"users">) {
  const people = new Set<Id<"users">>();
  for (const t of await ownedTeams(ctx, ownerId)) for (const m of await membersOf(ctx, t._id)) people.add(m.userId);
  const open = [];
  for (const t of await ownedTeams(ctx, ownerId))
    for (const i of await ctx.db
      .query("teamInvites")
      .withIndex("by_team", (q) => q.eq("teamId", t._id))
      .take(200))
      if (!i.revokedAt && i.expiresAt > Date.now()) open.push(i);
  return { people: people.size, openInvites: open.length };
}

async function logoUrl(ctx: QueryCtx, team: Doc<"teams">) {
  return team.brand?.logoId ? await ctx.storage.getUrl(team.brand.logoId) : null;
}

// ------------------------------------------------------------------ reading

/** The caller's teams and whether they may make one. */
export const mine = userQuery({
  args: {},
  handler: async (ctx) => {
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .take(100);
    const teams = [];
    for (const m of memberships) {
      const team = await ctx.db.get(m.teamId);
      if (!team) continue;
      const { plan, covered } = await coveredMembers(ctx, team);
      teams.push({
        id: team._id,
        name: team.name,
        role: m.role,
        members: (await membersOf(ctx, team._id)).length,
        planActive: plan !== null,
        covered: m.role === "owner" || covered.has(ctx.user._id),
      });
    }
    const own = await ownTeamPlan(ctx, ctx.user._id);
    const owned = (await ownedTeams(ctx, ctx.user._id)).length;
    return {
      teams,
      canCreate: own !== null && own.plan !== "custom" && owned < (PLANS[own.plan].perSeat?.teams ?? 0),
      plan: own ? { id: own.plan, seats: seatsOf(own), teams: own.plan === "custom" ? 0 : (PLANS[own.plan].perSeat?.teams ?? 0) } : null,
    };
  },
});

/** One team, as the caller's role may see it. */
export const get = userQuery({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { team, me } = await requireMember(ctx, teamId, ctx.user._id);
    const { plan, covered } = await coveredMembers(ctx, team);
    const members = await membersOf(ctx, teamId);
    const canInvite = teamCan(me.role, "invite");
    const invites = canInvite
      ? (
          await ctx.db
            .query("teamInvites")
            .withIndex("by_team", (q) => q.eq("teamId", teamId))
            .order("desc")
            .take(TEAM_LIMITS.openInvites)
        )
          .filter((i) => !i.revokedAt && i.expiresAt > Date.now())
          .map((i) => ({ id: i._id, role: i.role, createdAt: i.createdAt, expiresAt: i.expiresAt }))
      : [];
    const laptops = teamCan(me.role, "admitLaptop")
      ? (
          await ctx.db
            .query("teamLaptops")
            .withIndex("by_team", (q) => q.eq("teamId", teamId))
            .take(300)
        ).map((l) => ({ id: l._id, name: l.name, status: l.status, owner: members.find((m) => m.userId === l.userId)?.name ?? "Someone" }))
      : [];
    const used = await seatsUsed(ctx, team.ownerId);
    return {
      id: team._id,
      name: team.name,
      myRole: me.role,
      planActive: plan !== null,
      plan: plan ? plan.plan : null,
      seats: plan ? seatsOf(plan) : 0,
      seatsUsed: used.people,
      whiteLabel: !!plan && plan.plan !== "custom" && !!PLANS[plan.plan].perSeat?.whiteLabel,
      members: members.map((m) => ({
        id: m._id,
        name: m.name,
        role: m.role,
        joinedAt: m.joinedAt,
        me: m.userId === ctx.user._id,
        covered: m.role === "owner" || covered.has(m.userId),
      })),
      invites,
      laptops,
      brand: team.brand ? { name: team.brand.name, accent: team.brand.accent, hideMadeWith: team.brand.hideMadeWith, logoUrl: await logoUrl(ctx, team) } : null,
    };
  },
});

/** The audit log, newest first, for owners and admins. */
export const auditLog = userQuery({
  args: { teamId: v.id("teams"), before: v.optional(v.number()) },
  handler: async (ctx, { teamId, before }) => {
    const { me } = await requireMember(ctx, teamId, ctx.user._id);
    if (!teamCan(me.role, "seeAudit")) fail("FORBIDDEN");
    const rows = await ctx.db
      .query("teamAudit")
      .withIndex("by_team_at", (q) => (before ? q.eq("teamId", teamId).lt("at", before) : q.eq("teamId", teamId)))
      .order("desc")
      .take(TEAM_LIMITS.auditPage);
    return rows.map((r) => ({
      id: r._id,
      at: r.at,
      actor: r.actorName,
      action: r.action,
      target: r.targetName ?? null,
      role: r.role ?? null,
      // Sealed under the team key: the laptops open it (what was shared); the web shows that something was.
      sealed: !!r.sealed,
    }));
  },
});

/** What an invite link is for, before joining: the team's name and the role. Nothing for a bad code. */
export const inviteInfo = userQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    if (!INVITE_CODE_PATTERN.test(code)) return null;
    const codeHash = await sha256Hex(code);
    const row = await ctx.db
      .query("teamInvites")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (!row || row.revokedAt || row.expiresAt <= Date.now()) return null;
    const team = await ctx.db.get(row.teamId);
    if (!team) return null;
    return {
      team: team.name,
      role: row.role,
      already: (await membershipOf(ctx, team._id, ctx.user._id)) !== null,
    };
  },
});

// ------------------------------------------------------------------ changing

/** Makes a team; the caller becomes its owner. Needs their own Team or Agency plan. */
export const create = userMutation({
  args: { name: v.string(), myName: v.string() },
  handler: async (ctx, { name, myName }) => {
    const own = await ownTeamPlan(ctx, ctx.user._id);
    if (!own || own.plan === "custom") fail("PAYMENT_REQUIRED");
    const limit = PLANS[own.plan].perSeat?.teams ?? 0;
    if ((await ownedTeams(ctx, ctx.user._id)).length >= limit) fail("FORBIDDEN");
    const clean = cleanTeamName(name);
    if (clean.length < 2) fail("FORBIDDEN");
    const now = Date.now();
    const teamId = await ctx.db.insert("teams", { ownerId: ctx.user._id, name: clean, createdAt: now, keyGen: 1 });
    const me = personName(myName);
    // The owner holds a seat in each team only once across an agency's teams (seatsUsed counts people).
    await ctx.db.insert("teamMembers", { teamId, userId: ctx.user._id, name: me, role: "owner", joinedAt: now });
    await audit(ctx, teamId, { userId: ctx.user._id, name: me }, "team.created");
    return teamId;
  },
});

export const rename = userMutation({
  args: { teamId: v.id("teams"), name: v.string() },
  handler: async (ctx, { teamId, name }) => {
    const { me } = await requireMember(ctx, teamId, ctx.user._id);
    if (!teamCan(me.role, "manageTeam")) fail("FORBIDDEN");
    const clean = cleanTeamName(name);
    if (clean.length < 2) fail("FORBIDDEN");
    await ctx.db.patch(teamId, { name: clean });
    await audit(ctx, teamId, { userId: ctx.user._id, name: me.name }, "team.renamed", { targetName: clean });
  },
});

/** Deletes the team and everything it holds in our cloud (members, invites, laptops, packages, audit). */
export const remove = userMutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { me } = await requireMember(ctx, teamId, ctx.user._id);
    if (!teamCan(me.role, "manageTeam")) fail("FORBIDDEN");
    await dropTeam(ctx, teamId);
  },
});

/**
 * An invite link (a week, used once). The code is made in this action (a
 * mutation's randomness is seeded) and only its SHA-256 is stored; the web
 * page shows the link once.
 */
export const invite = userAction({
  args: { teamId: v.id("teams"), role },
  handler: async (ctx, { teamId, role: as }): Promise<{ code: string }> => {
    const code = randomToken().slice(0, 32);
    await ctx.runMutation(internal.teams.storeInvite, { userId: ctx.userId, teamId, role: as, codeHash: await sha256Hex(code) });
    return { code };
  },
});

export const storeInvite = internalMutation({
  args: { userId: v.id("users"), teamId: v.id("teams"), role, codeHash: v.string() },
  handler: async (ctx, { userId, teamId, role: as, codeHash }) => {
    const { team, me } = await requireMember(ctx, teamId, userId);
    if (!canInviteAs(me.role, as)) fail("FORBIDDEN");
    const plan = await teamPlan(ctx, team);
    if (!plan) fail("PAYMENT_REQUIRED");
    const used = await seatsUsed(ctx, team.ownerId);
    // Every open invite holds a seat until it's used, cancelled or expires.
    if (used.people + used.openInvites >= seatsOf(plan)) fail("FORBIDDEN");
    if (used.openInvites >= TEAM_LIMITS.openInvites) fail("RATE_LIMITED");
    const now = Date.now();
    await ctx.db.insert("teamInvites", {
      teamId,
      codeHash,
      role: as,
      createdBy: userId,
      createdAt: now,
      expiresAt: now + TEAM_LIMITS.inviteDays * DAY,
    });
    await audit(ctx, teamId, { userId, name: me.name }, "invite.created", { role: as });
  },
});

export const revokeInvite = userMutation({
  args: { inviteId: v.id("teamInvites") },
  handler: async (ctx, { inviteId }) => {
    const row = await ctx.db.get(inviteId);
    if (!row) fail("NOT_FOUND");
    const { me } = await requireMember(ctx, row.teamId, ctx.user._id);
    if (!teamCan(me.role, "invite")) fail("FORBIDDEN");
    if (!row.revokedAt) await ctx.db.patch(inviteId, { revokedAt: Date.now() });
    await audit(ctx, row.teamId, { userId: ctx.user._id, name: me.name }, "invite.revoked", { role: row.role });
  },
});

/** Joins with an invite link's code, under a name the person chooses for this team. */
export const join = userAction({
  args: { code: v.string(), name: v.string() },
  handler: async (ctx, { code, name }): Promise<Id<"teams">> => {
    if (!INVITE_CODE_PATTERN.test(code)) fail("NOT_FOUND");
    return await ctx.runMutation(internal.teams.redeemInvite, { userId: ctx.userId, codeHash: await sha256Hex(code), name });
  },
});

export const redeemInvite = internalMutation({
  args: { userId: v.id("users"), codeHash: v.string(), name: v.string() },
  handler: async (ctx, { userId, codeHash, name }) => {
    const row = await ctx.db
      .query("teamInvites")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .unique();
    const now = Date.now();
    if (!row || row.revokedAt || row.expiresAt <= now) fail("NOT_FOUND");
    const team = await ctx.db.get(row.teamId);
    if (!team) fail("NOT_FOUND");
    if (await membershipOf(ctx, team._id, userId)) fail("FORBIDDEN");
    if (!(await teamPlan(ctx, team, now))) fail("PAYMENT_REQUIRED");
    const me = personName(name);
    await ctx.db.insert("teamMembers", { teamId: team._id, userId, name: me, role: row.role, joinedAt: now });
    // Used once: the invite goes.
    await ctx.db.delete(row._id);
    await audit(ctx, team._id, { userId, name: me }, "member.joined", { role: row.role });
    return team._id;
  },
});

/** Owners and admins change roles, within canChangeMember. */
export const setRole = userMutation({
  args: { memberId: v.id("teamMembers"), role },
  handler: async (ctx, { memberId, role: to }) => {
    const target = await ctx.db.get(memberId);
    if (!target) fail("NOT_FOUND");
    const { me } = await requireMember(ctx, target.teamId, ctx.user._id);
    if (target.userId === ctx.user._id || !canChangeMember(me.role, target.role, to)) fail("FORBIDDEN");
    await ctx.db.patch(memberId, { role: to });
    await audit(ctx, target.teamId, { userId: ctx.user._id, name: me.name }, "member.role", { targetName: target.name, role: to });
  },
});

/** Removes someone: they leave, their laptops leave the key (the others change it). */
export const removeMember = userMutation({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, { memberId }) => {
    const target = await ctx.db.get(memberId);
    if (!target) fail("NOT_FOUND");
    const { me } = await requireMember(ctx, target.teamId, ctx.user._id);
    if (target.userId === ctx.user._id || !canChangeMember(me.role, target.role, null)) fail("FORBIDDEN");
    await dropMember(ctx, target);
    await audit(ctx, target.teamId, { userId: ctx.user._id, name: me.name }, "member.removed", { targetName: target.name });
  },
});

/** Leaves a team. The owner can't leave; they delete the team instead. */
export const leave = userMutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { me } = await requireMember(ctx, teamId, ctx.user._id);
    if (me.role === "owner") fail("FORBIDDEN");
    await dropMember(ctx, me);
    await audit(ctx, teamId, { userId: ctx.user._id, name: me.name }, "member.left");
  },
});

async function dropMember(ctx: Parameters<typeof audit>[0], member: Doc<"teamMembers">) {
  for (const l of await ctx.db
    .query("teamLaptops")
    .withIndex("by_team", (q) => q.eq("teamId", member.teamId))
    .take(300))
    if (l.userId === member.userId) await ctx.db.delete(l._id);
  await ctx.db.delete(member._id);
}

// ------------------------------------------------------------------ white-label

/** Agency plan only, the owner only. The rules a brand must follow are the owner's to confirm. */
export const setBrand = userMutation({
  args: {
    teamId: v.id("teams"),
    brand: v.union(v.null(), v.object({ name: v.string(), accent: v.string(), hideMadeWith: v.boolean() })),
    logoId: v.optional(v.union(v.null(), v.id("_storage"))),
  },
  handler: async (ctx, { teamId, brand, logoId }) => {
    const { team, me } = await requireMember(ctx, teamId, ctx.user._id);
    if (!teamCan(me.role, "setBrand")) fail("FORBIDDEN");
    const plan = await teamPlan(ctx, team);
    if (!plan || plan.plan === "custom" || !PLANS[plan.plan].perSeat?.whiteLabel) fail("PAYMENT_REQUIRED");
    const oldLogo = team.brand?.logoId;
    if (brand === null) {
      if (oldLogo) await ctx.storage.delete(oldLogo);
      await ctx.db.patch(teamId, { brand: undefined });
    } else {
      if (brandProblem(brand)) fail("FORBIDDEN");
      // Hiding "Made with Titan117" waits for the owner's brand rules (decisions §68.7).
      if (brand.hideMadeWith && process.env.WHITE_LABEL_HIDE_MADE_WITH !== "on") fail("FORBIDDEN");
      let keepLogo = logoId === undefined ? oldLogo : (logoId ?? undefined);
      if (logoId) {
        const meta = await ctx.db.system.get(logoId);
        const ok =
          !!meta && meta.size <= BRAND_LOGO_MAX_BYTES && (BRAND_LOGO_TYPES as readonly string[]).includes(meta.contentType ?? "");
        if (!ok) {
          await ctx.storage.delete(logoId);
          fail("FORBIDDEN");
        }
      }
      if (oldLogo && oldLogo !== keepLogo) await ctx.storage.delete(oldLogo);
      if (keepLogo === null) keepLogo = undefined;
      await ctx.db.patch(teamId, {
        brand: { name: cleanTeamName(brand.name), accent: brand.accent.toLowerCase(), hideMadeWith: brand.hideMadeWith, ...(keepLogo ? { logoId: keepLogo } : {}) },
      });
    }
    await audit(ctx, teamId, { userId: ctx.user._id, name: me.name }, "brand.changed");
  },
});

/** Where the web page uploads a logo before setBrand (owner of an Agency team only). */
export const logoUploadUrl = userMutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const { me } = await requireMember(ctx, teamId, ctx.user._id);
    if (!teamCan(me.role, "setBrand")) fail("FORBIDDEN");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * The brand a user's shared pages carry: of the first Agency team they are
 * in (by joining order). Public data, shown on their public pages only.
 */
export async function brandForUser(ctx: QueryCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(50);
  for (const m of memberships.sort((a, b) => a.joinedAt - b.joinedAt)) {
    const team = await ctx.db.get(m.teamId);
    if (!team?.brand) continue;
    const plan = await teamPlan(ctx, team);
    if (!plan || plan.plan === "custom" || !PLANS[plan.plan].perSeat?.whiteLabel) continue;
    return { name: team.brand.name, accent: team.brand.accent, hideMadeWith: team.brand.hideMadeWith, logoUrl: await logoUrl(ctx, team) };
  }
  return null;
}

/** The brand for the caller's own app header (the desktop asks through /desktop/team). */
export const myBrand = userQuery({
  args: {},
  handler: async (ctx) => await brandForUser(ctx, ctx.user._id),
});
