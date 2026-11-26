import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { identity, setup } from "./test.setup";

const T0 = Date.UTC(2026, 10, 26, 9);
/** Not a real Clerk token: with the check on, it is always refused. */
const FAKE_SESSION = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzdGFmZl8xIn0.c2ln";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.stubEnv("CLERK_JWT_KEY", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("staff second factor (decisions §65.8)", () => {
  it("is refused without a fresh second factor, and remote control's switch doesn't skip it", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    vi.stubEnv("REMOTE_TWO_FACTOR", "off-until-clerk-pro");
    await expect(
      t.withIdentity(identity("staff_1")).action(api.staff.confirmSecondFactor, { sessionToken: FAKE_SESSION }),
    ).rejects.toThrowError("FORBIDDEN");
    await expect(t.withIdentity(identity("staff_1")).query(api.errorReports.groups, {})).rejects.toThrowError("FORBIDDEN");
  });

  it("admits staff for 8 hours after it, and never someone who isn't staff", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    // The check itself needs Clerk Pro; the portal's own switch stands in for it here.
    vi.stubEnv("PORTAL_TWO_FACTOR", "off-until-clerk-pro");
    await expect(
      t.withIdentity(identity("user_1")).action(api.staff.confirmSecondFactor, { sessionToken: FAKE_SESSION }),
    ).rejects.toThrowError("FORBIDDEN");
    const { until } = await t.withIdentity(identity("staff_1")).action(api.staff.confirmSecondFactor, { sessionToken: FAKE_SESSION });
    expect(until - T0 - 8 * 3600_000).toBeLessThan(5);
    vi.stubEnv("PORTAL_TWO_FACTOR", "");
    expect(await t.withIdentity(identity("staff_1")).query(api.errorReports.groups, {})).toEqual([]);
    vi.setSystemTime(T0 + 8 * 3600_000 + 5000);
    await expect(t.withIdentity(identity("staff_1")).query(api.errorReports.groups, {})).rejects.toThrowError("FORBIDDEN");
  });
});
