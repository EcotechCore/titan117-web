import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { MAX_REPORTS_PER_DAY, READS_PER_RUN, setGitHubFetch } from "./market";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const T0 = Date.UTC(2026, 10, 26, 12);
const SHA = "a".repeat(40);
const SHA2 = "b".repeat(40);

const manifest = (name: string, extra: Record<string, unknown> = {}) => ({
  titan: 1,
  type: "agent",
  name,
  title: name,
  version: "1.0.0",
  description: `The ${name} agent.`,
  agent: "agent.md",
  ...extra,
});

interface Repo {
  full_name: string;
  stars?: number;
  pushed?: string;
  file?: unknown;
  sha?: string;
}

/** A fake GitHub: search by topic, a commit per branch, titan.json at that commit. */
function fakeGitHub(repos: Repo[], calls: string[] = []) {
  setGitHubFetch(async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/search/repositories") {
      expect(url.searchParams.get("q")).toBe("topic:titan117-addon");
      const items = repos.map((r) => ({
        full_name: r.full_name,
        owner: { login: r.full_name.split("/")[0] },
        name: r.full_name.split("/")[1],
        stargazers_count: r.stars ?? 1,
        default_branch: "main",
        pushed_at: r.pushed ?? "2026-11-20T10:00:00Z",
        private: false,
        license: { spdx_id: "MIT" },
      }));
      return new Response(JSON.stringify({ total_count: items.length, items }), { status: 200 });
    }
    const repo = repos.find((r) => url.pathname.startsWith(`/repos/${r.full_name}/`));
    if (!repo) return new Response("{}", { status: 404 });
    if (url.pathname.endsWith("/commits/main")) return new Response(repo.sha ?? SHA, { status: 200 });
    if (url.pathname.endsWith("/contents/titan.json")) {
      if (repo.file === undefined) return new Response("{}", { status: 404 });
      return new Response(typeof repo.file === "string" ? repo.file : JSON.stringify(repo.file), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  setGitHubFetch(null);
});

const admin = (t: T) => t.withIdentity(identity("staff_1"));
async function staff(t: T) {
  await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_1", role: "admin", staffSecondFactorAt: Date.now() }));
}

describe("the marketplace index (decisions §66.3)", () => {
  it("lists repositories with the topic and a valid titan.json, and nothing else", async () => {
    const t = setup();
    fakeGitHub([
      { full_name: "Acme/invoice-clerk", stars: 12, file: manifest("invoice-clerk") },
      { full_name: "acme/broken", file: { titan: 1, type: "virus" } },
      { full_name: "acme/no-manifest" },
      { full_name: "acme/not-json", file: "{nope" },
    ]);
    const result = await t.action(internal.market.refresh, {});
    expect(result).toMatchObject({ found: 4, read: 4, complete: true });
    const items = await t.query(api.market.list, {});
    expect(items.map((i) => i.fullName)).toEqual(["acme/invoice-clerk"]);
    expect(items[0]).toMatchObject({ type: "agent", license: "MIT", stars: 12, commit: SHA, verified: false });
    // The code isn't kept: only the listing's fields.
    expect(Object.keys(items[0])).not.toContain("agent");
  });

  it("reads only what changed, a limited number a run, and drops what left the topic", async () => {
    const t = setup();
    const repos = Array.from({ length: READS_PER_RUN + 5 }, (_, i) => ({
      full_name: `acme/addon-${i}`,
      file: manifest(`addon-${i}`),
    }));
    fakeGitHub(repos);
    expect((await t.action(internal.market.refresh, {})).read).toBe(READS_PER_RUN);
    expect((await t.action(internal.market.refresh, {})).read).toBe(5);
    const calls: string[] = [];
    fakeGitHub(repos.slice(1), calls);
    const third = await t.action(internal.market.refresh, {});
    expect(third).toMatchObject({ read: 0, removed: 1 });
    expect(calls).toEqual(["/search/repositories"]);
    expect((await t.query(api.market.list, {})).length).toBe(READS_PER_RUN + 4);
  });

  it("searches, filters by type, and refuses a type that doesn't exist", async () => {
    const t = setup();
    fakeGitHub([
      { full_name: "acme/clerk", file: manifest("clerk") },
      { full_name: "acme/rates", file: { ...manifest("rates"), type: "skill", agent: undefined, skills: ["s.md"] } },
    ]);
    await t.action(internal.market.refresh, {});
    expect((await t.query(api.market.list, { type: "skill" })).map((i) => i.name)).toEqual(["rates"]);
    expect((await t.query(api.market.list, { q: "CLERK agent" })).map((i) => i.name)).toEqual(["clerk"]);
    expect(await t.query(api.market.list, { type: "virus" })).toEqual([]);
  });
});

describe("verified, reports and takedown (decisions §66.11)", () => {
  async function listed(t: T) {
    fakeGitHub([{ full_name: "acme/clerk", file: manifest("clerk") }]);
    await t.action(internal.market.refresh, {});
    const [item] = await t.run((ctx) => ctx.db.query("marketItems").collect());
    return item;
  }

  it("staff only: a user, a signed-out caller and staff without a fresh second factor are refused", async () => {
    const t = setup();
    const item = await listed(t);
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "staff_old", role: "admin" }));
    for (const who of [t, t.withIdentity(identity("user_1")), t.withIdentity(identity("staff_old"))]) {
      await expect(who.query(api.market.adminItems, {})).rejects.toThrowError(/UNAUTHENTICATED|FORBIDDEN/);
      await expect(who.mutation(api.market.setVerified, { itemId: item._id, commit: SHA })).rejects.toThrowError(
        /UNAUTHENTICATED|FORBIDDEN/,
      );
      await expect(
        who.mutation(api.market.decide, { itemId: item._id, decision: "removed", reason: "x" }),
      ).rejects.toThrowError(/UNAUTHENTICATED|FORBIDDEN/);
    }
  });

  it("verifies at a commit; a new commit loses the mark", async () => {
    const t = setup();
    await staff(t);
    const item = await listed(t);
    await expect(admin(t).mutation(api.market.setVerified, { itemId: item._id, commit: "main" })).rejects.toThrowError("FORBIDDEN");
    await admin(t).mutation(api.market.setVerified, { itemId: item._id, commit: SHA });
    expect(await t.query(api.market.get, { fullName: "acme/clerk" })).toMatchObject({ verified: true, verifiedCommit: SHA });
    fakeGitHub([{ full_name: "acme/clerk", file: manifest("clerk"), sha: SHA2, pushed: "2026-11-25T10:00:00Z" }]);
    await t.action(internal.market.refresh, {});
    expect(await t.query(api.market.get, { fullName: "acme/clerk" })).toMatchObject({ verified: false, commit: SHA2 });
  });

  it("takes reports from signed-in users only, limited, and a takedown hides the item for good", async () => {
    const t = setup();
    await staff(t);
    await listed(t);
    await expect(
      t.mutation(api.market.report, { fullName: "acme/clerk", reason: "malware", note: "x" }),
    ).rejects.toThrowError("UNAUTHENTICATED");
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    const user = t.withIdentity(identity("user_1"));
    await user.mutation(api.market.report, { fullName: "ACME/clerk", reason: "malware", note: "Sends my files to evil.example" });
    await user.mutation(api.market.report, { fullName: "acme/clerk", reason: "malware", note: "again" });
    const [row] = await admin(t).query(api.market.adminItems, {});
    expect(row.openReports).toHaveLength(1);
    await admin(t).mutation(api.market.decide, { itemId: row.id, decision: "removed", reason: "Exfiltrates files" });
    expect(await t.query(api.market.list, {})).toEqual([]);
    expect(await t.query(api.market.get, { fullName: "acme/clerk" })).toBeNull();
    expect(await t.query(api.market.status, { fullName: "acme/clerk" })).toEqual({
      listed: false,
      takenDown: true,
      verifiedCommit: null,
    });
    // It stays taken down after the next index run, even while it keeps the topic.
    await t.action(internal.market.refresh, {});
    expect(await t.query(api.market.status, { fullName: "acme/clerk" })).toMatchObject({ takenDown: true });
    await expect(
      user.mutation(api.market.report, { fullName: "acme/clerk", reason: "spam", note: "" }),
    ).rejects.toThrowError("NOT_FOUND");
  });

  it("limits reports a day per user", async () => {
    const t = setup();
    const repos = Array.from({ length: MAX_REPORTS_PER_DAY + 1 }, (_, i) => ({
      full_name: `acme/a${i}`,
      file: manifest(`a${i}`),
    }));
    fakeGitHub(repos);
    await t.action(internal.market.refresh, {});
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    const user = t.withIdentity(identity("user_1"));
    for (let i = 0; i < MAX_REPORTS_PER_DAY; i++)
      await user.mutation(api.market.report, { fullName: `acme/a${i}`, reason: "spam", note: "" });
    await expect(
      user.mutation(api.market.report, { fullName: `acme/a${MAX_REPORTS_PER_DAY}`, reason: "spam", note: "" }),
    ).rejects.toThrowError("RATE_LIMITED");
  });

  it("keeps reports without the reporter when the account is deleted", async () => {
    const t = setup();
    await listed(t);
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    await t.withIdentity(identity("user_1")).mutation(api.market.report, { fullName: "acme/clerk", reason: "spam", note: "n" });
    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });
    const reports = await t.run((ctx) => ctx.db.query("marketReports").collect());
    expect(reports).toHaveLength(1);
    expect(reports[0].reporterId).toBeUndefined();
  });
});
