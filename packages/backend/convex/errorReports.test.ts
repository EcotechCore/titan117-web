import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { MAX_REPORTS_PER_DAY, signatureOf } from "./errorReports";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const SECRET = "s".repeat(48);
const T0 = Date.UTC(2026, 10, 15, 12);
const DAY = 24 * 60 * 60 * 1000;

async function userWithDevice(t: T, clerkId: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  await t.run((ctx) => ctx.db.insert("devices", { userId, name: "laptop", tokenHash: `hash_${clerkId}` }));
  return userId;
}

function report(tokenHash: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    proxySecret: SECRET,
    tokenHash,
    appVersion: "0.4.0",
    os: "win32 10.0.26200",
    feature: "runtime",
    message: "Cannot read properties of undefined (reading 'id') in task 4f2a9c1d",
    stack:
      "TypeError: Cannot read properties of undefined\n    at run (C:\\Users\\ana\\AppData\\app\\engine.js:120:5)\n    at async launch (C:\\Users\\ana\\AppData\\app\\engine.js:300:9)",
    logLines: ['{"level":"error","message":"boom"}'],
    note: "It stopped while reading invoices.",
    ...extra,
  };
}

const staff = (t: T) => t.withIdentity(identity("staff_1", { fva: [0, 0] }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  vi.stubEnv("PROXY_SECRET", SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("error report refusals (guardrails §2)", () => {
  it("needs our server's secret and a signed-in device", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    await expect(
      t.mutation(api.errorReports.submitForDevice, { ...report("hash_user_1"), proxySecret: "x".repeat(48) }),
    ).rejects.toThrowError("FORBIDDEN");
    await expect(t.mutation(api.errorReports.submitForDevice, report("unknown"))).rejects.toThrowError(
      "UNAUTHENTICATED",
    );
    await expect(
      t.mutation(api.errorReports.fixedForDevice, { proxySecret: SECRET, tokenHash: "unknown", refs: [] }),
    ).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("limits how many reports a user sends in a day", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    for (let i = 0; i < MAX_REPORTS_PER_DAY; i++)
      await t.mutation(api.errorReports.submitForDevice, report("hash_user_1"));
    await expect(t.mutation(api.errorReports.submitForDevice, report("hash_user_1"))).rejects.toThrowError(
      "RATE_LIMITED",
    );
  });

  it("only staff with a second factor see reports and mark fixes", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    await t.mutation(api.errorReports.submitForDevice, report("hash_user_1"));
    const [group] = await t.run((ctx) => ctx.db.query("errorGroups").collect());
    await expect(t.query(api.errorReports.groups, {})).rejects.toThrowError("UNAUTHENTICATED");
    await expect(t.withIdentity(identity("user_1")).query(api.errorReports.groups, {})).rejects.toThrowError(
      "FORBIDDEN",
    );
    await expect(
      t.withIdentity(identity("staff_1")).query(api.errorReports.groupReports, { groupId: group._id }),
    ).rejects.toThrowError("FORBIDDEN");
    await expect(
      t.withIdentity(identity("user_1")).mutation(api.errorReports.markFixed, { groupId: group._id, fixedIn: "1.4" }),
    ).rejects.toThrowError("FORBIDDEN");
  });

  it("another user's reference says nothing", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    await userWithDevice(t, "user_2");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    const { ref } = await t.mutation(api.errorReports.submitForDevice, report("hash_user_1"));
    const [group] = await t.run((ctx) => ctx.db.query("errorGroups").collect());
    await staff(t).mutation(api.errorReports.markFixed, { groupId: group._id, fixedIn: "1.4" });
    expect(
      await t.mutation(api.errorReports.fixedForDevice, { proxySecret: SECRET, tokenHash: "hash_user_2", refs: [ref] }),
    ).toEqual([]);
    expect(
      await t.mutation(api.errorReports.fixedForDevice, { proxySecret: SECRET, tokenHash: "hash_user_1", refs: [ref] }),
    ).toEqual([{ ref, fixedIn: "1.4" }]);
  });
});

describe("error reports", () => {
  it("groups the same error from different laptops and gives each a reference", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    await userWithDevice(t, "user_2");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin" }));
    const a = await t.mutation(api.errorReports.submitForDevice, report("hash_user_1"));
    const b = await t.mutation(
      api.errorReports.submitForDevice,
      report("hash_user_2", {
        appVersion: "0.4.1",
        message: "Cannot read properties of undefined (reading 'id') in task 9e8d7c6b",
        stack:
          "TypeError: x\n    at run (/Users/bo/Library/app/engine.js:121:7)\n    at async launch (/Users/bo/Library/app/engine.js:301:2)",
      }),
    );
    expect(a.ref).toMatch(/^T117-[0-9A-F]{6}$/);
    expect(b.ref).not.toBe(a.ref);
    const groups = await staff(t).query(api.errorReports.groups, {});
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 2, versions: ["0.4.0", "0.4.1"], feature: "runtime" });
    // The portal sees the reports, never who sent them.
    const reports = await staff(t).query(api.errorReports.groupReports, { groupId: groups[0]._id! });
    expect(reports).toHaveLength(2);
    expect(JSON.stringify(reports)).not.toContain("userId");
  });

  it("scrubs anything shaped like a key or token again before storing", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    const key = ["sk", "or", "v1", "a".repeat(40)].join("-");
    await t.mutation(
      api.errorReports.submitForDevice,
      report("hash_user_1", { note: `my key is ${key}`, logLines: [`token t117d_${"b".repeat(40)}`] }),
    );
    const [row] = await t.run((ctx) => ctx.db.query("errorReports").collect());
    expect(JSON.stringify(row)).not.toContain(key);
    expect(JSON.stringify(row)).not.toContain("t117d_bbbb");
    expect(row.note).toBe("my key is [redacted]");
  });

  it("keeps reports 90 days; groups keep their counts", async () => {
    const t = setup();
    await userWithDevice(t, "user_1");
    await t.mutation(api.errorReports.submitForDevice, report("hash_user_1"));
    vi.setSystemTime(T0 + 89 * DAY);
    await t.mutation(internal.errorReports.prune, {});
    expect(await t.run((ctx) => ctx.db.query("errorReports").collect())).toHaveLength(1);
    vi.setSystemTime(T0 + 91 * DAY);
    await t.mutation(internal.errorReports.prune, {});
    expect(await t.run((ctx) => ctx.db.query("errorReports").collect())).toHaveLength(0);
    const [group] = await t.run((ctx) => ctx.db.query("errorGroups").collect());
    expect(group.count).toBe(1);
  });

  it("the signature ignores numbers, ids, quoted text and paths", () => {
    expect(signatureOf("f", "Failed 3 times on 'a.txt'", "at x (C:\\a\\b.js:1:2)")).toBe(
      signatureOf("f", "Failed 7 times on 'b.txt'", "at x (/u/c.js:9:9)"),
    );
    expect(signatureOf("f", "One error", "")).not.toBe(signatureOf("f", "Another error", ""));
  });
});
