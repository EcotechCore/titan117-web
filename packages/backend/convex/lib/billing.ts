/**
 * The only code that writes `entitlements` (guardrails §3), called by the
 * Stripe webhook's mutation (billing.applyEvent) and by account deletion.
 * billing.test.ts checks nothing else writes it.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { applyUpgrade, entitlementOf, grantDue } from "./credits";
import { GRACE_MS, isActiveStatus, type SubscriptionState } from "./stripe";

/**
 * Writes the entitlement a subscription gives, then grants any monthly
 * credits now due. A subscription that has ended doesn't take the plan away
 * from another one that's still running.
 */
export async function applySubscription(ctx: MutationCtx, userId: Id<"users">, state: SubscriptionState, now: number) {
  const existing = await entitlementOf(ctx, userId);
  const active = isActiveStatus(state.status) && state.plan !== null;

  if (existing && !active && existing.subscriptionId !== state.subscriptionId && existing.activeUntil > now) {
    return "kept";
  }

  const sameSubscription = existing?.subscriptionId === state.subscriptionId;
  const fields = {
    plan: state.plan ?? existing?.plan ?? "starter",
    activeUntil: active ? state.periodEnd + GRACE_MS : Math.min(now, existing?.activeUntil ?? now),
    subscriptionId: state.subscriptionId,
    status: state.status,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    paidUntil: state.periodEnd,
    ...(state.interval ? { interval: state.interval } : {}),
    // A new subscription starts its own months; the same one keeps counting.
    ...(sameSubscription
      ? {}
      : { grantAnchor: state.periodStart, grantsMade: 0, grantedPlan: undefined }),
    // Nothing is due once a subscription has ended.
    nextGrantAt: active ? (sameSubscription ? existing?.nextGrantAt : state.periodStart) : undefined,
  };

  let id: Id<"entitlements">;
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    id = existing._id;
  } else {
    // A fresh row: `undefined` only means "clear" on a patch, so leave those fields out.
    const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    id = await ctx.db.insert("entitlements", { userId, ...(defined as typeof fields) });
  }

  if (active) {
    const current = (await ctx.db.get(id))!;
    await applyUpgrade(ctx, current, now);
    await grantDue(ctx, (await ctx.db.get(id))!, now);
  }
  return active ? fields.plan : "ended";
}

/** Account deletion: the plan, credits and the Stripe link go; returns the customers to delete in Stripe. */
export async function removeBilling(ctx: MutationCtx, userId: Id<"users">) {
  const customers = await ctx.db
    .query("stripeCustomers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const rows = [
    ...customers,
    ...(await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()),
    ...(await ctx.db
      .query("creditBuckets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()),
    ...(await ctx.db
      .query("creditLedger")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect()),
  ];
  for (const row of rows) await ctx.db.delete(row._id);
  return customers.map((c) => c.customerId);
}
