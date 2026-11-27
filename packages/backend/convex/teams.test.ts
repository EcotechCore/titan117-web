import { generateDeviceKey } from "@titan117/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { sha256Hex } from "./lib/tokens";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
type Reply = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T0 = Date.UTC(2026, 10, 27, 12);
const SEALED = "k".repeat(200);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function user(t: T, clerkId: string, plan: "starter" | "team" | "agency" | null = null, seats = 3) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  if (plan)
    await t.mutation(internal.billing.applyEvent, {
      eventId: `evt_${clerkId}`,
      type: "customer.subscription.created",
      subscription: {
        subscriptionId: `sub_${clerkId}`,
        customerId: `cus_${clerkId}`,
        userId,
        status: "active",
        plan,
        interval: "month",
        periodStart: T0,
        periodEnd: addMonths(T0, 1),
        seats,
        cancelAtPeriodEnd: false,
      },
      topup: null,
    });
  return { userId, as: t.withIdentity(identity(clerkId)) };
}

/** Ana owns a Team plan with three seats; Bo joins as a member and Cy as a viewer. */
async function teamOfThree(t: T, plan: "team" | "agency" = "team") {
  const ana = await user(t, "ana", plan, 3);
  const bo = await user(t, "bo");
  const cy = await user(t, "cy");
  const teamId = await ana.as.mutation(api.teams.create, { name: "Acme", myName: "Ana" });
  const { code: c1 } = await ana.as.action(api.teams.invite, { teamId, role: "member" });
  await bo.as.action(api.teams.join, { code: c1, name: "Bo" });
  const { code: c2 } = await ana.as.action(api.teams.invite, { teamId, role: "viewer" });
  await cy.as.action(api.teams.join, { code: c2, name: "Cy" });
  return { ana, bo, cy, teamId };
}

async function laptop(t: T, userId: Id<"users">, token: string, name: string) {
  return await t.run(async (ctx) => ctx.db.insert("devices", { userId, name, tokenHash: await sha256Hex(token), createdAt: T0 }));
}

const tok = (c: string) => "t117d_" + c.repeat(43);

async function relay(t: T, token: string, body: object) {
  const res = await t.fetch("/desktop/team", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Reply };
}

async function upload(t: T, token: string, teamId: string, kind: string, keyGen: number) {
  const res = await t.fetch("/desktop/team/package", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Titan117-Team": teamId, "X-Titan117-Kind": kind, "X-Titan117-Key-Gen": String(keyGen) },
    body: "sealed package bytes",
  });
  return { status: res.status, body: (await res.json()) as Reply };
}

describe("making a team", () => {
  it("needs the caller's own Team or Agency plan", async () => {
    const t = setup();
    const nobody = await user(t, "x");
    const starter = await user(t, "y", "starter");
    await expect(nobody.as.mutation(api.teams.create, { name: "Acme", myName: "X" })).rejects.toThrow("PAYMENT_REQUIRED");
    await expect(starter.as.mutation(api.teams.create, { name: "Acme", myName: "Y" })).rejects.toThrow("PAYMENT_REQUIRED");
    await expect(t.mutation(api.teams.create, { name: "Acme", myName: "Z" })).rejects.toThrow("UNAUTHENTICATED");
  });

  it("allows one team on Team and several on Agency", async () => {
    const t = setup();
    const team = await user(t, "a", "team");
    await team.as.mutation(api.teams.create, { name: "One", myName: "A" });
    await expect(team.as.mutation(api.teams.create, { name: "Two", myName: "A" })).rejects.toThrow("FORBIDDEN");
    const agency = await user(t, "b", "agency");
    await agency.as.mutation(api.teams.create, { name: "Client one", myName: "B" });
    await agency.as.mutation(api.teams.create, { name: "Client two", myName: "B" });
    expect((await agency.as.query(api.teams.mine, {})).teams).toHaveLength(2);
  });
});

describe("invites and seats", () => {
  it("covers a team of three on the owner's plan, and their calls spend the team's pool", async () => {
    const t = setup();
    const { ana, bo, cy, teamId } = await teamOfThree(t);
    const team = await bo.as.query(api.teams.get, { teamId });
    expect(team.members.map((m) => [m.name, m.role, m.covered])).toEqual([
      ["Ana", "owner", true],
      ["Bo", "member", true],
      ["Cy", "viewer", true],
    ]);
    // Bo has no plan of his own, yet his laptop gets a lease with the team's plan.
    const device = await laptop(t, bo.userId, tok("b"), "Bo's laptop");
    const lease = await t.mutation(internal.devices.leaseFor, { tokenHash: await sha256Hex(tok("b")), appVersion: "1" });
    expect(lease?.plan).toBe("team");
    expect(lease?.devices).toBe(3);
    expect(device).toBeTruthy();
    // A cloud call of Bo's is charged to Ana's pool (3 seats × 1,000), with Bo named on it.
    const secret = "s".repeat(40);
    vi.stubEnv("PROXY_SECRET", secret);
    const { callId } = await t.mutation(api.proxy.beginForDevice, { proxySecret: secret, tokenHash: await sha256Hex(tok("b")), model: "m" });
    await t.mutation(api.proxy.settle, { proxySecret: secret, callId, costUsd: 0.08 });
    const ledger = await t.run(async (ctx) => (await ctx.db.query("creditLedger").collect()).filter((l) => l.reason === "usage"));
    expect(ledger.map((l) => [l.userId, l.byUserId, l.amount])).toEqual([[ana.userId, bo.userId, -10]]);
    void cy;
  });

  it("refuses an invite past the seats, a used code and a bad code", async () => {
    const t = setup();
    const { ana, teamId } = await teamOfThree(t);
    await expect(ana.as.action(api.teams.invite, { teamId, role: "member" })).rejects.toThrow("FORBIDDEN");
    const dee = await user(t, "dee");
    await expect(dee.as.action(api.teams.join, { code: "x".repeat(32), name: "Dee" })).rejects.toThrow("NOT_FOUND");
    await expect(dee.as.action(api.teams.join, { code: "short", name: "Dee" })).rejects.toThrow("NOT_FOUND");
  });

  it("uses an invite once and expires it after a week", async () => {
    const t = setup();
    const ana = await user(t, "ana", "team", 5);
    const bo = await user(t, "bo");
    const cy = await user(t, "cy");
    const teamId = await ana.as.mutation(api.teams.create, { name: "Acme", myName: "Ana" });
    const { code } = await ana.as.action(api.teams.invite, { teamId, role: "member" });
    expect(await bo.as.query(api.teams.inviteInfo, { code })).toEqual({ team: "Acme", role: "member", already: false });
    await bo.as.action(api.teams.join, { code, name: "Bo" });
    await expect(cy.as.action(api.teams.join, { code, name: "Cy" })).rejects.toThrow("NOT_FOUND");
    const { code: late } = await ana.as.action(api.teams.invite, { teamId, role: "member" });
    vi.setSystemTime(T0 + 8 * 24 * 60 * 60 * 1000);
    expect(await cy.as.query(api.teams.inviteInfo, { code: late })).toBeNull();
    await expect(cy.as.action(api.teams.join, { code: late, name: "Cy" })).rejects.toThrow("NOT_FOUND");
  });

  it("lets only the owner invite admins, and nobody invite a member or viewer to invite", async () => {
    const t = setup();
    const { ana, bo, cy, teamId } = await teamOfThree(t);
    await expect(bo.as.action(api.teams.invite, { teamId, role: "viewer" })).rejects.toThrow("FORBIDDEN");
    await expect(cy.as.action(api.teams.invite, { teamId, role: "viewer" })).rejects.toThrow("FORBIDDEN");
    await ana.as.mutation(api.teams.setRole, { memberId: (await memberId(t, teamId, bo.userId))!, role: "admin" });
    // Seats are full, but the role check comes first for an admin asking for an admin.
    await expect(bo.as.action(api.teams.invite, { teamId, role: "admin" })).rejects.toThrow("FORBIDDEN");
  });

  it("drops cover for the latest to join when the owner lowers the seats", async () => {
    const t = setup();
    const { ana, cy, teamId } = await teamOfThree(t);
    await t.mutation(internal.billing.applyEvent, {
      eventId: "evt_ana_2",
      type: "customer.subscription.updated",
      subscription: {
        subscriptionId: "sub_ana",
        customerId: "cus_ana",
        userId: ana.userId,
        status: "active",
        plan: "team",
        interval: "month",
        periodStart: T0,
        periodEnd: addMonths(T0, 1),
        seats: 2,
        cancelAtPeriodEnd: false,
      },
      topup: null,
    });
    const team = await ana.as.query(api.teams.get, { teamId });
    expect(team.members.find((m) => m.name === "Cy")?.covered).toBe(false);
    await laptop(t, cy.userId, tok("c"), "Cy's laptop");
    expect((await t.mutation(internal.devices.leaseFor, { tokenHash: await sha256Hex(tok("c")), appVersion: "1" }))?.plan).toBeNull();
  });
});

async function memberId(t: T, teamId: Id<"teams">, userId: Id<"users">) {
  return await t.run(async (ctx) => (await ctx.db.query("teamMembers").collect()).find((m) => m.teamId === teamId && m.userId === userId)?._id);
}

describe("roles", () => {
  it("refuses role changes outside the rules", async () => {
    const t = setup();
    const { ana, bo, cy, teamId } = await teamOfThree(t);
    const anaId = (await memberId(t, teamId, ana.userId))!;
    const boId = (await memberId(t, teamId, bo.userId))!;
    const cyId = (await memberId(t, teamId, cy.userId))!;
    await expect(bo.as.mutation(api.teams.setRole, { memberId: cyId, role: "member" })).rejects.toThrow("FORBIDDEN");
    await expect(cy.as.mutation(api.teams.setRole, { memberId: cyId, role: "admin" })).rejects.toThrow("FORBIDDEN");
    await expect(ana.as.mutation(api.teams.setRole, { memberId: anaId, role: "member" })).rejects.toThrow("FORBIDDEN");
    await ana.as.mutation(api.teams.setRole, { memberId: boId, role: "admin" });
    await expect(bo.as.mutation(api.teams.removeMember, { memberId: anaId })).rejects.toThrow("FORBIDDEN");
    await expect(bo.as.mutation(api.teams.setRole, { memberId: cyId, role: "admin" })).rejects.toThrow("FORBIDDEN");
    await bo.as.mutation(api.teams.setRole, { memberId: cyId, role: "member" });
    await bo.as.mutation(api.teams.removeMember, { memberId: cyId });
    await expect(ana.as.mutation(api.teams.leave, { teamId })).rejects.toThrow("FORBIDDEN");
  });

  it("hides a team from people outside it", async () => {
    const t = setup();
    const { teamId } = await teamOfThree(t);
    const eve = await user(t, "eve", "team");
    await expect(eve.as.query(api.teams.get, { teamId })).rejects.toThrow("NOT_FOUND");
    await expect(eve.as.query(api.teams.auditLog, { teamId })).rejects.toThrow("NOT_FOUND");
    await expect(eve.as.mutation(api.teams.remove, { teamId })).rejects.toThrow("NOT_FOUND");
  });

  it("shows the audit log to owners and admins only, newest first", async () => {
    const t = setup();
    const { ana, bo, cy, teamId } = await teamOfThree(t);
    await expect(bo.as.query(api.teams.auditLog, { teamId })).rejects.toThrow("FORBIDDEN");
    await expect(cy.as.query(api.teams.auditLog, { teamId })).rejects.toThrow("FORBIDDEN");
    const log = await ana.as.query(api.teams.auditLog, { teamId });
    expect(log.map((r) => [r.actor, r.action])).toEqual([
      ["Cy", "member.joined"],
      ["Ana", "invite.created"],
      ["Bo", "member.joined"],
      ["Ana", "invite.created"],
      ["Ana", "team.created"],
    ]);
  });

  it("has no way to edit or delete an audit row but the team's own deletion", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname);
    const files = [...readdirSync(dir).map((f) => join(dir, f)), ...readdirSync(join(dir, "lib")).map((f) => join(dir, "lib", f))].filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.includes("_generated"),
    );
    const writers = files.filter((f) => /insert\("teamAudit"/.test(readFileSync(f, "utf8")));
    expect(writers.map((f) => f.replace(/\\/g, "/").split("/").slice(-2).join("/"))).toEqual(["lib/teams.ts"]);
  });
});

describe("white-label", () => {
  it("is for Agency owners, with a readable colour", async () => {
    const t = setup();
    const { ana, teamId } = await teamOfThree(t);
    const brand = { name: "Bright Studio", accent: "#1a5fd0", hideMadeWith: false };
    await expect(ana.as.mutation(api.teams.setBrand, { teamId, brand })).rejects.toThrow("PAYMENT_REQUIRED");
  });

  it("refuses non-owners, bad colours and hiding 'Made with' until the owner's rules allow it", async () => {
    const t = setup();
    const { ana, bo, teamId } = await teamOfThree(t, "agency");
    const brand = { name: "Bright Studio", accent: "#1a5fd0", hideMadeWith: false };
    await expect(bo.as.mutation(api.teams.setBrand, { teamId, brand })).rejects.toThrow("FORBIDDEN");
    await expect(ana.as.mutation(api.teams.setBrand, { teamId, brand: { ...brand, accent: "#ffee00" } })).rejects.toThrow("FORBIDDEN");
    await expect(ana.as.mutation(api.teams.setBrand, { teamId, brand: { ...brand, name: "Titan117" } })).rejects.toThrow("FORBIDDEN");
    await expect(ana.as.mutation(api.teams.setBrand, { teamId, brand: { ...brand, hideMadeWith: true } })).rejects.toThrow("FORBIDDEN");
    await ana.as.mutation(api.teams.setBrand, { teamId, brand });
    expect(await bo.as.query(api.teams.myBrand, {})).toMatchObject({ name: "Bright Studio", accent: "#1a5fd0" });
    vi.stubEnv("WHITE_LABEL_HIDE_MADE_WITH", "on");
    await ana.as.mutation(api.teams.setBrand, { teamId, brand: { ...brand, hideMadeWith: true } });
  });
});

describe("the team relay", () => {
  /** Ana's laptop makes the key; Bo's and Cy's wait until Ana lets them in. */
  async function relayOfThree(t: T) {
    const team = await teamOfThree(t);
    const teamId = team.teamId as string;
    await laptop(t, team.ana.userId, tok("a"), "Ana's laptop");
    await laptop(t, team.bo.userId, tok("b"), "Bo's laptop");
    await laptop(t, team.cy.userId, tok("c"), "Cy's laptop");
    const [ka, kb, kc] = [(await generateDeviceKey(true)).publicKey, (await generateDeviceKey(true)).publicKey, (await generateDeviceKey(true)).publicKey];
    // A member's laptop can't be first: only the owner's makes the key.
    expect((await relay(t, tok("b"), { teamId, on: true, publicKey: kb })).status).toBe(403);
    const a1 = await relay(t, tok("a"), { teamId, on: true, publicKey: ka });
    expect(a1.body.me.status).toBe("in");
    const b1 = await relay(t, tok("b"), { teamId, on: true, publicKey: kb });
    const c1 = await relay(t, tok("c"), { teamId, on: true, publicKey: kc });
    expect([b1.body.me.status, c1.body.me.status]).toEqual(["waiting", "waiting"]);
    const gen = a1.body.keyGen as number;
    // Bo (a member) can't let Cy in.
    await relay(t, tok("b"), { teamId, on: true, publicKey: kb, admit: { laptopId: c1.body.me.id, sealedKey: SEALED, keyMsgId: "msg-0001", keyGen: gen } });
    for (const [laptopId, n] of [[b1.body.me.id, 1], [c1.body.me.id, 2]] as const)
      await relay(t, tok("a"), { teamId, on: true, publicKey: ka, admit: { laptopId, sealedKey: SEALED, keyMsgId: `msg-000${n}`, keyGen: gen } });
    return { ...team, teamId, gen, keys: { ka, kb, kc } };
  }

  it("lets laptops in only from an owner's or admin's laptop", async () => {
    const t = setup();
    const { teamId, keys } = await relayOfThree(t);
    const b = await relay(t, tok("b"), { teamId, on: true, publicKey: keys.kb });
    expect(b.body.me.status).toBe("in");
    expect(b.body.laptops.map((l: Reply) => [l.person, l.role])).toEqual([
      ["Ana", "owner"],
      ["Bo", "member"],
      ["Cy", "viewer"],
    ]);
  });

  it("enforces roles on packages: viewers send nothing, members share and change data", async () => {
    const t = setup();
    const { ana, teamId, gen } = await relayOfThree(t);
    expect((await upload(t, tok("a"), teamId, "item", gen)).status).toBe(200);
    expect((await upload(t, tok("b"), teamId, "item", gen)).status).toBe(200);
    expect((await upload(t, tok("b"), teamId, "data", gen)).status).toBe(200);
    expect((await upload(t, tok("c"), teamId, "data", gen)).status).toBe(403);
    expect((await upload(t, tok("c"), teamId, "item", gen)).status).toBe(403);
    expect((await upload(t, tok("b"), teamId, "data", gen + 1)).status).toBe(403);
    expect((await upload(t, tok("b"), teamId, "nonsense", gen)).status).toBe(400);
    const log = await ana.as.query(api.teams.auditLog, { teamId: teamId as Id<"teams"> });
    expect(log.filter((r) => r.action === "upload.refused").map((r) => r.actor)).toEqual(["Cy", "Cy"]);
    // Every package carries the sender's role for the laptops' own check.
    const c = await relay(t, tok("c"), { teamId, on: true });
    expect(c.body.changes.map((ch: Reply) => [ch.kind, ch.role])).toEqual([
      ["item", "owner"],
      ["item", "member"],
      ["data", "member"],
    ]);
  });

  it("refuses outsiders, other teams and laptops beyond the plan's cover", async () => {
    const t = setup();
    const { teamId, gen } = await relayOfThree(t);
    const eve = await user(t, "eve", "team");
    await laptop(t, eve.userId, tok("e"), "Eve's laptop");
    const ke = (await generateDeviceKey(true)).publicKey;
    expect((await relay(t, tok("e"), { teamId, on: true, publicKey: ke })).status).toBe(404);
    expect((await upload(t, tok("e"), teamId, "item", gen)).status).toBe(404);
    expect((await relay(t, "t117d_" + "z".repeat(43), { teamId, on: true })).status).toBe(401);
  });

  it("writes sealed notes about shared items only for roles that may share", async () => {
    const t = setup();
    const { ana, teamId, keys } = await relayOfThree(t);
    const note = "n".repeat(60);
    await relay(t, tok("b"), { teamId, on: true, publicKey: keys.kb, notes: [{ action: "item.shared", sealed: note }] });
    await relay(t, tok("c"), { teamId, on: true, publicKey: keys.kc, notes: [{ action: "item.shared", sealed: note }] });
    const shared = (await ana.as.query(api.teams.auditLog, { teamId: teamId as Id<"teams"> })).filter((r) => r.action === "item.shared");
    expect(shared.map((r) => [r.actor, r.sealed])).toEqual([["Bo", true]]);
    // Owners' and admins' laptops get the sealed notes to open; members' and viewers' don't.
    expect((await relay(t, tok("a"), { teamId, on: true })).body.notes).toMatchObject([{ actor: "Bo", action: "item.shared", sealed: note }]);
    expect((await relay(t, tok("b"), { teamId, on: true })).body.notes).toEqual([]);
    expect((await relay(t, tok("c"), { teamId, on: true })).body.notes).toEqual([]);
  });

  it("takes a removed member's laptops out and deletes the team's packages with the team", async () => {
    const t = setup();
    const { ana, bo, teamId, gen } = await relayOfThree(t);
    await upload(t, tok("b"), teamId, "data", gen);
    await ana.as.mutation(api.teams.removeMember, { memberId: (await memberId(t, teamId as Id<"teams">, bo.userId))! });
    expect((await relay(t, tok("b"), { teamId, on: true })).status).toBe(404);
    const a = await relay(t, tok("a"), { teamId, on: true });
    expect(a.body.laptops.map((l: Reply) => l.person)).toEqual(["Ana", "Cy"]);
    await ana.as.mutation(api.teams.remove, { teamId: teamId as Id<"teams"> });
    const left = await t.run(async (ctx) => ({
      changes: (await ctx.db.query("teamChanges").collect()).length,
      laptops: (await ctx.db.query("teamLaptops").collect()).length,
      audit: (await ctx.db.query("teamAudit").collect()).length,
    }));
    expect(left).toEqual({ changes: 0, laptops: 0, audit: 0 });
  });
});
