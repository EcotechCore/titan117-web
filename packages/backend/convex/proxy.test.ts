import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const SECRET = "s".repeat(48);
const T0 = Date.UTC(2026, 10, 15, 12);

async function userWithPlan(t: T, clerkId = "user_1") {
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
      cancelAtPeriodEnd: false,
    },
    topup: null,
  });
  return userId;
}

const asAda = (t: T) => t.withIdentity(identity("user_1"));
const totalCredits = async (t: T) => (await asAda(t).query(api.billing.summary)).credits.total;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubEnv("PROXY_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("proxy.begin refusals (guardrails §2)", () => {
  it("needs our server's secret", async () => {
    const t = setup();
    await userWithPlan(t);
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: "", model: "m" })).rejects.toThrowError("FORBIDDEN");
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: "x".repeat(48), model: "m" })).rejects.toThrowError(
      "FORBIDDEN",
    );
  });

  it("refuses everything when the secret isn't set or is too short", async () => {
    const t = setup();
    await userWithPlan(t);
    vi.stubEnv("PROXY_SECRET", "");
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: "", model: "m" })).rejects.toThrowError("FORBIDDEN");
    vi.stubEnv("PROXY_SECRET", "short");
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: "short", model: "m" })).rejects.toThrowError("FORBIDDEN");
  });

  it("needs a signed-in user even with the secret", async () => {
    const t = setup();
    await expect(t.mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("needs an active plan and credits", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).rejects.toThrowError(
      "PAYMENT_REQUIRED",
    );

    const t2 = setup();
    const userId = await userWithPlan(t2);
    await t2.mutation(internal.credits.charge, { userId, credits: 700, ref: "all" });
    await expect(asAda(t2).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).rejects.toThrowError(
      "INSUFFICIENT_CREDITS",
    );
  });

  it("allows four calls at once, then waits; a lost call stops counting after 15 minutes", async () => {
    const t = setup();
    await userWithPlan(t);
    for (let i = 0; i < 4; i++) await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" });
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).rejects.toThrowError(
      "RATE_LIMITED",
    );
    vi.setSystemTime(T0 + 16 * 60 * 1000);
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).resolves.toBeTruthy();
  });

  it("one user's open calls don't block another's", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await userWithPlan(t, "user_2");
    for (let i = 0; i < 4; i++) await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" });
    await expect(
      t.withIdentity(identity("user_2")).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" }),
    ).resolves.toBeTruthy();
  });
});

describe("proxy.settle", () => {
  it("charges cost × 1.25 once, against the user who opened the call", async () => {
    const t = setup();
    await userWithPlan(t);
    const { callId } = await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "anthropic/claude" });
    expect(await t.mutation(api.proxy.settle, { proxySecret: SECRET, callId, costUsd: 0.08 })).toMatchObject({
      credits: 10,
      duplicate: false,
    });
    expect(await t.mutation(api.proxy.settle, { proxySecret: SECRET, callId, costUsd: 5 })).toMatchObject({
      credits: 10,
      duplicate: true,
    });
    expect(await totalCredits(t)).toBe(690);
    const call = await t.run((ctx) => ctx.db.get(callId));
    expect(call).toMatchObject({ model: "anthropic/claude", credits: 10 });
    expect(Object.keys(call!).sort()).toEqual(["_creationTime", "_id", "credits", "model", "settledAt", "startedAt", "userId"]);
  });

  it("refuses without our server's secret, even for the user who opened it", async () => {
    const t = setup();
    await userWithPlan(t);
    const { callId } = await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" });
    await expect(asAda(t).mutation(api.proxy.settle, { proxySecret: "wrong", callId, costUsd: 0 })).rejects.toThrowError(
      "FORBIDDEN",
    );
    expect(await totalCredits(t)).toBe(700);
  });

  it("a settled call frees its slot", async () => {
    const t = setup();
    await userWithPlan(t);
    const ids: Id<"proxyCalls">[] = [];
    for (let i = 0; i < 4; i++) ids.push((await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).callId);
    await t.mutation(api.proxy.settle, { proxySecret: SECRET, callId: ids[0]!, costUsd: 0 });
    await expect(asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "m" })).resolves.toBeTruthy();
  });
});

describe("video jobs (decisions §59.10)", () => {
  it("only the owner can follow a job, and it is attached and charged once", async () => {
    const t = setup();
    await userWithPlan(t);
    await userWithPlan(t, "user_2");
    const { callId } = await asAda(t).mutation(api.proxy.begin, { proxySecret: SECRET, model: "google/veo-3.1" });

    await expect(t.mutation(api.proxy.attachJob, { proxySecret: "wrong", callId, jobId: "job1" })).rejects.toThrowError(
      "FORBIDDEN",
    );
    await expect(
      t.mutation(api.proxy.attachJob, { proxySecret: SECRET, callId, jobId: "../other" }),
    ).rejects.toThrowError("NOT_FOUND");
    await t.mutation(api.proxy.attachJob, { proxySecret: SECRET, callId, jobId: "job1" });
    // A call carries one job only.
    await expect(t.mutation(api.proxy.attachJob, { proxySecret: SECRET, callId, jobId: "job2" })).rejects.toThrowError(
      "NOT_FOUND",
    );

    expect(await asAda(t).mutation(api.proxy.jobForUser, { proxySecret: SECRET, jobId: "job1" })).toEqual({
      callId,
      settled: false,
    });
    // Someone else's job doesn't exist for them.
    await expect(
      t.withIdentity(identity("user_2")).mutation(api.proxy.jobForUser, { proxySecret: SECRET, jobId: "job1" }),
    ).rejects.toThrowError("NOT_FOUND");
    await expect(asAda(t).mutation(api.proxy.jobForUser, { proxySecret: SECRET, jobId: "nope" })).rejects.toThrowError(
      "NOT_FOUND",
    );
    await expect(t.mutation(api.proxy.jobForUser, { proxySecret: SECRET, jobId: "job1" })).rejects.toThrowError(
      "UNAUTHENTICATED",
    );

    const before = await totalCredits(t);
    await t.mutation(api.proxy.settle, { proxySecret: SECRET, callId, costUsd: 0.4 });
    expect(await asAda(t).mutation(api.proxy.jobForUser, { proxySecret: SECRET, jobId: "job1" })).toMatchObject({
      settled: true,
    });
    expect(before - (await totalCredits(t))).toBe(50);
  });
});
