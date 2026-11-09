import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Every table here needs a row in the data table in docs/notes/decisions.md §11,
 * naming its item on the §32 list. schema.test.ts fails when one is missing.
 *
 * Phase 0 has only what the guardrail wrappers in lib/functions.ts read.
 * Phase 2 (accounts and money) fills these in.
 */
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    // Set only from the Convex CLI (guardrails §12b), never from a screen.
    role: v.optional(v.literal("admin")),
  }).index("by_clerkId", ["clerkId"]),

  // Written only by the payment webhook (guardrails §3).
  entitlements: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("max"), v.literal("custom")),
    activeUntil: v.number(),
  }).index("by_user", ["userId"]),

  devices: defineTable({
    userId: v.id("users"),
    name: v.string(),
    revokedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
});
