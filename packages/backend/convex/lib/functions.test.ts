// Denial tests for the guardrail checks themselves (guardrails §2): each one
// is called as every wrong caller and must refuse with the right code.
import { describe, expect, it } from "vitest";

import { identity, setup } from "../test.setup";
import { hasSecondFactor, requireAdmin, requireDevice, requirePlan, requireUser } from "./functions";

type T = ReturnType<typeof setup>;
const DAY = 86_400_000;

const insertUser = (t: T, clerkId: string, role?: "admin") =>
  t.run((ctx) => ctx.db.insert("users", { clerkId, ...(role ? { role } : {}) }));

describe("requireUser", () => {
  it("refuses a signed-out caller", async () => {
    await expect(setup().run((ctx) => requireUser(ctx))).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("refuses a Clerk identity without a users row", async () => {
    const t = setup();
    await expect(t.withIdentity(identity("user_1")).run((ctx) => requireUser(ctx))).rejects.toThrowError(
      "UNAUTHENTICATED",
    );
  });

  it("returns the caller's own row", async () => {
    const t = setup();
    await insertUser(t, "user_1");
    await insertUser(t, "user_2");
    const user = await t.withIdentity(identity("user_2")).run((ctx) => requireUser(ctx));
    expect(user.clerkId).toBe("user_2");
  });
});

describe("requirePlan", () => {
  it("refuses a signed-out caller", async () => {
    await expect(setup().run((ctx) => requirePlan(ctx))).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("refuses a user without a plan", async () => {
    const t = setup();
    await insertUser(t, "user_1");
    await expect(t.withIdentity(identity("user_1")).run((ctx) => requirePlan(ctx))).rejects.toThrowError(
      "PAYMENT_REQUIRED",
    );
  });

  it("refuses an expired plan", async () => {
    const t = setup();
    const userId = await insertUser(t, "user_1");
    await t.run((ctx) => ctx.db.insert("entitlements", { userId, plan: "pro", activeUntil: Date.now() - DAY }));
    await expect(t.withIdentity(identity("user_1")).run((ctx) => requirePlan(ctx))).rejects.toThrowError(
      "PAYMENT_REQUIRED",
    );
  });

  it("refuses when only another user has a plan", async () => {
    const t = setup();
    await insertUser(t, "user_1");
    const other = await insertUser(t, "user_2");
    await t.run((ctx) =>
      ctx.db.insert("entitlements", { userId: other, plan: "pro", activeUntil: Date.now() + DAY }),
    );
    await expect(t.withIdentity(identity("user_1")).run((ctx) => requirePlan(ctx))).rejects.toThrowError(
      "PAYMENT_REQUIRED",
    );
  });

  it("allows an active plan", async () => {
    const t = setup();
    const userId = await insertUser(t, "user_1");
    await t.run((ctx) => ctx.db.insert("entitlements", { userId, plan: "starter", activeUntil: Date.now() + DAY }));
    const { entitlement } = await t.withIdentity(identity("user_1")).run((ctx) => requirePlan(ctx));
    expect(entitlement.plan).toBe("starter");
  });
});

describe("requireDevice", () => {
  async function seed(t: T) {
    const mine = await insertUser(t, "user_1");
    const theirs = await insertUser(t, "user_2");
    return await t.run(async (ctx) => ({
      myDevice: await ctx.db.insert("devices", { userId: mine, name: "laptop" }),
      revoked: await ctx.db.insert("devices", { userId: mine, name: "old", revokedAt: Date.now() }),
      theirDevice: await ctx.db.insert("devices", { userId: theirs, name: "theirs" }),
    }));
  }

  it("refuses a signed-out caller", async () => {
    const t = setup();
    const { myDevice } = await seed(t);
    await expect(t.run((ctx) => requireDevice(ctx, myDevice))).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("refuses another user's device as not found", async () => {
    const t = setup();
    const { theirDevice } = await seed(t);
    await expect(
      t.withIdentity(identity("user_1")).run((ctx) => requireDevice(ctx, theirDevice)),
    ).rejects.toThrowError("NOT_FOUND");
  });

  it("refuses a revoked device", async () => {
    const t = setup();
    const { revoked } = await seed(t);
    await expect(t.withIdentity(identity("user_1")).run((ctx) => requireDevice(ctx, revoked))).rejects.toThrowError(
      "FORBIDDEN",
    );
  });

  it("allows the caller's own paired device", async () => {
    const t = setup();
    const { myDevice } = await seed(t);
    const { device } = await t.withIdentity(identity("user_1")).run((ctx) => requireDevice(ctx, myDevice));
    expect(device.name).toBe("laptop");
  });
});

describe("requireAdmin", () => {
  const twoFactor = { fva: [3, 3] };

  it("refuses a signed-out caller", async () => {
    await expect(setup().run((ctx) => requireAdmin(ctx))).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("refuses a user who isn't an admin, even with two-factor", async () => {
    const t = setup();
    await insertUser(t, "user_1");
    await expect(
      t.withIdentity(identity("user_1", twoFactor)).run((ctx) => requireAdmin(ctx)),
    ).rejects.toThrowError("FORBIDDEN");
  });

  it("refuses an admin whose session has no second factor", async () => {
    const t = setup();
    await insertUser(t, "admin_1", "admin");
    await expect(
      t.withIdentity(identity("admin_1", { fva: [3, -1] })).run((ctx) => requireAdmin(ctx)),
    ).rejects.toThrowError("FORBIDDEN");
  });

  it("allows an admin with a second factor", async () => {
    const t = setup();
    await insertUser(t, "admin_1", "admin");
    const { user } = await t.withIdentity(identity("admin_1", twoFactor)).run((ctx) => requireAdmin(ctx));
    expect(user.role).toBe("admin");
  });
});

describe("hasSecondFactor", () => {
  it.each([
    [{}, false],
    [{ fva: [1, -1] }, false],
    [{ fva: "[1,1]" }, false],
    [{ fva: [1, 0] }, true],
  ])("%j → %s", (claims, expected) => {
    expect(hasSecondFactor(claims)).toBe(expected);
  });
});
