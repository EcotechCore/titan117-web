import { verifyWebhook } from "@clerk/backend/webhooks";
import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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

const http = httpRouter();
http.route({ path: "/clerk", method: "POST", handler: clerkWebhook });

export default http;
