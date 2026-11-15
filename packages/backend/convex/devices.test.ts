import type { LeasePayload } from "@titan117/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { addMonths } from "./lib/credits";
import { base64url, fromBase64, pkceChallenge, sha256Hex } from "./lib/tokens";
import { identity, setup } from "./test.setup";

type T = ReturnType<typeof setup>;
const T0 = Date.UTC(2026, 10, 15, 12);
const DAY = 86_400_000;
const PROXY_SECRET = "p".repeat(48);
const VERIFIER = "v".repeat(20) + "-verifier-" + "x".repeat(23); // 53 unreserved characters

let publicKey: CryptoKey;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  publicKey = pair.publicKey;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  vi.stubEnv("LEASE_PRIVATE_KEY", btoa(String.fromCharCode(...pkcs8)));
  vi.stubEnv("PROXY_SECRET", PROXY_SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** What the desktop app does: check the signature with the public key, then read the payload. */
async function readLease(lease: string): Promise<LeasePayload | null> {
  const [body, sig] = lease.split(".");
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromBase64(sig!),
    new TextEncoder().encode(body),
  );
  return ok ? (JSON.parse(new TextDecoder().decode(fromBase64(body!))) as LeasePayload) : null;
}

async function user(t: T, clerkId = "user_1", plan: "starter" | "pro" | null = "starter", cancel = false) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId }));
  if (plan) {
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
        cancelAtPeriodEnd: cancel,
      },
      topup: null,
    });
  }
  return userId;
}

async function code(t: T, clerkId = "user_1", verifier = VERIFIER) {
  return (
    await t
      .withIdentity(identity(clerkId))
      .action(api.devices.startSignIn, { challenge: await pkceChallenge(verifier), name: "Ada's laptop" })
  ).code;
}

const exchange = (t: T, body: object) =>
  t.fetch("/desktop/exchange", { method: "POST", body: JSON.stringify({ appVersion: "0.1.0", ...body }) });
const leaseCall = (t: T, token?: string) =>
  t.fetch("/desktop/lease", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ appVersion: "0.1.0" }),
  });

describe("desktop sign-in", () => {
  it("a code and the right verifier give a device token and a signed lease", async () => {
    const t = setup();
    const userId = await user(t);
    const res = await exchange(t, { code: await code(t), verifier: VERIFIER });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; deviceId: string; lease: string };
    expect(body.token).toMatch(/^t117d_[A-Za-z0-9_-]{43}$/);

    const lease = await readLease(body.lease);
    expect(lease).toMatchObject({ v: 1, sub: userId, dev: body.deviceId, plan: "starter", devices: 2 });
    // Signed now (the test clock moves a millisecond per call), valid 14 days.
    expect(lease!.iat - T0).toBeLessThan(1000);
    expect(lease!.exp - lease!.iat).toBe(14 * DAY);
    // Only the token's hash is stored.
    const device = await t.run((ctx) => ctx.db.get(body.deviceId as Id<"devices">));
    expect(device?.tokenHash).toBe(await sha256Hex(body.token));
    expect(JSON.stringify(device)).not.toContain(body.token);
  });

  it("a code works once, and a wrong verifier burns it", async () => {
    const t = setup();
    await user(t);
    const c = await code(t);
    expect((await exchange(t, { code: c, verifier: "w".repeat(43) })).status).toBe(400);
    expect((await exchange(t, { code: c, verifier: VERIFIER })).status).toBe(400);

    const c2 = await code(t);
    expect((await exchange(t, { code: c2, verifier: VERIFIER })).status).toBe(200);
    expect((await exchange(t, { code: c2, verifier: VERIFIER })).status).toBe(400);
  });

  it("a code expires after five minutes", async () => {
    const t = setup();
    await user(t);
    const c = await code(t);
    vi.setSystemTime(T0 + 5 * 60 * 1000 + 1);
    expect((await exchange(t, { code: c, verifier: VERIFIER })).status).toBe(400);
  });

  it("refuses a malformed verifier and an unknown code", async () => {
    const t = setup();
    await user(t);
    expect((await exchange(t, { code: await code(t), verifier: "short" })).status).toBe(400);
    expect((await exchange(t, { code: "made-up", verifier: VERIFIER })).status).toBe(400);
  });

  it("startSignIn refuses a signed-out caller and a malformed challenge", async () => {
    const t = setup();
    await user(t);
    await expect(t.action(api.devices.startSignIn, { challenge: "a".repeat(43), name: "x" })).rejects.toThrowError(
      "UNAUTHENTICATED",
    );
    await expect(
      t.withIdentity(identity("user_1")).action(api.devices.startSignIn, { challenge: "short", name: "x" }),
    ).rejects.toThrowError("FORBIDDEN");
  });

  it("stops at the plan's device limit", async () => {
    const t = setup();
    await user(t); // Starter: 2 devices
    for (let i = 0; i < 2; i++) expect((await exchange(t, { code: await code(t), verifier: VERIFIER })).status).toBe(200);
    const third = await exchange(t, { code: await code(t), verifier: VERIFIER });
    expect(third.status).toBe(409);
    expect(await third.json()).toEqual({ error: "DEVICE_LIMIT" });
  });
});

describe("the lease", () => {
  async function signedIn(t: T) {
    const res = await exchange(t, { code: await code(t), verifier: VERIFIER });
    return (await res.json()) as { token: string; deviceId: Id<"devices"> };
  }

  it("renews with a valid token and records when the device was seen", async () => {
    const t = setup();
    await user(t);
    const { token, deviceId } = await signedIn(t);
    vi.setSystemTime(T0 + DAY);
    const res = await leaseCall(t, token);
    expect(res.status).toBe(200);
    const lease = await readLease(((await res.json()) as { lease: string }).lease);
    expect(lease).toMatchObject({ plan: "starter" });
    expect(lease!.iat - (T0 + DAY)).toBeLessThan(1000);
    expect(lease!.exp - lease!.iat).toBe(14 * DAY);
    expect((await t.run((ctx) => ctx.db.get(deviceId)))?.lastSeenAt).toBe(T0 + DAY);
  });

  it("a cancelled plan's lease never outlives the plan", async () => {
    const t = setup();
    await user(t, "user_1", "starter", true);
    const { token } = await signedIn(t);
    const res = await leaseCall(t, token);
    const fresh = await readLease(((await res.json()) as { lease: string }).lease);
    // 14 days would be within the paid month, so the cap only shows on a later check.
    expect(fresh!.exp - fresh!.iat).toBe(14 * DAY);
    vi.setSystemTime(addMonths(T0, 1) - 3 * DAY);
    const late = await readLease(((await (await leaseCall(t, token)).json()) as { lease: string }).lease);
    expect(late!.exp).toBe(addMonths(T0, 1) + 2 * DAY);
  });

  it("without a plan the lease says locked at once", async () => {
    const t = setup();
    await user(t, "user_1", null);
    const { token } = await signedIn(t);
    const lease = await readLease(((await (await leaseCall(t, token)).json()) as { lease: string }).lease);
    expect(lease).toMatchObject({ plan: null, devices: 0 });
    expect(lease!.exp).toBe(lease!.iat);
  });

  it("refuses no token, a made-up token and a signed-out device", async () => {
    const t = setup();
    await user(t);
    const { token, deviceId } = await signedIn(t);
    expect((await leaseCall(t)).status).toBe(401);
    expect((await leaseCall(t, "t117d_" + base64url(new Uint8Array(32)))).status).toBe(401);
    await t.withIdentity(identity("user_1")).mutation(api.devices.revoke, { deviceId });
    expect((await leaseCall(t, token)).status).toBe(401);
  });

  it("a forged lease fails the signature check", async () => {
    const t = setup();
    await user(t);
    const body = (await (await exchange(t, { code: await code(t), verifier: VERIFIER })).json()) as { lease: string };
    const [payload, sig] = body.lease.split(".");
    const edited = base64url(
      new TextEncoder().encode(
        JSON.stringify({ ...JSON.parse(new TextDecoder().decode(fromBase64(payload!))), exp: T0 + 999 * DAY }),
      ),
    );
    expect(await readLease(`${edited}.${sig}`)).toBeNull();
  });
});

describe("devices on the account page (guardrails §2)", () => {
  it("lists only the caller's devices and signs out only their own", async () => {
    const t = setup();
    await user(t, "user_1");
    await user(t, "user_2");
    const ada = (await (await exchange(t, { code: await code(t, "user_1"), verifier: VERIFIER })).json()) as {
      deviceId: Id<"devices">;
    };
    await exchange(t, { code: await code(t, "user_2"), verifier: VERIFIER });

    await expect(t.query(api.devices.list)).rejects.toThrowError("UNAUTHENTICATED");
    expect(await t.withIdentity(identity("user_1")).query(api.devices.list)).toHaveLength(1);
    await expect(
      t.withIdentity(identity("user_2")).mutation(api.devices.revoke, { deviceId: ada.deviceId }),
    ).rejects.toThrowError("NOT_FOUND");
    await expect(t.mutation(api.devices.revoke, { deviceId: ada.deviceId })).rejects.toThrowError("UNAUTHENTICATED");
    expect(await t.withIdentity(identity("user_1")).query(api.devices.list)).toHaveLength(1);
  });
});

describe("the credits proxy with a device token", () => {
  it("opens a call for the device's user; refuses unknown and signed-out devices", async () => {
    const t = setup();
    await user(t);
    const { token, deviceId } = (await (await exchange(t, { code: await code(t), verifier: VERIFIER })).json()) as {
      token: string;
      deviceId: Id<"devices">;
    };
    const tokenHash = await sha256Hex(token);
    await expect(
      t.mutation(api.proxy.beginForDevice, { proxySecret: PROXY_SECRET, tokenHash, model: "m" }),
    ).resolves.toMatchObject({ credits: 700 });
    await expect(
      t.mutation(api.proxy.beginForDevice, { proxySecret: "wrong".padEnd(48, "x"), tokenHash, model: "m" }),
    ).rejects.toThrowError("FORBIDDEN");
    await expect(
      t.mutation(api.proxy.beginForDevice, { proxySecret: PROXY_SECRET, tokenHash: "0".repeat(64), model: "m" }),
    ).rejects.toThrowError("UNAUTHENTICATED");
    await t.withIdentity(identity("user_1")).mutation(api.devices.revoke, { deviceId });
    await expect(
      t.mutation(api.proxy.beginForDevice, { proxySecret: PROXY_SECRET, tokenHash, model: "m" }),
    ).rejects.toThrowError("UNAUTHENTICATED");
  });
});
