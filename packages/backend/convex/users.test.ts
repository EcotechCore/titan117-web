import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const DAY = 86_400_000;

const countUsers = (t: T) => t.run(async (ctx) => (await ctx.db.query("users").collect()).length);

describe("ensureUser", () => {
  it("refuses a signed-out caller", async () => {
    const t = setup();
    await expect(t.mutation(api.users.ensureUser)).rejects.toThrowError("UNAUTHENTICATED");
    expect(await countUsers(t)).toBe(0);
  });

  it("creates the caller's row once, holding only the Clerk id", async () => {
    const t = setup();
    const asAda = t.withIdentity(identity("user_1", { email: "ada@example.com", name: "Ada" }));
    const first = await asAda.mutation(api.users.ensureUser);
    const second = await asAda.mutation(api.users.ensureUser);
    expect(second).toBe(first);
    const row = await t.run((ctx) => ctx.db.get(first));
    expect(row).toEqual({ _id: first, _creationTime: row!._creationTime, clerkId: "user_1" });
  });
});

describe("me", () => {
  it("refuses a signed-out caller", async () => {
    await expect(setup().query(api.users.me)).rejects.toThrowError("UNAUTHENTICATED");
  });

  it("says whether the caller is an admin", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "admin_1", role: "admin" }));
    expect(await t.withIdentity(identity("user_1")).query(api.users.me)).toEqual({ isAdmin: false });
    expect(await t.withIdentity(identity("admin_1")).query(api.users.me)).toEqual({ isAdmin: true });
  });
});

describe("webhook mutations", () => {
  it("upsertFromClerk is idempotent and agrees with ensureUser", async () => {
    const t = setup();
    await t.mutation(internal.users.upsertFromClerk, { clerkId: "user_1" });
    await t.mutation(internal.users.upsertFromClerk, { clerkId: "user_1" });
    await t.withIdentity(identity("user_1")).mutation(api.users.ensureUser);
    expect(await countUsers(t)).toBe(1);
  });

  it("deleteFromClerk removes the user's rows and nobody else's", async () => {
    const t = setup();
    const ada = await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_1" }));
    const bob = await t.run((ctx) => ctx.db.insert("users", { clerkId: "user_2" }));
    await t.run(async (ctx) => {
      for (const userId of [ada, bob]) {
        await ctx.db.insert("entitlements", { userId, plan: "pro", activeUntil: Date.now() + DAY });
        await ctx.db.insert("devices", { userId, name: "laptop" });
      }
    });

    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });
    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });

    const left = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).map((u) => u.clerkId),
      entitlements: (await ctx.db.query("entitlements").collect()).map((e) => e.userId),
      devices: (await ctx.db.query("devices").collect()).map((d) => d.userId),
    }));
    expect(left).toEqual({ users: ["user_2"], entitlements: [bob], devices: [bob] });
  });
});

// The Clerk webhook end to end in Convex's runtime, signed the way Clerk signs
// (Standard Webhooks: HMAC-SHA256 over "id.timestamp.body", svix-* headers).
describe("Clerk webhook", () => {
  const key = new Uint8Array(32).map((_, i) => i + 1);
  const secret = `whsec_${btoa(String.fromCharCode(...key))}`;

  beforeEach(() => vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", secret));
  afterEach(() => vi.unstubAllEnvs());

  async function signed(event: object, signWith = key) {
    const body = JSON.stringify(event);
    const id = "msg_1";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = await crypto.subtle.importKey("raw", signWith, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", hmac, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
    const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return {
      method: "POST",
      body,
      headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` },
    };
  }

  const created = { type: "user.created", object: "event", data: { id: "user_9", object: "user" } };
  const deleted = { type: "user.deleted", object: "event", data: { id: "user_9", object: "user", deleted: true } };

  it("creates and deletes users from correctly signed events", async () => {
    const t = setup();
    expect((await t.fetch("/clerk", await signed(created))).status).toBe(200);
    expect(await countUsers(t)).toBe(1);
    expect((await t.fetch("/clerk", await signed(deleted))).status).toBe(200);
    expect(await countUsers(t)).toBe(0);
  });

  it("refuses an event signed with another key", async () => {
    const t = setup();
    const res = await t.fetch("/clerk", await signed(created, new Uint8Array(32).fill(7)));
    expect(res.status).toBe(400);
    expect(await countUsers(t)).toBe(0);
  });

  it("refuses an unsigned event", async () => {
    const t = setup();
    const res = await t.fetch("/clerk", { method: "POST", body: JSON.stringify(created) });
    expect(res.status).toBe(400);
    expect(await countUsers(t)).toBe(0);
  });

  it("refuses everything when the secret isn't set", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const t = setup();
    const res = await t.fetch("/clerk", await signed(created));
    expect(res.status).toBe(500);
    expect(await countUsers(t)).toBe(0);
  });
});
