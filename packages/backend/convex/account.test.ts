import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 15, 12);

/** Stripe and Clerk, faked: every call is recorded and succeeds. */
let calls: { method: string; url: string; body: string }[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_clerk_fake");
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({ method: req.method, url: req.url, body: await req.text() });
    return Response.json({ id: "x", deleted: true, object: "user" });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function userWithEverything(t: T, clerkId: string, cancelAtPeriodEnd = false) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  await t.mutation(internal.billing.applyEvent, {
    eventId: `evt_${clerkId}`,
    type: "customer.subscription.created",
    subscription: {
      subscriptionId: `sub_${clerkId}`,
      customerId: `cus_${clerkId}`,
      userId,
      status: "active",
      plan: "starter",
      interval: "month",
      periodStart: T0,
      periodEnd: addMonths(T0, 1),
      cancelAtPeriodEnd,
    },
    topup: null,
  });
  await t.mutation(internal.credits.charge, { userId, credits: 3, ref: `req_${clerkId}` });
  await t.run(async (ctx) => {
    await ctx.db.insert("devices", { userId, name: "laptop", tokenHash: `h_${clerkId}` });
    await ctx.db.insert("deviceSignIns", { userId, codeHash: `c_${clerkId}`, challenge: "x", name: "laptop", expiresAt: T0 });
    await ctx.db.insert("proxyCalls", { userId, model: "m", startedAt: T0 });
    const storageId = await ctx.storage.store(new Blob(["<p>shared</p>"]));
    const groupId = await ctx.db.insert("errorGroups", { signature: `s_${clerkId}`, feature: "f", title: "t", count: 1, firstSeen: T0, lastSeen: T0, versions: [], os: [] });
    await ctx.db.insert("errorReports", { userId, groupId, ref: `T117-${clerkId}`, appVersion: "1", os: "w", feature: "f", message: "m", stack: "", logLines: [], note: "", at: T0 });
    await ctx.db.insert("sharedArtifacts", { userId, publicId: `p_${clerkId}`, title: "t", kind: "document", bytes: 13, storageId, createdAt: T0 });
  });
  return userId;
}

const USER_TABLES = [
  "entitlements",
  "stripeCustomers",
  "creditBuckets",
  "creditLedger",
  "devices",
  "deviceSignIns",
  "proxyCalls",
  "sharedArtifacts",
  "errorReports",
] as const;

async function rowsOf(t: T, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const out: Record<string, number> = { users: (await ctx.db.get(userId)) ? 1 : 0 };
    for (const table of USER_TABLES)
      out[table] = (await ctx.db.query(table).collect()).filter((r) => (r as { userId?: string }).userId === userId).length;
    return out;
  });
}

describe("asking to delete an account", () => {
  it("sets the deletion 30 days out and stops the plan renewing", async () => {
    const t = setup();
    await userWithEverything(t, "user_1");
    const asAda = t.withIdentity(identity("user_1"));
    const { deleteAfter } = await asAda.action(api.account.requestDeletion, {});
    expect(deleteAfter).toBe(T0 + 30 * DAY);
    expect(await asAda.query(api.account.deletionStatus, {})).toEqual({ deleteAfter: T0 + 30 * DAY });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://api.stripe.com/v1/subscriptions/sub_user_1" });
    expect(calls[0].body).toBe("cancel_at_period_end=true");

    // Asking twice changes nothing.
    expect((await asAda.action(api.account.requestDeletion, {})).deleteAfter).toBe(T0 + 30 * DAY);
    expect(calls).toHaveLength(1);
  });

  it("cancelling brings renewal back only if asking had stopped it", async () => {
    const t = setup();
    await userWithEverything(t, "user_1");
    const asAda = t.withIdentity(identity("user_1"));
    await asAda.action(api.account.requestDeletion, {});
    await asAda.action(api.account.cancelDeletion, {});
    expect(await asAda.query(api.account.deletionStatus, {})).toEqual({ deleteAfter: null });
    expect(calls.map((c) => c.body)).toEqual(["cancel_at_period_end=true", "cancel_at_period_end=false"]);

    // A plan the user had already cancelled stays cancelled.
    const t2 = setup();
    await userWithEverything(t2, "user_2", true);
    calls = [];
    const asBo = t2.withIdentity(identity("user_2"));
    await asBo.action(api.account.requestDeletion, {});
    await asBo.action(api.account.cancelDeletion, {});
    expect(calls).toHaveLength(0);
  });

  it("refuses a signed-out caller", async () => {
    const t = setup();
    await expect(t.action(api.account.requestDeletion, {})).rejects.toThrowError("UNAUTHENTICATED");
    await expect(t.action(api.account.cancelDeletion, {})).rejects.toThrowError("UNAUTHENTICATED");
    await expect(t.query(api.account.deletionStatus, {})).rejects.toThrowError("UNAUTHENTICATED");
  });
});

describe("the daily deletion", () => {
  it("deletes nothing before the 30 days are over", async () => {
    const t = setup();
    const ada = await userWithEverything(t, "user_1");
    await t.withIdentity(identity("user_1")).action(api.account.requestDeletion, {});
    vi.setSystemTime(T0 + 29 * DAY);
    expect(await t.action(internal.account.purgeDue, {})).toBe(0);
    expect((await rowsOf(t, ada)).users).toBe(1);
  });

  it("then deletes the Clerk user, the Stripe customer and every row, and nobody else's", async () => {
    const t = setup();
    const ada = await userWithEverything(t, "user_1");
    const bo = await userWithEverything(t, "user_2");
    await t.withIdentity(identity("user_1")).action(api.account.requestDeletion, {});
    calls = [];
    vi.setSystemTime(T0 + 30 * DAY + 1);
    expect(await t.action(internal.account.purgeDue, {})).toBe(1);
    await t.finishAllScheduledFunctions(() => undefined);

    expect(calls.map((c) => `${c.method} ${new URL(c.url).host}${new URL(c.url).pathname}`)).toEqual([
      "DELETE api.clerk.com/v1/users/user_1",
      "DELETE api.stripe.com/v1/customers/cus_user_1",
    ]);
    expect(Object.values(await rowsOf(t, ada)).every((n) => n === 0)).toBe(true);
    expect(Object.values(await rowsOf(t, bo)).every((n) => n >= 1)).toBe(true);
  });

  it("an account deleted from Clerk's own screen still has its Stripe customer deleted", async () => {
    const t = setup();
    await userWithEverything(t, "user_1");
    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual(["DELETE /v1/customers/cus_user_1"]);
  });

  it("every table that holds a user id is covered by the deletion (decisions §11)", () => {
    const schema = readFileSync(join(__dirname, "schema.ts"), "utf8");
    const withUser = [...schema.matchAll(/^\s{2}(\w+):\s*defineTable\(\{[^]*?\n\s{2}\}\)/gm)]
      .filter((m) => /userId:\s*v\.id\("users"\)/.test(m[0]))
      .map((m) => m[1]);
    expect(withUser.length).toBeGreaterThan(0);
    expect([...withUser].sort()).toEqual([...USER_TABLES].sort());
    const deletion = readFileSync(join(__dirname, "users.ts"), "utf8") + readFileSync(join(__dirname, "lib", "billing.ts"), "utf8");
    for (const table of withUser) expect(deletion, `${table} isn't deleted with the account`).toContain(`"${table}"`);
  });
});
