import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { subscriptionForEvent, topupForEvent } from "./billing";
import { verifyStripeEvent } from "./lib/stripe";
import { DEVICE_TOKEN_PREFIX, pkceChallenge, randomToken, sha256Hex, signLease } from "./lib/tokens";

/**
 * Clerk's user events, at <CONVEX_SITE_URL>/clerk. Verified with Clerk's own
 * helper (Standard Webhooks signatures; clerk.com/docs/reference/backend/
 * verify-webhook, checked 12 Nov 2026). The signing secret lives only in the
 * Convex deployment's environment variables (guardrails §8).
 *
 * Every handler is idempotent: Clerk may send an event twice or out of order.
 */
const clerkWebhook = httpAction(async (ctx, request) => {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }

  let event;
  try {
    event = await verifyWebhook(request, { signingSecret });
  } catch {
    // No details: a forged request learns nothing.
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated":
      await ctx.runMutation(internal.users.upsertFromClerk, { clerkId: event.data.id });
      break;
    case "user.deleted":
      if (event.data.id) await ctx.runMutation(internal.users.deleteFromClerk, { clerkId: event.data.id });
      break;
  }
  return new Response(null, { status: 200 });
});

/**
 * Stripe's events, at <CONVEX_SITE_URL>/stripe: the only way a plan or paid
 * credits change (guardrails §3). The signing secret lives only in the Convex
 * deployment's environment. Anything but a 2xx makes Stripe retry (for up to
 * 3 days in live mode), so a failed read from Stripe is tried again later.
 */
const stripeWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Not configured", { status: 500 });
  }
  // The raw body: any change to it breaks the signature.
  const event = await verifyStripeEvent(await request.text(), request.headers.get("stripe-signature"), secret);
  if (!event) return new Response("Invalid signature", { status: 400 });

  const subscription = await subscriptionForEvent(event);
  const topup = subscription ? null : await topupForEvent(event);
  await ctx.runMutation(internal.billing.applyEvent, { eventId: event.id, type: event.type, subscription, topup });
  return new Response(null, { status: 200 });
});

// --- The desktop app (devices.ts) ---

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Sign-in step 3: one-time code + PKCE verifier → device token and its first lease. */
const desktopExchange = httpAction(async (ctx, request) => {
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  const verifier = typeof body?.verifier === "string" ? body.verifier : "";
  const appVersion = typeof body?.appVersion === "string" ? body.appVersion : "";
  // RFC 7636: a verifier is 43 to 128 unreserved characters.
  if (!code || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return json({ error: "FORBIDDEN" }, 400);

  const token = randomToken(DEVICE_TOKEN_PREFIX);
  const tokenHash = await sha256Hex(token);
  const result = await ctx.runMutation(internal.devices.redeemSignIn, {
    codeHash: await sha256Hex(code),
    challengeFromVerifier: await pkceChallenge(verifier),
    tokenHash,
    appVersion,
  });
  if ("error" in result) return json({ error: result.error }, result.error === "DEVICE_LIMIT" ? 409 : 400);
  const lease = await ctx.runMutation(internal.devices.leaseFor, { tokenHash, appVersion });
  return json({ token, deviceId: result.deviceId, lease: lease && (await signLease(lease)) });
});

/** A fresh signed lease for a signed-in device; 401 once the device is signed out. */
const desktopLease = httpAction(async (ctx, request) => {
  const token = request.headers.get("authorization")?.match(/^Bearer (t117d_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return json({ error: "UNAUTHENTICATED" }, 401);
  const body = await readJson(request);
  const appVersion = typeof body?.appVersion === "string" ? body.appVersion : "";
  const lease = await ctx.runMutation(internal.devices.leaseFor, { tokenHash: await sha256Hex(token), appVersion });
  if (!lease) return json({ error: "UNAUTHENTICATED" }, 401);
  return json({ lease: await signLease(lease) });
});

/**
 * Remote control for the laptop (remote.ts `laptopSync`, decisions §64): one
 * call every few seconds while it's on, with the device token. Sealed
 * messages only; this route never sees a readable command or result.
 */
const desktopRemote = httpAction(async (ctx, request) => {
  const token = request.headers.get("authorization")?.match(/^Bearer (t117d_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return json({ error: "UNAUTHENTICATED" }, 401);
  const device = await ctx.runQuery(internal.devices.deviceForToken, { tokenHash: await sha256Hex(token) });
  if (!device) return json({ error: "UNAUTHENTICATED" }, 401);
  const body = await readJson(request);
  if (!body) return json({ error: "FORBIDDEN" }, 400);
  try {
    const result = await ctx.runMutation(internal.remote.laptopSync, {
      deviceId: device,
      on: body.on === true,
      ...(typeof body.laptopKey === "string" ? { laptopKey: body.laptopKey } : {}),
      outgoing: Array.isArray(body.outgoing) ? (body.outgoing as never) : [],
      ack: Array.isArray(body.ack) ? (body.ack as never) : [],
      ...(body.startPairing === true ? { startPairing: true } : {}),
      ...(body.answerPairing && typeof body.answerPairing === "object" ? { answerPairing: body.answerPairing as never } : {}),
      ...(Array.isArray(body.revokeKeys) ? { revokeKeys: body.revokeKeys as never } : {}),
      ...(body.revokeAll === true ? { revokeAll: true } : {}),
    });
    if ("error" in result && result.error) return json({ error: result.error }, result.error === "UNAUTHENTICATED" ? 401 : 403);
    return json(result);
  } catch {
    // A malformed field (validators) or a refused message: no details.
    return json({ error: "FORBIDDEN" }, 400);
  }
});

const http = httpRouter();
http.route({ path: "/clerk", method: "POST", handler: clerkWebhook });
http.route({ path: "/stripe", method: "POST", handler: stripeWebhook });
http.route({ path: "/desktop/exchange", method: "POST", handler: desktopExchange });
http.route({ path: "/desktop/lease", method: "POST", handler: desktopLease });
http.route({ path: "/desktop/remote", method: "POST", handler: desktopRemote });

export default http;
