import { generateDeviceKey, open, randomId, seal, type SealHeader } from "@titan117/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { secondFactorAge } from "./lib/secondFactor";
import { sha256Hex } from "./lib/tokens";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const T0 = Date.UTC(2026, 10, 25, 12);
const TOKEN = "t117d_" + "a".repeat(43);
const OTHER_TOKEN = "t117d_" + "b".repeat(43);
/** Not a real Clerk token: with the two-factor check on, every action refuses it. */
const FAKE_SESSION = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEiLCJmdmEiOlswLDBdfQ.c2ln";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function user(t: T, clerkId = "user_1", plan: "starter" | null = "starter") {
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
        cancelAtPeriodEnd: false,
      },
      topup: null,
    });
  return userId;
}

async function laptop(t: T, userId: Id<"users">, token = TOKEN) {
  const tokenHash = await sha256Hex(token);
  return await t.run((ctx) => ctx.db.insert("devices", { userId, name: "Ada's laptop", tokenHash, createdAt: T0 }));
}

const sync = async (t: T, body: object, token = TOKEN) => {
  const res = await t.fetch("/desktop/remote", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/** Switched on and paired, the way the web page and the laptop do it (two-factor switched off for the test). */
async function pairedSetup(t: T) {
  vi.stubEnv("REMOTE_TWO_FACTOR", "off-until-clerk-pro");
  const userId = await user(t);
  const deviceId = await laptop(t, userId);
  const as = t.withIdentity(identity("user_1"));
  await as.action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION });

  const laptopKey = await generateDeviceKey(true);
  const first = await sync(t, { on: true, laptopKey: laptopKey.publicKey, startPairing: true });
  expect(first.status).toBe(200);
  const pairingId = first.body.openPairing.id as Id<"pairings">;

  const browserKey = await generateDeviceKey(false);
  const claimed = await as.action(api.remote.claimPairing, {
    pairingId,
    publicKey: browserKey.publicKey,
    name: "Chrome on Windows",
    kind: "browser",
    sessionToken: FAKE_SESSION,
  });
  expect(claimed.laptopKey).toBe(laptopKey.publicKey);
  const seen = await sync(t, { on: true });
  expect(seen.body.pairings).toEqual([{ id: pairingId, publicKey: browserKey.publicKey, name: "Chrome on Windows" }]);
  await sync(t, { on: true, answerPairing: { pairingId, accept: true } });
  return { userId, deviceId, as, laptopKey, browserKey, pairingId };
}

describe("second factor", () => {
  it("reads Clerk's fva claim", () => {
    expect(secondFactorAge({ fva: [3, 2] })).toBe(2);
    expect(secondFactorAge({ fva: [3, -1] })).toBeNull();
    expect(secondFactorAge({})).toBeNull();
  });

  it("refuses to switch remote control on without a fresh second factor", async () => {
    const t = setup();
    const userId = await user(t);
    const deviceId = await laptop(t, userId);
    await expect(
      t.withIdentity(identity("user_1")).action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION }),
    ).rejects.toThrow(/FORBIDDEN/);
    // Only the exact switch turns the check off.
    vi.stubEnv("REMOTE_TWO_FACTOR", "off");
    await expect(
      t.withIdentity(identity("user_1")).action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect((await t.run((ctx) => ctx.db.get(deviceId)))?.remoteEnabledAt).toBeUndefined();
  });

  it("refuses to pair without a fresh second factor", async () => {
    const t = setup();
    const { as } = await pairedSetup(t);
    vi.unstubAllEnvs();
    const next = await sync(t, { on: true, startPairing: true });
    const key = await generateDeviceKey(false);
    await expect(
      as.action(api.remote.claimPairing, {
        pairingId: next.body.openPairing.id,
        publicKey: key.publicKey,
        name: "x",
        kind: "browser",
        sessionToken: FAKE_SESSION,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("switching on and off", () => {
  it("stays off until both the laptop and Convex say on, and the laptop can switch it off alone", async () => {
    const t = setup();
    vi.stubEnv("REMOTE_TWO_FACTOR", "off-until-clerk-pro");
    const userId = await user(t);
    const deviceId = await laptop(t, userId);
    const key = await generateDeviceKey(true);

    expect((await sync(t, { on: true, laptopKey: key.publicKey })).body.enabled).toBe(false);
    await t.withIdentity(identity("user_1")).action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION });
    expect((await sync(t, { on: false })).body.enabled).toBe(false);
    // Switching off on the laptop cleared it in Convex too: it needs the second factor again.
    expect((await t.run((ctx) => ctx.db.get(deviceId)))?.remoteEnabledAt).toBeUndefined();
    await t.withIdentity(identity("user_1")).action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION });
    expect((await sync(t, { on: true, laptopKey: key.publicKey })).body.enabled).toBe(true);
  });

  it("needs a paid plan and a signed-in device", async () => {
    const t = setup();
    vi.stubEnv("REMOTE_TWO_FACTOR", "off-until-clerk-pro");
    const userId = await user(t, "user_1", null);
    const deviceId = await laptop(t, userId);
    await expect(
      t.withIdentity(identity("user_1")).action(api.remote.enable, { deviceId, sessionToken: FAKE_SESSION }),
    ).rejects.toThrow(/PAYMENT_REQUIRED/);
    expect((await sync(t, { on: true })).status).toBe(403);
    expect((await sync(t, { on: true }, OTHER_TOKEN)).status).toBe(401);
    expect((await sync(t, { on: true }, "nope")).status).toBe(401);
  });
});

describe("pairing", () => {
  it("is confirmed on the laptop, and a refused key is removed", async () => {
    const t = setup();
    const { as, laptopKey, browserKey } = await pairedSetup(t);
    expect(await as.query(api.remote.pairedDevices, {})).toEqual([
      expect.objectContaining({ publicKey: browserKey.publicKey, name: "Chrome on Windows" }),
    ]);

    const next = await sync(t, { on: true, laptopKey: laptopKey.publicKey, startPairing: true });
    const other = await generateDeviceKey(false);
    await as.action(api.remote.claimPairing, {
      pairingId: next.body.openPairing.id,
      publicKey: other.publicKey,
      name: "Unknown",
      kind: "browser",
      sessionToken: FAKE_SESSION,
    });
    await sync(t, { on: true, answerPairing: { pairingId: next.body.openPairing.id, accept: false } });
    expect((await as.query(api.remote.pairedDevices, {})).map((d) => d.publicKey)).toEqual([browserKey.publicKey]);
  });

  it("can't be claimed twice, after five minutes, or by another account", async () => {
    const t = setup();
    const { as, pairingId } = await pairedSetup(t);
    const key = await generateDeviceKey(false);
    const args = { pairingId, publicKey: key.publicKey, name: "x", kind: "browser" as const, sessionToken: FAKE_SESSION };
    await expect(as.action(api.remote.claimPairing, args)).rejects.toThrow(/NOT_FOUND/);

    const fresh = (await sync(t, { on: true, startPairing: true })).body.openPairing.id;
    await user(t, "user_2");
    await expect(
      t.withIdentity(identity("user_2")).action(api.remote.claimPairing, { ...args, pairingId: fresh }),
    ).rejects.toThrow(/NOT_FOUND/);
    vi.setSystemTime(T0 + 6 * 60 * 1000);
    await expect(as.action(api.remote.claimPairing, { ...args, pairingId: fresh })).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("messages", () => {
  it("carries a sealed command to the laptop and a sealed event back, and Convex holds nothing readable", async () => {
    const t = setup();
    const { as, laptopKey, browserKey, userId } = await pairedSetup(t);
    const SECRET_WORDS = "Send the Q4 invoices to Ioana";

    const cmdHeader: SealHeader = { v: 1, from: browserKey.publicKey, to: laptopKey.publicKey, kind: "command", id: randomId() };
    const sealed = await seal(
      cmdHeader,
      { v: 1, id: randomId(), sentAt: T0, expiresAt: T0 + 60_000, command: { type: "task.start", text: SECRET_WORDS } },
      browserKey.privateKey,
    );
    await as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: cmdHeader.id, sealed });

    const got = await sync(t, { on: true });
    expect(got.body.inbox).toHaveLength(1);
    const m = got.body.inbox[0];
    const opened = await open({ v: 1, from: m.from, to: laptopKey.publicKey, kind: m.kind, id: m.msgId }, m.sealed, laptopKey.privateKey);
    expect((opened as { command: { text: string } }).command.text).toBe(SECRET_WORDS);

    const evHeader: SealHeader = { v: 1, from: laptopKey.publicKey, to: browserKey.publicKey, kind: "event", id: randomId() };
    const evSealed = await seal(evHeader, { v: 1, id: randomId(), sentAt: T0, event: { type: "alert", text: SECRET_WORDS } }, laptopKey.privateKey);
    await sync(t, { on: true, ack: [m.id], outgoing: [{ to: browserKey.publicKey, kind: "event", msgId: evHeader.id, sealed: evSealed }] });
    const inbox = await as.query(api.remote.inbox, { key: browserKey.publicKey });
    expect(inbox.messages).toHaveLength(1);

    // The ciphertext-only check (guardrails §9, §12): no table holds the words.
    const dump = await t.run(async (ctx) => {
      const tables = ["remoteMessages", "deviceKeys", "pairings", "devices", "users"] as const;
      const rows = await Promise.all(tables.map((name) => ctx.db.query(name).collect()));
      return JSON.stringify(rows);
    });
    // Words of five letters or more: a shorter one turns up in random base64 by chance.
    for (const word of ["invoices", "Ioana", "task.start", "alert"]) expect(dump).not.toContain(word);
    // A read message keeps no content.
    const read = await t.run((ctx) => ctx.db.get(m.id as Id<"remoteMessages">));
    expect(read?.sealed).toBe("");
    void userId;
  });

  it("refuses senders and recipients that aren't this account's paired keys", async () => {
    const t = setup();
    const { as, laptopKey, browserKey } = await pairedSetup(t);
    const stranger = await generateDeviceKey(false);
    const sealed = "A".repeat(1500);
    // An unpaired key can't send.
    await expect(
      as.mutation(api.remote.send, { from: stranger.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed }),
    ).rejects.toThrow(/FORBIDDEN/);
    // A browser can't send to another browser.
    await expect(
      as.mutation(api.remote.send, { from: browserKey.publicKey, to: browserKey.publicKey, msgId: randomId(), sealed }),
    ).rejects.toThrow(/NOT_FOUND/);
    // Another account can't use these keys.
    await user(t, "user_2");
    const other = t.withIdentity(identity("user_2"));
    await expect(
      other.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect((await other.query(api.remote.inbox, { key: browserKey.publicKey })).paired).toBe(false);
    await expect(other.mutation(api.remote.ack, { key: browserKey.publicKey, ids: [] })).rejects.toThrow(/FORBIDDEN/);
    expect(await other.query(api.remote.laptops, {})).toEqual([]);
    expect(await other.query(api.remote.pairedDevices, {})).toEqual([]);
    // A message id once.
    const id = randomId();
    await as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: id, sealed });
    await expect(
      as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: id, sealed }),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("refuses without a plan or when the laptop switched off, and limits the rate", async () => {
    const t = setup();
    const { as, laptopKey, browserKey, pairingId } = await pairedSetup(t);
    const sealed = "A".repeat(1500);
    for (let i = 0; i < 60; i++)
      await as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed });
    await expect(
      as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed }),
    ).rejects.toThrow(/RATE_LIMITED/);
    vi.setSystemTime(T0 + 61_000);
    await sync(t, { on: false });
    await expect(
      as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed }),
    ).rejects.toThrow(/FORBIDDEN/);

    await user(t, "user_3", null);
    const unpaid = t.withIdentity(identity("user_3"));
    await expect(unpaid.query(api.remote.laptops, {})).rejects.toThrow(/PAYMENT_REQUIRED/);
    await expect(unpaid.query(api.remote.pairingStatus, { pairingId })).rejects.toThrow(/PAYMENT_REQUIRED/);
    await expect(unpaid.query(api.remote.inbox, { key: browserKey.publicKey })).rejects.toThrow(/PAYMENT_REQUIRED/);
    await expect(t.query(api.remote.laptops, {})).rejects.toThrow(/UNAUTHENTICATED/);
  });
});

describe("revoking", () => {
  it("Revoke all removes every browser key, message and pairing and tells the laptop", async () => {
    const t = setup();
    const { as, laptopKey, browserKey } = await pairedSetup(t);
    await as.mutation(api.remote.send, { from: browserKey.publicKey, to: laptopKey.publicKey, msgId: randomId(), sealed: "A".repeat(1500) });
    await as.mutation(api.remote.revokeAll, {});
    const after = await sync(t, { on: true });
    expect(after.body.revokedAllAt).toBeGreaterThanOrEqual(T0);
    expect(after.body.inbox).toEqual([]);
    expect(after.body.keys).toEqual([]);
    expect((await as.query(api.remote.inbox, { key: browserKey.publicKey })).paired).toBe(false);
  });

  it("one device can be removed, and the laptop then sends it nothing", async () => {
    const t = setup();
    const { as, browserKey } = await pairedSetup(t);
    await as.mutation(api.remote.revokeKey, { publicKey: browserKey.publicKey });
    await sync(t, { on: true, outgoing: [{ to: browserKey.publicKey, kind: "event", msgId: randomId(), sealed: "A".repeat(1500) }] });
    const rows = await t.run((ctx) => ctx.db.query("remoteMessages").collect());
    expect(rows).toEqual([]);
  });

  it("the laptop can remove a device or revoke all, but never another account's keys", async () => {
    const t = setup();
    const { as, browserKey } = await pairedSetup(t);
    await user(t, "user_2");
    const otherKey = await generateDeviceKey(false);
    const otherId = await t.run(async (ctx) => {
      const u = (await ctx.db.query("users").collect()).find((x) => x.clerkId === "user_2")!;
      return ctx.db.insert("deviceKeys", { userId: u._id, kind: "browser", name: "theirs", publicKey: otherKey.publicKey, createdAt: T0 });
    });
    await sync(t, { on: true, revokeKeys: [browserKey.publicKey, otherKey.publicKey] });
    expect(await as.query(api.remote.pairedDevices, {})).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(otherId)))?.revokedAt).toBeUndefined();
    await sync(t, { on: false, revokeAll: true });
    expect((await t.run((ctx) => ctx.db.query("users").collect())).find((u) => u.clerkId === "user_1")?.remoteRevokedAllAt).toBeGreaterThanOrEqual(T0);
  });

  it("goes with the account", async () => {
    const t = setup();
    await pairedSetup(t);
    await t.mutation(internal.users.deleteFromClerk, { clerkId: "user_1" });
    const left = await t.run(async (ctx) => [
      ...(await ctx.db.query("deviceKeys").collect()),
      ...(await ctx.db.query("pairings").collect()),
      ...(await ctx.db.query("remoteMessages").collect()),
    ]);
    expect(left).toEqual([]);
  });
});

describe("Web Push", () => {
  async function vapid() {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    vi.stubEnv("VAPID_PRIVATE_KEY", b64(await crypto.subtle.exportKey("pkcs8", pair.privateKey)));
    vi.stubEnv("VAPID_PUBLIC_KEY", b64(await crypto.subtle.exportKey("raw", pair.publicKey)));
    return pair.publicKey;
  }

  it("keeps only a known push service's address, for this account's own paired device", async () => {
    const t = setup();
    const { as, browserKey, laptopKey } = await pairedSetup(t);
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    await expect(as.mutation(api.remote.subscribePush, { key: browserKey.publicKey, endpoint: "https://evil.example/x" })).rejects.toThrow(/FORBIDDEN/);
    await expect(as.mutation(api.remote.subscribePush, { key: laptopKey.publicKey, endpoint })).rejects.toThrow(/FORBIDDEN/);
    await user(t, "user_2");
    await expect(
      t.withIdentity(identity("user_2")).mutation(api.remote.subscribePush, { key: browserKey.publicKey, endpoint }),
    ).rejects.toThrow(/FORBIDDEN/);
    await user(t, "user_3", null);
    await expect(
      t.withIdentity(identity("user_3")).mutation(api.remote.subscribePush, { key: browserKey.publicKey, endpoint }),
    ).rejects.toThrow(/PAYMENT_REQUIRED/);
    await as.mutation(api.remote.subscribePush, { key: browserKey.publicKey, endpoint });
    expect(await t.query(internal.remote.hasPush, { deviceKey: browserKey.publicKey })).toBe(true);
    await as.mutation(api.remote.unsubscribePush, { key: browserKey.publicKey });
    expect(await t.query(internal.remote.hasPush, { deviceKey: browserKey.publicKey })).toBe(false);
  });

  it("a notifying event schedules one empty push signed with VAPID; a gone subscription is dropped", async () => {
    const t = setup();
    const publicKey = await vapid();
    const { as, browserKey } = await pairedSetup(t);
    expect(await as.query(api.remote.pushKey, {})).toMatch(/^[A-Za-z0-9_-]{87}$/);
    await as.mutation(api.remote.subscribePush, { key: browserKey.publicKey, endpoint: "https://fcm.googleapis.com/fcm/send/abc" });
    await sync(t, { on: true, outgoing: [{ to: browserKey.publicKey, kind: "event", msgId: randomId(), sealed: "A".repeat(1500), notify: true }] });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.filter((s) => s.name.includes("push"))).toHaveLength(1);

    const calls: { url: string; headers: Headers; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers), body: String(init.body ?? "") });
      return new Response(null, { status: calls.length === 1 ? 201 : 410 });
    });
    await t.action(internal.remote.push, { deviceKey: browserKey.publicKey });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toBe("");
    expect(calls[0]!.headers.get("TTL")).toBe("86400");
    const auth = calls[0]!.headers.get("Authorization")!;
    const [, jwt] = auth.match(/^vapid t=([^,]+), k=[A-Za-z0-9_-]{87}$/)!;
    const [h, c, sig] = jwt!.split(".");
    const dec = (x: string) => Uint8Array.from(atob(x.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
    expect(JSON.parse(new TextDecoder().decode(dec(c!)))).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:security@titan117.com" });
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, dec(sig!), new TextEncoder().encode(`${h}.${c}`))).toBe(true);

    // At most one a minute per device.
    await t.action(internal.remote.push, { deviceKey: browserKey.publicKey });
    expect(calls).toHaveLength(1);
    vi.setSystemTime(T0 + 61_000);
    await t.action(internal.remote.push, { deviceKey: browserKey.publicKey });
    expect(calls).toHaveLength(2);
    expect(await t.query(internal.remote.hasPush, { deviceKey: browserKey.publicKey })).toBe(false);
    vi.unstubAllGlobals();
  });
});
