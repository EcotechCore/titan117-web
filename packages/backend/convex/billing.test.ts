import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { planFromLookupKey, signPayload, verifyStripeEvent } from "./lib/stripe";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 31, 12); // 31 Jan: month ends clamp (Feb 28, Mar 31)

function sub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    subscriptionId: "sub_1",
    customerId: "cus_1",
    userId: null as string | null,
    status: "active",
    plan: "starter" as "starter" | "pro" | "max" | null,
    interval: "month" as "month" | "year" | null,
    periodStart: T0,
    periodEnd: addMonths(T0, 1),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

let eventCount = 0;
async function apply(t: T, subscription: ReturnType<typeof sub> | null, topup: object | null = null) {
  return await t.mutation(internal.billing.applyEvent, {
    eventId: `evt_${++eventCount}`,
    type: "customer.subscription.updated",
    subscription,
    topup: topup as never,
  });
}

async function newUser(t: T, clerkId = "user_1") {
  return await t.run((ctx) => ctx.db.insert("users", { clerkId }));
}

const credits = (t: T, userId: Id<"users">) =>
  t.run(async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("creditBuckets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const live = rows.filter((b) => b.remaining > 0 && b.expiresAt > now);
    const sum = (kind: string) => live.filter((b) => b.kind === kind).reduce((n, b) => n + b.remaining, 0);
    return { monthly: sum("monthly"), rollover: sum("rollover"), topup: sum("topup") };
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("Stripe helpers", () => {
  it("reads plan and interval only from our lookup keys", () => {
    expect(planFromLookupKey("titan117_pro_year")).toEqual({ plan: "pro", interval: "year" });
    expect(planFromLookupKey("titan117_gold_month")).toEqual({ plan: null, interval: null });
    expect(planFromLookupKey("someone_else")).toEqual({ plan: null, interval: null });
    expect(planFromLookupKey(null)).toEqual({ plan: null, interval: null });
  });

  it("adds months the way Stripe's billing anchor does", () => {
    expect(new Date(addMonths(T0, 1)).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(new Date(addMonths(T0, 2)).toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(new Date(addMonths(T0, 12)).toISOString().slice(0, 10)).toBe("2027-01-31");
  });

  it("accepts only a fresh v1 signature over the exact body", async () => {
    const body = JSON.stringify({ id: "evt_1", type: "x", data: { object: {} } });
    const now = Math.floor(T0 / 1000);
    const good = await signPayload(body, "whsec_test", now);
    expect(await verifyStripeEvent(body, good, "whsec_test", now)).not.toBeNull();
    expect(await verifyStripeEvent(body + " ", good, "whsec_test", now)).toBeNull();
    expect(await verifyStripeEvent(body, good, "whsec_other", now)).toBeNull();
    expect(await verifyStripeEvent(body, good, "whsec_test", now + 301)).toBeNull();
    expect(await verifyStripeEvent(body, good.replace("v1=", "v0="), "whsec_test", now)).toBeNull();
    expect(await verifyStripeEvent(body, null, "whsec_test", now)).toBeNull();
    // Extra debug entries Stripe may add don't break it.
    expect(await verifyStripeEvent(body, `${good},destination=we_1,payload=ab12`, "whsec_test", now)).not.toBeNull();
  });
});

describe("plans from the webhook", () => {
  it("a new monthly plan gives its allowance once, even if the event repeats", async () => {
    const t = setup();
    const userId = await newUser(t);
    expect(await apply(t, sub({ userId }))).toBe("starter");
    await t.mutation(internal.billing.applyEvent, { eventId: "evt_same", type: "x", subscription: sub({ userId }), topup: null });
    expect(
      await t.mutation(internal.billing.applyEvent, { eventId: "evt_same", type: "x", subscription: sub({ userId }), topup: null }),
    ).toBe("duplicate");
    expect(await credits(t, userId)).toEqual({ monthly: 700, rollover: 0, topup: 0 });
  });

  it("finds the user through the Stripe customer when metadata is missing", async () => {
    const t = setup();
    const userId = await newUser(t);
    await t.run((ctx) => ctx.db.insert("stripeCustomers", { userId, customerId: "cus_1" }));
    expect(await apply(t, sub())).toBe("starter");
    expect(await apply(t, sub({ customerId: "cus_unknown", subscriptionId: "sub_x" }))).toBe("no-user");
  });

  it("a renewal grants the next month and rolls over what's left, capped at one month", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId, plan: "pro" }));
    // Spend 200 of 1,500, then renew.
    await t.mutation(internal.credits.charge, { userId, credits: 200, ref: "req_1" });
    vi.setSystemTime(addMonths(T0, 1) + 1000);
    await apply(t, sub({ userId, plan: "pro", periodStart: addMonths(T0, 1), periodEnd: addMonths(T0, 2) }));
    expect(await credits(t, userId)).toEqual({ monthly: 1500, rollover: 1300, topup: 0 });

    // Unused again: last month's 1,500 rolls over, the older 1,300 expires.
    vi.setSystemTime(addMonths(T0, 2) + 1000);
    await apply(t, sub({ userId, plan: "pro", periodStart: addMonths(T0, 2), periodEnd: addMonths(T0, 3) }));
    await t.mutation(internal.credits.daily, {});
    expect(await credits(t, userId)).toEqual({ monthly: 1500, rollover: 1500, topup: 0 });
  });

  it("a yearly plan gets one month at a time, from the daily run", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId, interval: "year", periodEnd: addMonths(T0, 12) }));
    expect(await credits(t, userId)).toEqual({ monthly: 700, rollover: 0, topup: 0 });
    vi.setSystemTime(addMonths(T0, 1) + DAY / 2);
    await t.mutation(internal.credits.daily, {});
    expect(await credits(t, userId)).toEqual({ monthly: 700, rollover: 700, topup: 0 });
    // Running again the same day grants nothing more.
    await t.mutation(internal.credits.daily, {});
    expect(await credits(t, userId)).toEqual({ monthly: 700, rollover: 700, topup: 0 });
  });

  it("a renewal that isn't paid yet grants nothing", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId }));
    vi.setSystemTime(addMonths(T0, 1) + 1000);
    // Payment failed: Stripe keeps the old period and marks it past due.
    await apply(t, sub({ userId, status: "past_due" }));
    await t.mutation(internal.credits.daily, {});
    const ledger = await t.run((ctx) => ctx.db.query("creditLedger").collect());
    expect(ledger.filter((l) => l.reason === "monthly")).toHaveLength(1);
    // Still usable during the grace days.
    expect((await t.withIdentity(identity("user_1")).query(api.billing.summary)).plan).toBe("starter");
  });

  it("upgrading adds the prorated difference at once; downgrading waits", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId, plan: "starter" }));
    // Halfway through February's 28 days.
    const half = T0 + (addMonths(T0, 1) - T0) / 2;
    vi.setSystemTime(half);
    await apply(t, sub({ userId, plan: "max" }));
    expect(await credits(t, userId)).toEqual({ monthly: 700 + 1400, rollover: 0, topup: 0 });
    await apply(t, sub({ userId, plan: "pro" }));
    expect(await credits(t, userId)).toEqual({ monthly: 2100, rollover: 0, topup: 0 });
  });

  it("an ended subscription locks the plan; monthly credits expire, top-ups wait", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId }));
    await apply(t, null, { sessionId: "cs_1", userId, customerId: "cus_1", credits: 1000 });
    vi.setSystemTime(addMonths(T0, 1) + 3 * DAY);
    await apply(t, sub({ userId, status: "canceled" }));
    await t.mutation(internal.credits.daily, {});

    const summary = await t.withIdentity(identity("user_1")).query(api.billing.summary);
    expect(summary.plan).toBeNull();
    expect(summary.credits.total).toBe(0);
    expect(await credits(t, userId)).toEqual({ monthly: 0, rollover: 0, topup: 1000 });
    // Spending does nothing without a plan.
    expect(await t.mutation(internal.credits.charge, { userId, credits: 5, ref: "req_x" })).toMatchObject({
      charged: 0,
      shortfall: 5,
    });

    // A new subscription brings the top-up back.
    await apply(t, sub({ userId, subscriptionId: "sub_2", periodStart: Date.now(), periodEnd: addMonths(Date.now(), 1) }));
    expect(await credits(t, userId)).toEqual({ monthly: 700, rollover: 0, topup: 1000 });
  });

  it("an old subscription ending doesn't remove a newer active one", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId, subscriptionId: "sub_new" }));
    expect(await apply(t, sub({ userId, subscriptionId: "sub_old", status: "canceled" }))).toBe("kept");
    expect((await t.withIdentity(identity("user_1")).query(api.billing.summary)).plan).toBe("starter");
  });
});

describe("spending", () => {
  it("uses this month, then rollover, then top-ups oldest first, once per request", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId }));
    await apply(t, null, { sessionId: "cs_a", userId, customerId: "cus_1", credits: 1000 });
    vi.setSystemTime(T0 + DAY);
    await apply(t, null, { sessionId: "cs_b", userId, customerId: "cus_1", credits: 1000 });
    // The same session again adds nothing.
    expect(await apply(t, null, { sessionId: "cs_b", userId, customerId: "cus_1", credits: 1000 })).toBe("duplicate-topup");

    expect(await t.mutation(internal.credits.charge, { userId, credits: 900, ref: "req_1" })).toMatchObject({ charged: 900 });
    expect(await t.mutation(internal.credits.charge, { userId, credits: 900, ref: "req_1" })).toMatchObject({ duplicate: true });
    const buckets = await t.run((ctx) => ctx.db.query("creditBuckets").collect());
    const left = Object.fromEntries(buckets.map((b) => [b.source, b.remaining]));
    expect(left).toEqual({ "month:sub_1:0": 0, cs_a: 800, cs_b: 1000 });
  });

  it("records a shortfall instead of going below zero", async () => {
    const t = setup();
    const userId = await newUser(t);
    await apply(t, sub({ userId }));
    expect(await t.mutation(internal.credits.charge, { userId, credits: 750, ref: "req_1" })).toMatchObject({
      charged: 700,
      shortfall: 50,
    });
  });
});

describe("refusals (guardrails §2)", () => {
  it("summary refuses a signed-out caller and shows only the caller's own credits", async () => {
    const t = setup();
    await expect(t.query(api.billing.summary)).rejects.toThrowError("UNAUTHENTICATED");
    const ada = await newUser(t, "user_1");
    await newUser(t, "user_2");
    await apply(t, sub({ userId: ada }));
    expect((await t.withIdentity(identity("user_2")).query(api.billing.summary)).credits.total).toBe(0);
    expect((await t.withIdentity(identity("user_1")).query(api.billing.summary)).credits.total).toBe(700);
  });

  it("checkout refuses a signed-out caller and a second subscription", async () => {
    const t = setup();
    await expect(t.action(api.billing.checkout, { plan: "pro", interval: "month" })).rejects.toThrowError("UNAUTHENTICATED");
    const userId = await newUser(t);
    await apply(t, sub({ userId }));
    await expect(
      t.withIdentity(identity("user_1")).action(api.billing.checkout, { plan: "pro", interval: "month" }),
    ).rejects.toThrowError("ALREADY_SUBSCRIBED");
  });

  it("top-ups need an active plan", async () => {
    const t = setup();
    await newUser(t);
    await expect(t.withIdentity(identity("user_1")).action(api.billing.topUp, { pack: "topup_1000" })).rejects.toThrowError(
      "PAYMENT_REQUIRED",
    );
  });

  it("the portal needs a Stripe customer", async () => {
    const t = setup();
    await expect(t.action(api.billing.portal, {})).rejects.toThrowError("UNAUTHENTICATED");
    await newUser(t);
    await expect(t.withIdentity(identity("user_1")).action(api.billing.portal, {})).rejects.toThrowError("NOT_FOUND");
  });

  it("only lib/billing.ts writes entitlements and only lib/credits.ts writes credits", () => {
    const dir = join(__dirname);
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.name === "_generated" ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );
    const writers = (table: string) =>
      walk(dir)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
        .filter((f) => new RegExp(`insert\\("${table}"`).test(readFileSync(f, "utf8")))
        .map((f) => f.slice(dir.length + 1).replace(/\\/g, "/"));
    expect(writers("entitlements")).toEqual(["lib/billing.ts"]);
    expect(writers("creditBuckets")).toEqual(["lib/credits.ts"]);
    expect(writers("creditLedger")).toEqual(["lib/credits.ts"]);
  });
});

describe("Stripe webhook", () => {
  const secret = "whsec_test_secret";
  beforeEach(() => vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret));

  async function signed(event: object, key = secret) {
    const body = JSON.stringify(event);
    return {
      method: "POST",
      body,
      headers: { "stripe-signature": await signPayload(body, key, Math.floor(Date.now() / 1000)) },
    };
  }
  const ignored = { id: "evt_ignored", type: "invoice.created", created: 0, data: { object: {} } };

  it("records a correctly signed event once", async () => {
    const t = setup();
    expect((await t.fetch("/stripe", await signed(ignored))).status).toBe(200);
    expect((await t.fetch("/stripe", await signed(ignored))).status).toBe(200);
    expect(await t.run(async (ctx) => (await ctx.db.query("stripeEvents").collect()).length)).toBe(1);
  });

  it("refuses a wrong signature, no signature, and no configured secret", async () => {
    const t = setup();
    expect((await t.fetch("/stripe", await signed(ignored, "whsec_attacker"))).status).toBe(400);
    expect((await t.fetch("/stripe", { method: "POST", body: JSON.stringify(ignored) })).status).toBe(400);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await t.fetch("/stripe", await signed(ignored))).status).toBe(500);
    expect(await t.run(async (ctx) => (await ctx.db.query("stripeEvents").collect()).length)).toBe(0);
  });
});

describe("the 14-day waiver (decisions §33.8)", () => {
  it("the checkbox, the invoice footer and the terms page say the same thing", async () => {
    const { TERMS_TEXT, WAIVER_FOOTER } = await import("./billing");
    const terms = readFileSync(join(__dirname, "..", "..", "..", "apps", "web", "app", "(site)", "legal", "terms", "page.tsx"), "utf8");
    expect(TERMS_TEXT).toContain("https://titan117.com/legal/terms");
    expect(TERMS_TEXT).toMatch(/lose my 14-day right of withdrawal once it has started/);
    expect(WAIVER_FOOTER).toContain("https://titan117.com/legal/terms#payments");
    expect(WAIVER_FOOTER).toMatch(/lose your 14-day right of withdrawal once it has started/);
    // The section the links point to, and the same promise in it.
    expect(terms).toContain('id: "payments"');
    expect(terms).toMatch(/lose this right once it has started/);
    expect(terms).toMatch(/We confirm this in the email/);
  });
});
