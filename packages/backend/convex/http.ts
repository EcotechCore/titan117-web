import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { subscriptionForEvent, topupForEvent } from "./billing";
import { verifyStripeEvent } from "./lib/stripe";

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

const http = httpRouter();
http.route({ path: "/clerk", method: "POST", handler: clerkWebhook });
http.route({ path: "/stripe", method: "POST", handler: stripeWebhook });

export default http;
