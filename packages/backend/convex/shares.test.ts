import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { addMonths } from "./lib/credits";
import { MAX_SHARES_PER_DAY } from "./shares";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const SECRET = "s".repeat(48);
const T0 = Date.UTC(2026, 10, 15, 12);

async function userWithPlan(t: T, clerkId: string, withPlan = true) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  await t.run((ctx) => ctx.db.insert("devices", { userId, name: "laptop", tokenHash: `hash_${clerkId}` }));
  if (withPlan)
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

/** What the web route does: begin, upload, finish. */
async function share(t: T, tokenHash: string, html = "<h1>Report</h1>") {
  await t.mutation(api.shares.beginForDevice, { proxySecret: SECRET, tokenHash, bytes: html.length });
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([html], { type: "text/html" })));
  const result = await t.mutation(api.shares.finishForDevice, {
    proxySecret: SECRET,
    tokenHash,
    storageId,
    title: "Market report",
    kind: "document",
  });
  if (!result.ok) throw new Error(result.code);
  return { publicId: result.publicId };
}

const admin = (t: T) => t.withIdentity(identity("staff_1", { fva: [0, 0] }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubEnv("PROXY_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("sharing refusals (guardrails §2, §3)", () => {
  it("needs our server's secret", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await expect(
      t.mutation(api.shares.beginForDevice, { proxySecret: "x".repeat(48), tokenHash: "hash_user_1", bytes: 10 }),
    ).rejects.toThrowError("FORBIDDEN");
    await expect(
      t.mutation(api.shares.report, { proxySecret: "", publicId: "a".repeat(22), reason: "other", note: "" }),
    ).rejects.toThrowError("FORBIDDEN");
  });

  it("needs a signed-in device and an active plan", async () => {
    const t = setup();
    await userWithPlan(t, "user_1", false);
    await expect(
      t.mutation(api.shares.beginForDevice, { proxySecret: SECRET, tokenHash: "unknown", bytes: 10 }),
    ).rejects.toThrowError("UNAUTHENTICATED");
    await expect(
      t.mutation(api.shares.beginForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", bytes: 10 }),
    ).rejects.toThrowError("PAYMENT_REQUIRED");
  });

  it("refuses a page over 5 MB and more than the daily limit", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await expect(
      t.mutation(api.shares.beginForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", bytes: 6 * 1024 * 1024 }),
    ).rejects.toThrowError("FORBIDDEN");
    for (let i = 0; i < MAX_SHARES_PER_DAY; i++) await share(t, "hash_user_1");
    await expect(share(t, "hash_user_1")).rejects.toThrowError("RATE_LIMITED");
  });

  it("a refused finish keeps nothing", async () => {
    const t = setup();
    await userWithPlan(t, "user_1", false);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));
    expect(
      await t.mutation(api.shares.finishForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", storageId, title: "t", kind: "document" }),
    ).toMatchObject({ ok: false, code: "PAYMENT_REQUIRED" });
    expect(await t.run(async (ctx) => (await ctx.storage.get(storageId)) === null)).toBe(true);
  });

  it("another user can't unshare my page", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await userWithPlan(t, "user_2");
    const { publicId } = await share(t, "hash_user_1");
    await expect(
      t.mutation(api.shares.removeForDevice, { proxySecret: SECRET, tokenHash: "hash_user_2", publicId }),
    ).rejects.toThrowError("NOT_FOUND");
    expect((await t.query(api.shares.view, { publicId }))?.state).toBe("live");
  });

  it("only staff with a second factor see reports and take pages down", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    const { publicId } = await share(t, "hash_user_1");
    await expect(t.query(api.shares.openReports, {})).rejects.toThrowError("UNAUTHENTICATED");
    await expect(t.withIdentity(identity("user_1")).query(api.shares.openReports, {})).rejects.toThrowError("FORBIDDEN");
    await expect(t.withIdentity(identity("staff_1")).query(api.shares.openReports, {})).rejects.toThrowError("FORBIDDEN");
    await expect(
      t.withIdentity(identity("user_1")).mutation(api.shares.decide, { publicId, decision: "removed", reason: "x" }),
    ).rejects.toThrowError("FORBIDDEN");
    expect((await t.query(api.shares.view, { publicId }))?.state).toBe("live");
  });
});

describe("sharing", () => {
  it("shares, shows and unshares a page", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    const { publicId } = await share(t, "hash_user_1");
    expect(publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const page = await t.query(api.shares.view, { publicId });
    expect(page).toMatchObject({ state: "live", title: "Market report", kind: "document" });
    // Nothing about the owner is public.
    expect(JSON.stringify(page)).not.toContain("user_1");

    await t.mutation(api.shares.removeForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", publicId });
    expect(await t.query(api.shares.view, { publicId })).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("sharedArtifacts").collect())).toEqual([]);
  });

  it("an unknown or malformed id shows nothing", async () => {
    const t = setup();
    expect(await t.query(api.shares.view, { publicId: "nope" })).toBeNull();
    expect(await t.query(api.shares.view, { publicId: "a".repeat(22) })).toBeNull();
  });

  it("a report, then a takedown, removes the snapshot and keeps the record", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    const { publicId } = await share(t, "hash_user_1");
    await t.mutation(api.shares.report, {
      proxySecret: SECRET,
      publicId,
      reason: "privacy",
      note: "My phone number is on it",
      email: "reporter@example.com",
    });
    const open = await admin(t).query(api.shares.openReports, {});
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ reason: "privacy", email: "reporter@example.com" });

    await admin(t).mutation(api.shares.decide, { publicId, decision: "removed", reason: "Personal data without consent" });
    expect((await t.query(api.shares.view, { publicId }))?.state).toBe("removed");
    const [row] = await t.run((ctx) => ctx.db.query("sharedArtifacts").collect());
    expect(row.storageId).toBeUndefined();
    expect(row.takedownReason).toBe("Personal data without consent");
    expect(await admin(t).query(api.shares.openReports, {})).toEqual([]);
    // The owner can't quietly erase the record of a takedown.
    await t.mutation(api.shares.removeForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", publicId });
    expect((await t.query(api.shares.view, { publicId }))?.state).toBe("removed");
  });

  it("an email that isn't one is not kept", async () => {
    const t = setup();
    await userWithPlan(t, "user_1");
    const { publicId } = await share(t, "hash_user_1");
    await t.mutation(api.shares.report, { proxySecret: SECRET, publicId, reason: "other", note: "x", email: "not an email" });
    const [r] = await t.run((ctx) => ctx.db.query("shareReports").collect());
    expect(r.email).toBeUndefined();
  });

  it("reporting an unknown page fails", async () => {
    const t = setup();
    await expect(
      t.mutation(api.shares.report, { proxySecret: SECRET, publicId: "b".repeat(22), reason: "other", note: "" }),
    ).rejects.toThrowError("NOT_FOUND");
  });
});

