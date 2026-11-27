/**
 * The credit rules from docs/notes/pricing.md, as the only code that writes
 * `creditBuckets` and `creditLedger`:
 *
 * - Monthly credits arrive at the start of each month of a paid period (a
 *   yearly plan gets twelve), and roll over for one month, capped at one
 *   month's allowance.
 * - Top-ups last 12 months and are spent only while a plan is active.
 * - Spending order: this month's credits, then rolled-over credits, then
 *   top-ups, oldest first.
 * - Upgrading adds the difference at once, prorated for the rest of the month;
 *   downgrading changes nothing until the next month.
 */
import { planAllowance, type AnyPlanId } from "@titan117/shared";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isActiveStatus, isPaidStatus } from "./stripe";

export const TOPUP_LIFETIME_MONTHS = 12;
// A yearly plan has 12 grants a period; a little headroom for a late cron run.
const MAX_GRANTS_PER_RUN = 14;
const KIND_ORDER = { monthly: 0, rollover: 1, topup: 2 } as const;

/** Adds calendar months in UTC, clamping to the month's last day (as Stripe's billing anchor does). */
export function addMonths(ts: number, months: number) {
  const d = new Date(ts);
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()),
  );
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.getTime();
}

/** Per-seat plans pool their credits: per seat × seats (decisions §68.6). */
export function monthlyAllowance(plan: AnyPlanId | undefined, seats?: number) {
  return planAllowance(plan, seats);
}

async function bucketsOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("creditBuckets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

async function bucketBySource(ctx: QueryCtx, source: string) {
  return await ctx.db
    .query("creditBuckets")
    .withIndex("by_source", (q) => q.eq("source", source))
    .unique();
}

export async function entitlementOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export function isUsable(entitlement: Doc<"entitlements"> | null, now: number) {
  return !!entitlement && entitlement.activeUntil > now;
}

/** Spendable credits by kind. Expired rows and an inactive plan count as nothing. */
export async function balance(ctx: QueryCtx, userId: Id<"users">, now: number) {
  const out = { monthly: 0, rollover: 0, topup: 0, total: 0, active: false };
  const entitlement = await entitlementOf(ctx, userId);
  out.active = isUsable(entitlement, now);
  for (const b of await bucketsOf(ctx, userId)) {
    if (b.remaining <= 0 || b.expiresAt <= now) continue;
    // Top-ups wait for a new plan; monthly and rolled-over credits end with the plan.
    if (!out.active) continue;
    out[b.kind] += b.remaining;
    out.total += b.remaining;
  }
  return out;
}

/**
 * Charges a cloud call. Idempotent by `ref` (the proxy's request id). The call
 * has already run, so a missing amount isn't refused here; it's recorded as a
 * shortfall. The proxy checks the balance before it starts a call.
 */
export async function spend(
  ctx: MutationCtx,
  userId: Id<"users">,
  credits: number,
  ref: string,
  now: number,
  byUserId?: Id<"users">,
) {
  const done = await ctx.db
    .query("creditLedger")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  if (done) return { charged: -done.amount, shortfall: done.shortfall ?? 0, duplicate: true };

  const want = Math.max(0, Math.ceil(credits));
  let left = want;
  if (isUsable(await entitlementOf(ctx, userId), now)) {
    const buckets = (await bucketsOf(ctx, userId))
      .filter((b) => b.remaining > 0 && b.expiresAt > now)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a._creationTime - b._creationTime);
    for (const b of buckets) {
      if (left === 0) break;
      const take = Math.min(b.remaining, left);
      await ctx.db.patch(b._id, { remaining: b.remaining - take });
      left -= take;
    }
  }
  const charged = want - left;
  await ctx.db.insert("creditLedger", {
    userId,
    amount: -charged,
    reason: "usage",
    ref,
    ...(left > 0 ? { shortfall: left } : {}),
    ...(byUserId ? { byUserId } : {}),
    at: now,
  });
  return { charged, shortfall: left, duplicate: false };
}

/** A paid top-up. Idempotent by the Checkout session id. */
export async function addTopup(ctx: MutationCtx, userId: Id<"users">, credits: number, sessionId: string, now: number) {
  if (await bucketBySource(ctx, sessionId)) return false;
  await ctx.db.insert("creditBuckets", {
    userId,
    kind: "topup",
    granted: credits,
    remaining: credits,
    expiresAt: addMonths(now, TOPUP_LIFETIME_MONTHS),
    source: sessionId,
  });
  await ctx.db.insert("creditLedger", { userId, amount: credits, reason: "topup", ref: sessionId, at: now });
  return true;
}

/**
 * Grants every month of the paid period that has started and isn't granted
 * yet. Called by the webhook after each subscription change and by the daily
 * cron (credits.grantDue), so a yearly plan gets its monthly credits too.
 */
export async function grantDue(ctx: MutationCtx, entitlement: Doc<"entitlements">, now: number) {
  const { subscriptionId, grantAnchor, paidUntil, status } = entitlement;
  if (!subscriptionId || grantAnchor === undefined || paidUntil === undefined || !status) return 0;
  if (!isPaidStatus(status) || entitlement.plan === "custom") return 0;

  let k = entitlement.grantsMade ?? 0;
  let grantedPlan = entitlement.grantedPlan;
  let grantedSeats = entitlement.grantedSeats;
  let granted = 0;
  for (let i = 0; i < MAX_GRANTS_PER_RUN; i++) {
    const start = addMonths(grantAnchor, k);
    if (start > now || start >= paidUntil) break;
    const end = addMonths(grantAnchor, k + 1);

    // Last month's unused allowance rolls over for one month, capped at one month's allowance.
    const previous = k > 0 ? await bucketBySource(ctx, `month:${subscriptionId}:${k - 1}`) : null;
    if (previous && previous.remaining > 0) {
      const keep = Math.min(previous.remaining, monthlyAllowance(grantedPlan, entitlement.grantedSeats));
      await ctx.db.patch(previous._id, { remaining: 0 });
      if (keep > 0 && !(await bucketBySource(ctx, `rollover:${subscriptionId}:${k}`))) {
        await ctx.db.insert("creditBuckets", {
          userId: entitlement.userId,
          kind: "rollover",
          granted: keep,
          remaining: keep,
          expiresAt: end,
          source: `rollover:${subscriptionId}:${k}`,
        });
      }
      if (previous.remaining > keep) {
        await ctx.db.insert("creditLedger", {
          userId: entitlement.userId,
          amount: -(previous.remaining - keep),
          reason: "expired",
          at: now,
        });
      }
    }

    const allowance = monthlyAllowance(entitlement.plan, entitlement.seats);
    const source = `month:${subscriptionId}:${k}`;
    if (!(await bucketBySource(ctx, source))) {
      await ctx.db.insert("creditBuckets", {
        userId: entitlement.userId,
        kind: "monthly",
        granted: allowance,
        remaining: allowance,
        expiresAt: end,
        source,
      });
      await ctx.db.insert("creditLedger", { userId: entitlement.userId, amount: allowance, reason: "monthly", at: now });
      granted += allowance;
    }
    grantedPlan = entitlement.plan;
    grantedSeats = entitlement.seats;
    k++;
  }

  await ctx.db.patch(entitlement._id, {
    grantsMade: k,
    nextGrantAt: addMonths(grantAnchor, k),
    ...(grantedPlan ? { grantedPlan } : {}),
    ...(grantedSeats ? { grantedSeats } : {}),
  });
  return granted;
}

/**
 * Upgrading mid-month: the difference between the two allowances, prorated
 * for what's left of this month, added to this month's credits at once.
 * Downgrading changes nothing now; the next month uses the new plan.
 */
export async function applyUpgrade(ctx: MutationCtx, entitlement: Doc<"entitlements">, now: number) {
  const { subscriptionId, grantAnchor, grantsMade, grantedPlan } = entitlement;
  if (!subscriptionId || grantAnchor === undefined || !grantsMade || !grantedPlan) return 0;
  const before = monthlyAllowance(grantedPlan, entitlement.grantedSeats);
  const after = monthlyAllowance(entitlement.plan, entitlement.seats);
  if (after <= before) return 0;

  const k = grantsMade - 1;
  const start = addMonths(grantAnchor, k);
  const end = addMonths(grantAnchor, k + 1);
  if (now >= end) return 0;
  const extra = Math.round(((after - before) * (end - now)) / (end - start));
  const bucket = await bucketBySource(ctx, `month:${subscriptionId}:${k}`);
  if (bucket && extra > 0) {
    await ctx.db.patch(bucket._id, { granted: bucket.granted + extra, remaining: bucket.remaining + extra });
    await ctx.db.insert("creditLedger", { userId: entitlement.userId, amount: extra, reason: "upgrade", at: now });
  }
  await ctx.db.patch(entitlement._id, { grantedPlan: entitlement.plan, ...(entitlement.seats ? { grantedSeats: entitlement.seats } : {}) });
  return extra;
}

/**
 * Closes expired credits so the history shows them leaving. This month's
 * credits wait while the plan is still active (a late renewal rolls them
 * over); once the plan has ended they expire too.
 */
export async function sweepExpired(ctx: MutationCtx, userId: Id<"users">, now: number) {
  const entitlement = await entitlementOf(ctx, userId);
  const planLive = !!entitlement && !!entitlement.status && isActiveStatus(entitlement.status) && entitlement.activeUntil > now;
  let expired = 0;
  for (const b of await bucketsOf(ctx, userId)) {
    if (b.remaining <= 0 || b.expiresAt > now) continue;
    if (b.kind === "monthly" && planLive) continue;
    expired += b.remaining;
    await ctx.db.patch(b._id, { remaining: 0 });
  }
  if (expired > 0) await ctx.db.insert("creditLedger", { userId, amount: -expired, reason: "expired", at: now });
  return expired;
}
