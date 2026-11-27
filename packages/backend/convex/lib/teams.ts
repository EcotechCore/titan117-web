/**
 * Teams on the server (decisions §68): who is covered by whose plan, a
 * member's role, and the audit log's only writer.
 *
 * A team runs on its owner's per-seat plan (Team or Agency). Its members
 * need no plan of their own: while the owner's plan is usable and they are
 * inside its seats, they count as having that plan, and their cloud calls
 * spend the team's pool (the owner's credits). A member with a plan of their
 * own keeps using it first.
 */
import { PLANS, type TeamAuditAction, type TeamRole } from "@titan117/shared";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { entitlementOf, isUsable } from "./credits";
import { fail } from "./functions";

type Ctx = QueryCtx | MutationCtx;

export function seatsOf(entitlement: Doc<"entitlements"> | null) {
  if (!entitlement || entitlement.plan === "custom" || !PLANS[entitlement.plan].perSeat) return 0;
  return Math.max(1, entitlement.seats ?? 1);
}

/** The owner's plan, if it's a usable per-seat plan. */
export async function teamPlan(ctx: Ctx, team: Doc<"teams">, now = Date.now()) {
  const entitlement = await entitlementOf(ctx, team.ownerId);
  if (!entitlement || !isUsable(entitlement, now) || seatsOf(entitlement) === 0) return null;
  return entitlement;
}

export async function membersOf(ctx: Ctx, teamId: Id<"teams">) {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .take(200);
}

/** Seats are taken in joining order: if the owner lowers the seats, the latest to join lose cover first. */
export async function coveredMembers(ctx: Ctx, team: Doc<"teams">, now = Date.now()) {
  const plan = await teamPlan(ctx, team, now);
  if (!plan) return { plan: null, covered: new Set<Id<"users">>() };
  // An agency's seats are shared by all its teams: people across them, counted once, earliest first.
  const first = new Map<Id<"users">, number>();
  for (const t of await ctx.db
    .query("teams")
    .withIndex("by_owner", (q) => q.eq("ownerId", team.ownerId))
    .take(100))
    for (const m of await membersOf(ctx, t._id))
      first.set(m.userId, Math.min(first.get(m.userId) ?? Infinity, m.role === "owner" ? -1 : m.joinedAt));
  const order = [...first.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  return { plan, covered: new Set(order.slice(0, seatsOf(plan))) };
}

export interface EffectivePlan {
  entitlement: Doc<"entitlements">;
  /** Whose credits pay: the user, or the team's owner. */
  payerId: Id<"users">;
  via: "own" | "team";
  teamId?: Id<"teams">;
}

/**
 * The plan a user works under: their own when usable, else the first team
 * (in joining order) whose owner's plan covers them.
 */
export async function planOf(ctx: Ctx, userId: Id<"users">, now = Date.now()): Promise<EffectivePlan | null> {
  const own = await entitlementOf(ctx, userId);
  if (own && isUsable(own, now)) return { entitlement: own, payerId: userId, via: "own" };
  const memberships = await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(50);
  for (const m of memberships.sort((a, b) => a.joinedAt - b.joinedAt)) {
    if (m.role === "owner") continue;
    const team = await ctx.db.get(m.teamId);
    if (!team) continue;
    const { plan, covered } = await coveredMembers(ctx, team, now);
    if (plan && covered.has(userId)) return { entitlement: plan, payerId: team.ownerId, via: "team", teamId: team._id };
  }
  return null;
}

export async function membershipOf(ctx: Ctx, teamId: Id<"teams">, userId: Id<"users">) {
  return await ctx.db
    .query("teamMembers")
    .withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", userId))
    .unique();
}

/** A team the user is in, with their membership. Someone else's team looks the same as none. */
export async function requireMember(ctx: Ctx, teamId: Id<"teams">, userId: Id<"users">) {
  const team = await ctx.db.get(teamId);
  const me = team ? await membershipOf(ctx, teamId, userId) : null;
  if (!team || !me) fail("NOT_FOUND");
  return { team, me };
}

/** The audit log's only writer (append-only; checks/guardrails.test.ts looks for others). */
export async function audit(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  actor: { userId?: Id<"users">; name: string },
  action: TeamAuditAction,
  extra: { targetName?: string; role?: TeamRole; sealed?: string } = {},
) {
  await ctx.db.insert("teamAudit", {
    teamId,
    ...(actor.userId ? { actorId: actor.userId } : {}),
    actorName: actor.name,
    action,
    ...extra,
    at: Date.now(),
  });
}

/** Everything a team has, for deleting the team. Audit rows go with it. */
export async function dropTeam(ctx: MutationCtx, teamId: Id<"teams">) {
  const team = await ctx.db.get(teamId);
  for (const table of ["teamMembers", "teamLaptops"] as const)
    for (const row of await ctx.db
      .query(table)
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .take(500))
      await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("teamInvites")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .take(500))
    await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("teamChanges")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .take(1000)) {
    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db
    .query("teamAudit")
    .withIndex("by_team_at", (q) => q.eq("teamId", teamId))
    .take(5000))
    await ctx.db.delete(row._id);
  if (team?.brand?.logoId) await ctx.storage.delete(team.brand.logoId);
  if (team) await ctx.db.delete(team._id);
}

/**
 * Account deletion: teams the user owns go; in other teams they leave, their
 * laptops leave the key (the others change it), their packages go, and the
 * audit keeps their name without the link.
 */
export async function removeUserFromTeams(ctx: MutationCtx, userId: Id<"users">) {
  for (const team of await ctx.db
    .query("teams")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .take(100))
    await dropTeam(ctx, team._id);
  for (const m of await ctx.db
    .query("teamMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(100))
    await ctx.db.delete(m._id);
  for (const l of await ctx.db
    .query("teamLaptops")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(300))
    await ctx.db.delete(l._id);
  for (const c of await ctx.db
    .query("teamChanges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(1000)) {
    await ctx.storage.delete(c.storageId);
    await ctx.db.delete(c._id);
  }
  for (const i of await ctx.db
    .query("teamInvites")
    .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
    .take(500))
    await ctx.db.delete(i._id);
  // Calls they paid for as a team's owner, and their name on the pool's history as a member.
  for (const c of await ctx.db
    .query("proxyCalls")
    .withIndex("by_payer", (q) => q.eq("payerId", userId))
    .take(2000))
    await ctx.db.delete(c._id);
  for (const l of await ctx.db
    .query("creditLedger")
    .withIndex("by_byUser", (q) => q.eq("byUserId", userId))
    .take(2000)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, _creationTime, byUserId, ...rest } = l;
    await ctx.db.replace(_id, rest);
  }
  for (const a of await ctx.db
    .query("teamAudit")
    .withIndex("by_actor", (q) => q.eq("actorId", userId))
    .take(5000))
    await ctx.db.replace(a._id, { ...withoutActor(a) });
}

function withoutActor(a: Doc<"teamAudit">) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, _creationTime, actorId, ...rest } = a;
  return rest;
}

/** A signed-out laptop leaves every team key (the others change it). */
export async function leaveTeamsWithDevice(ctx: MutationCtx, deviceId: Id<"devices">) {
  for (const l of await ctx.db
    .query("teamLaptops")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .take(50))
    await ctx.db.delete(l._id);
}
