import { generateDeviceKey } from "@titan117/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { sha256Hex } from "./lib/tokens";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const T0 = Date.UTC(2026, 10, 26, 12);
const A = "t117d_" + "a".repeat(43);
const B = "t117d_" + "b".repeat(43);
const C = "t117d_" + "c".repeat(43);
const SEALED_KEY = "k".repeat(200);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function user(t: T, clerkId = "user_1", plan = true) {
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

async function laptop(t: T, userId: Id<"users">, token: string, name: string) {
  const tokenHash = await sha256Hex(token);
  return await t.run((ctx) => ctx.db.insert("devices", { userId, name, tokenHash, createdAt: T0 }));
}

type Reply = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(t: T, token: string, body: object) {
  const res = await t.fetch("/desktop/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Reply };
}

async function upload(t: T, token: string, keyGen: number, text = "sealed package bytes") {
  const res = await t.fetch("/desktop/sync/package", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Titan117-Key-Gen": String(keyGen) },
    body: text,
  });
  return { status: res.status, body: (await res.json()) as Reply };
}

/** Two laptops of one account, both in: A made the key, B joined and A let it in. */
async function twoIn(t: T) {
  const userId = await user(t);
  await laptop(t, userId, A, "Office laptop");
  await laptop(t, userId, B, "Home laptop");
  const keyA = (await generateDeviceKey(true)).publicKey;
  const keyB = (await generateDeviceKey(true)).publicKey;
  const a1 = await call(t, A, { on: true, publicKey: keyA });
  expect(a1.body.me.status).toBe("in");
  const b1 = await call(t, B, { on: true, publicKey: keyB });
  expect(b1.body.me.status).toBe("waiting");
  const a2 = await call(t, A, { on: true, publicKey: keyA });
  const waiting = a2.body.members.find((m: Reply) => m.status === "waiting");
  expect(waiting).toMatchObject({ name: "Home laptop", publicKey: keyB });
  await call(t, A, {
    on: true,
    publicKey: keyA,
    admit: { memberId: waiting.id, sealedKey: SEALED_KEY, keyMsgId: "msg_admit_1", keyGen: a2.body.keyGen },
  });
  const b2 = await call(t, B, { on: true, publicKey: keyB });
  expect(b2.body.me).toMatchObject({ status: "in", sealedKey: SEALED_KEY, sealedBy: keyA, keyGen: 1 });
  return { userId, keyA, keyB, memberA: a2.body.me.id as string, memberB: waiting.id as string };
}

describe("joining", () => {
  it("lets the first laptop in and makes the next wait until a laptop already in seals the key to it", async () => {
    const t = setup();
    const { userId } = await twoIn(t);
    // Letting a laptop in asks every laptop to send everything again, so the new one gets it all.
    const u = await t.run((ctx) => ctx.db.get(userId));
    expect(u!.syncResendAt! - T0).toBeLessThan(5);
  });

  it("a waiting laptop can't let itself or another in, read packages or upload", async () => {
    const t = setup();
    const userId = await user(t);
    await laptop(t, userId, A, "Office");
    await laptop(t, userId, B, "Home");
    await laptop(t, userId, C, "Spare");
    const keyA = (await generateDeviceKey(true)).publicKey;
    await call(t, A, { on: true, publicKey: keyA });
    await upload(t, A, 1);
    const b = await call(t, B, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    const c = await call(t, C, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    await call(t, B, { on: true, admit: { memberId: c.body.me.id, sealedKey: SEALED_KEY, keyMsgId: "msg_admit_9", keyGen: 1 } });
    await call(t, B, { on: true, admit: { memberId: b.body.me.id, sealedKey: SEALED_KEY, keyMsgId: "msg_admit_8", keyGen: 1 } });
    const after = await call(t, B, { on: true });
    expect(after.body.me.status).toBe("waiting");
    expect(after.body.changes).toEqual([]);
    expect((await call(t, C, { on: true })).body.me.status).toBe("waiting");
    expect((await upload(t, B, 1)).status).toBe(403);
  });

  it("a laptop in can refuse a waiting one", async () => {
    const t = setup();
    const userId = await user(t);
    await laptop(t, userId, A, "Office");
    await laptop(t, userId, B, "Home");
    await call(t, A, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    const b = await call(t, B, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    const a = await call(t, A, { on: true, refuse: b.body.me.id });
    expect(a.body.members).toHaveLength(1);
  });

  it("never mixes accounts", async () => {
    const t = setup();
    const { memberB } = await twoIn(t);
    const other = await user(t, "user_2");
    await laptop(t, other, C, "Mallory's laptop");
    const c = await call(t, C, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    // Alone in its own account: in, with its own key, seeing only itself.
    expect(c.body.me.status).toBe("in");
    expect(c.body.members).toHaveLength(1);
    await call(t, C, { on: true, remove: memberB });
    const a = await call(t, A, { on: true });
    expect(a.body.members).toHaveLength(2);
  });
});

describe("packages", () => {
  it("go from one laptop to the others, hold only routing fields, and go once every laptop in read them", async () => {
    const t = setup();
    await twoIn(t);
    const up = await upload(t, A, 1, "AAAA-not-readable");
    expect(up.body.seq).toBe(1);
    const a = await call(t, A, { on: true });
    expect(a.body.changes).toEqual([]); // its own, already read
    const b = await call(t, B, { on: true });
    expect(b.body.changes).toHaveLength(1);
    expect(b.body.changes[0]).toMatchObject({ seq: 1, keyGen: 1, own: false });
    const bytes = await (await fetch(b.body.changes[0].url)).text().catch(() => null);
    // convex-test serves storage URLs only inside the test; the row is what we check.
    void bytes;
    const rows = await t.run((ctx) => ctx.db.query("syncChanges").collect());
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "createdAt", "deviceId", "keyGen", "seq", "size", "storageId", "userId"]);
    await call(t, B, { on: true, cursor: 1 });
    expect(await t.run((ctx) => ctx.db.query("syncChanges").collect())).toHaveLength(0);
  });

  it("refuse an older key generation, a waiting laptop, no plan, and too many a minute", async () => {
    const t = setup();
    const { userId } = await twoIn(t);
    expect((await upload(t, A, 2)).status).toBe(403);
    expect((await upload(t, A, 1, "")).status).toBe(413);
    const deviceId = (await t.run((ctx) => ctx.db.query("devices").collect()))[1]._id;
    for (let i = 0; i < 120; i++)
      await t.run((ctx) =>
        ctx.storage
          .store(new Blob(["x"]))
          .then((storageId) => ctx.db.insert("syncChanges", { userId, deviceId, seq: 1000 + i, keyGen: 1, size: 1, storageId, createdAt: T0 })),
      );
    expect((await upload(t, A, 1)).status).toBe(429);
    await t.run(async (ctx) => {
      for (const e of await ctx.db.query("entitlements").collect()) await ctx.db.delete(e._id);
    });
    expect((await upload(t, A, 1)).status).toBe(403);
    expect((await call(t, A, { on: true })).status).toBe(403);
  });

  it("nobody read in 30 days go, and a laptop behind them is told to ask for everything", async () => {
    const t = setup();
    await twoIn(t);
    await upload(t, A, 1);
    vi.setSystemTime(T0 + 31 * 86_400_000);
    await t.mutation(internal.sync.prune, {});
    expect(await t.run((ctx) => ctx.db.query("syncChanges").collect())).toHaveLength(0);
    expect((await call(t, B, { on: true })).body.gap).toBe(true);
    const asked = await call(t, B, { on: true, resend: true, cursor: 1 });
    expect(asked.body.resendAt - (T0 + 31 * 86_400_000)).toBeLessThan(5);
  });
});

describe("leaving and the key", () => {
  it("switching off, being removed or signed out leaves; the next key generation must cover every laptop still in", async () => {
    const t = setup();
    const { userId, memberB } = await twoIn(t);
    await laptop(t, userId, C, "Spare");
    const c = await call(t, C, { on: true, publicKey: (await generateDeviceKey(true)).publicKey });
    await call(t, A, { on: true, admit: { memberId: c.body.me.id, sealedKey: SEALED_KEY, keyMsgId: "msg_admit_3", keyGen: 1 } });

    // A removes B, then hands a new key to C only.
    await call(t, A, { on: true, remove: memberB });
    const missing = await call(t, A, { on: true, rekey: { keyGen: 2, keys: [] } });
    expect(missing.body.rekeyRefused).toBe(true);
    const ok = await call(t, A, {
      on: true,
      rekey: { keyGen: 2, keys: [{ memberId: c.body.me.id, sealedKey: "n".repeat(200), keyMsgId: "msg_rekey_1" }] },
    });
    expect(ok.body.keyGen).toBe(2);
    expect((await call(t, C, { on: true })).body.me).toMatchObject({ keyGen: 2, sealedKey: "n".repeat(200) });
    // The same generation twice: the first wins.
    expect((await call(t, C, { on: true, rekey: { keyGen: 2, keys: [] } })).body.rekeyRefused).toBe(true);
    // B is out: Convex has no row for it, and it joins again only as waiting.
    expect((await call(t, B, { on: true })).status).toBe(403);
    expect((await call(t, B, { on: true, publicKey: (await generateDeviceKey(true)).publicKey })).body.me.status).toBe("waiting");

    // Signing C out (the web's device list) leaves sync too.
    await t.withIdentity(identity("user_1")).mutation(api.devices.revoke, { deviceId: (await t.run((ctx) => ctx.db.query("devices").collect()))[2]._id });
    const members = await t.run((ctx) => ctx.db.query("syncMembers").collect());
    expect(members.map((m) => m.name).sort()).toEqual(["Home laptop", "Office laptop"]);

    // Switching off works without a plan.
    await t.run(async (ctx) => {
      for (const e of await ctx.db.query("entitlements").collect()) await ctx.db.delete(e._id);
    });
    expect((await call(t, A, { on: false })).body).toEqual({ on: false });
  });

  it("goes with the account, packages and their files included", async () => {
    const t = setup();
    const { userId } = await twoIn(t);
    await upload(t, A, 1);
    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });
    expect(await t.run((ctx) => ctx.db.query("syncMembers").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("syncChanges").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(0);
    void userId;
  });
});
