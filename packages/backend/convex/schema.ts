import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Every table here needs a row in the data table in docs/notes/decisions.md §11,
 * naming its item on the §32 list. checks/guardrails.test.ts fails when one is missing.
 */
const plan = v.union(v.literal("starter"), v.literal("pro"), v.literal("max"), v.literal("custom"));

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    // Set only from the Convex CLI (guardrails §12b), never from a screen.
    role: v.optional(v.literal("admin")),
  }).index("by_clerkId", ["clerkId"]),

  // Written only by the payment webhook and the credit grants it starts (guardrails §3).
  entitlements: defineTable({
    userId: v.id("users"),
    plan,
    // The paid period's end plus a short grace while Stripe retries a failed payment.
    activeUntil: v.number(),
    subscriptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    interval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    // End of the period Stripe has been paid for (no grace).
    paidUntil: v.optional(v.number()),
    // Monthly credits: month k of the subscription starts at grantAnchor + k months.
    grantAnchor: v.optional(v.number()),
    grantsMade: v.optional(v.number()),
    // When the next month's credits are due; absent when none are.
    nextGrantAt: v.optional(v.number()),
    // The plan whose allowance this month's grant used, for prorated upgrades.
    grantedPlan: v.optional(plan),
  })
    .index("by_user", ["userId"])
    .index("by_nextGrantAt", ["nextGrantAt"]),

  devices: defineTable({
    userId: v.id("users"),
    name: v.string(),
    revokedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // The Stripe customer behind a user, created at their first Checkout.
  stripeCustomers: defineTable({
    userId: v.id("users"),
    customerId: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_customer", ["customerId"]),

  // Every Stripe event the webhook has handled, by id, so a repeated delivery is handled once.
  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
    receivedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_receivedAt", ["receivedAt"]),

  /**
   * Credits a user can spend, one row per grant (pricing.md): this month's
   * allowance, last month's rolled-over credits, and top-ups. Spent in that
   * order, top-ups oldest first, skipping expired rows.
   */
  creditBuckets: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("monthly"), v.literal("rollover"), v.literal("topup")),
    granted: v.number(),
    remaining: v.number(),
    expiresAt: v.number(),
    // What created it: `month:<subscription>:<k>`, `rollover:<…>` or the Checkout session id.
    source: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_source", ["source"])
    .index("by_expiresAt", ["expiresAt"]),

  /** Every change to a user's credits, for the credits page. Amounts are signed. */
  creditLedger: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    reason: v.union(
      v.literal("monthly"),
      v.literal("upgrade"),
      v.literal("topup"),
      v.literal("usage"),
      v.literal("expired"),
    ),
    // For usage: the proxy's request id, so a retried charge counts once. Never prompt content.
    ref: v.optional(v.string()),
    // For usage: credits that were due but not there (the call had already run).
    shortfall: v.optional(v.number()),
    at: v.number(),
  })
    .index("by_user_at", ["userId", "at"])
    .index("by_ref", ["ref"]),
});
