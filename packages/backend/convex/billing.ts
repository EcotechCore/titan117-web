/**
 * Plans and credits through Stripe (decisions §12, pricing.md): Checkout for
 * a plan or a top-up, the billing portal, the account summary, and the
 * webhook's mutation, the only writer of entitlements and paid credits
 * (through lib/billing.ts and lib/credits.ts).
 *
 * Stripe facts used here were checked on 15 Nov 2026 (external-services.md).
 */
import {
  BILLING_INTERVALS,
  PLAN_IDS,
  planLookupKey,
  TOPUPS,
  topupLookupKey,
  type BillingInterval,
  type PlanId,
  type TopupId,
} from "@titan117/shared";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type ActionCtx, type QueryCtx } from "./_generated/server";
import { applySubscription } from "./lib/billing";
import { addTopup, balance, entitlementOf, isUsable } from "./lib/credits";
import { fail, userAction, userQuery } from "./lib/functions";
import { stripe, StripeError, subscriptionState, type StripeEvent } from "./lib/stripe";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
const CHECKOUT_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/**
 * Shown next to the required checkbox at Checkout once STRIPE_REQUIRE_TERMS is
 * on (it needs the terms page online and its address in Stripe's public
 * details). Private buyers waive the 14-day withdrawal right expressly, as EU
 * law requires (decisions §33.8). Wording to be reviewed by our lawyer.
 */
export const TERMS_TEXT =
  "I agree to the [Terms of Service](https://titan117.com/legal/terms) and ask for the service to start now. " +
  "I understand that I lose my 14-day right of withdrawal once it has started.";

function siteUrl() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * The confirmation of that waiver, which EU law requires on a durable medium:
 * printed on every invoice, which Stripe attaches as a PDF to the receipt email
 * ("Successful payments" emails on in Stripe's settings). Customer default
 * footer for plan invoices; the invoice's own footer for top-ups.
 */
export const WAIVER_FOOTER =
  "At checkout you asked for the Titan117 service to start at once and confirmed that you lose your 14-day right " +
  "of withdrawal once it has started. Plans and credits are not refunded (Terms of Service, section 6: " +
  "https://titan117.com/legal/terms#payments). Ecotechcore, titan117.com.";

function flag(name: string) {
  return process.env[name] === "on";
}

/** Tax, business tax ids and the terms checkbox, shared by both kinds of Checkout. */
function checkoutExtras() {
  return {
    // Stripe Tax needs the origin address and registrations set in the dashboard first.
    ...(flag("STRIPE_AUTOMATIC_TAX") ? { automatic_tax: { enabled: true } } : {}),
    // A business's EU VAT number makes the sale a reverse charge. Stripe saves
    // the business name and address it collects on our existing customer.
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    ...(flag("STRIPE_REQUIRE_TERMS")
      ? {
          consent_collection: { terms_of_service: "required" },
          custom_text: { terms_of_service_acceptance: { message: TERMS_TEXT } },
        }
      : {}),
  };
}

async function customerOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("stripeCustomers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// --- For the web app ---

/** The caller's plan, credits and recent credit history, for the account pages. */
export const summary = userQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const entitlement = await entitlementOf(ctx, ctx.user._id);
    const history = await ctx.db
      .query("creditLedger")
      .withIndex("by_user_at", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .take(20);
    return {
      plan: entitlement && isUsable(entitlement, now) ? entitlement.plan : null,
      status: entitlement?.status ?? null,
      interval: entitlement?.interval ?? null,
      paidUntil: entitlement?.paidUntil ?? null,
      activeUntil: entitlement?.activeUntil ?? null,
      cancelAtPeriodEnd: entitlement?.cancelAtPeriodEnd ?? false,
      credits: await balance(ctx, ctx.user._id, now),
      history: history.map(({ amount, reason, at, shortfall }) => ({ amount, reason, at, shortfall: shortfall ?? 0 })),
      hasBilling: (await customerOf(ctx, ctx.user._id)) !== null,
    };
  },
});

export const billingState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entitlement = await entitlementOf(ctx, userId);
    const customer = await customerOf(ctx, userId);
    return { active: isUsable(entitlement, Date.now()), customerId: customer?.customerId ?? null };
  },
});

export const linkCustomer = internalMutation({
  args: { userId: v.id("users"), customerId: v.string() },
  handler: async (ctx, { userId, customerId }) => {
    const existing = await customerOf(ctx, userId);
    if (existing) return existing.customerId;
    await ctx.db.insert("stripeCustomers", { userId, customerId });
    return customerId;
  },
});

/** The Stripe customer for a user, created on first use. It holds only our user id; Checkout asks for the email. */
async function ensureCustomer(
  ctx: Pick<ActionCtx, "runMutation">,
  userId: Id<"users">,
  existing: string | null,
): Promise<string> {
  // With the waiver on, every invoice of this customer carries its confirmation.
  const invoiceSettings = flag("STRIPE_REQUIRE_TERMS") ? { invoice_settings: { footer: WAIVER_FOOTER } } : {};
  if (existing) {
    if (flag("STRIPE_REQUIRE_TERMS")) await stripe("POST", `/customers/${existing}`, invoiceSettings);
    return existing;
  }
  const customer = await stripe<{ id: string }>("POST", "/customers", { metadata: { userId }, ...invoiceSettings });
  return await ctx.runMutation(internal.billing.linkCustomer, { userId, customerId: customer.id });
}

/** The active price with this lookup key. */
async function priceFor(lookupKey: string) {
  const { data } = await stripe<{ data: { id: string }[] }>("GET", "/prices", {
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (!data[0]) throw new Error(`No active Stripe price with lookup key ${lookupKey}`);
  return data[0].id;
}

const planArg = v.union(...PLAN_IDS.map((p) => v.literal(p)));
const intervalArg = v.union(...BILLING_INTERVALS.map((i) => v.literal(i)));
const topupArg = v.union(...TOPUPS.map((t) => v.literal(t.id)));

/** Starts a Stripe Checkout for a plan and returns the page to send the user to. */
export const checkout = userAction({
  args: { plan: planArg, interval: intervalArg },
  handler: async (ctx, { plan, interval }): Promise<{ url: string }> => {
    const state = await ctx.runQuery(internal.billing.billingState, { userId: ctx.userId });
    // Already subscribed: changes go through the billing portal, so nobody pays twice.
    if (state.active) fail("ALREADY_SUBSCRIBED");
    const customer = await ensureCustomer(ctx, ctx.userId, state.customerId);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: ctx.userId,
      line_items: [{ price: await priceFor(planLookupKey(plan as PlanId, interval as BillingInterval)), quantity: 1 }],
      subscription_data: { metadata: { userId: ctx.userId } },
      success_url: `${siteUrl()}/account?checkout=success`,
      cancel_url: `${siteUrl()}/account?checkout=cancelled`,
      ...checkoutExtras(),
    });
    return { url: session.url };
  },
});

/** Starts a Stripe Checkout for a credit pack. Only with an active plan (pricing.md). */
export const topUp = userAction({
  args: { pack: topupArg },
  handler: async (ctx, { pack }): Promise<{ url: string }> => {
    const state = await ctx.runQuery(internal.billing.billingState, { userId: ctx.userId });
    if (!state.active) fail("PAYMENT_REQUIRED");
    const customer = await ensureCustomer(ctx, ctx.userId, state.customerId);
    const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
      mode: "payment",
      customer,
      client_reference_id: ctx.userId,
      line_items: [{ price: await priceFor(topupLookupKey(pack as TopupId)), quantity: 1 }],
      metadata: { userId: ctx.userId, topup: pack },
      invoice_creation: {
        enabled: true,
        ...(flag("STRIPE_REQUIRE_TERMS") ? { invoice_data: { footer: WAIVER_FOOTER } } : {}),
      },
      success_url: `${siteUrl()}/account?topup=success`,
      cancel_url: `${siteUrl()}/account?topup=cancelled`,
      ...checkoutExtras(),
    });
    return { url: session.url };
  },
});

/** Stripe's billing portal: cards, invoices, plan changes and cancelling. */
export const portal = userAction({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const state = await ctx.runQuery(internal.billing.billingState, { userId: ctx.userId });
    if (!state.customerId) fail("NOT_FOUND");
    const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
      customer: state.customerId,
      return_url: `${siteUrl()}/account`,
    });
    return { url: session.url };
  },
});

// --- The webhook (http.ts) ---

/** The subscription an event is about, read back from Stripe so an out-of-order event can't undo a newer state. */
export async function subscriptionForEvent(event: StripeEvent) {
  const object = event.data.object;
  let id: string | null = null;
  if (CHECKOUT_EVENTS.has(event.type)) {
    if (object.mode !== "subscription" || typeof object.subscription !== "string") return null;
    id = object.subscription;
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    id = object.id as string;
  } else {
    return null;
  }
  try {
    return subscriptionState(await stripe("GET", `/subscriptions/${id}`, { expand: ["items.data.price"] }));
  } catch (error) {
    // A deleted customer's subscription can't be read any more; the event's copy is the last word.
    if (error instanceof StripeError && error.status === 404 && SUBSCRIPTION_EVENTS.has(event.type)) {
      return subscriptionState(object);
    }
    throw error;
  }
}

type CheckoutSession = {
  id: string;
  mode: string;
  payment_status: string;
  customer: string | null;
  metadata?: Record<string, string> | null;
  line_items?: { data: { price?: { lookup_key?: string | null } | null; quantity?: number | null }[] };
};

/** A paid top-up's credits, from the price Stripe actually charged, never from the request. */
export async function topupForEvent(event: StripeEvent) {
  if (!CHECKOUT_EVENTS.has(event.type) || event.data.object.mode !== "payment") return null;
  const session = await stripe<CheckoutSession>("GET", `/checkout/sessions/${event.data.object.id as string}`, {
    expand: ["line_items.data.price"],
  });
  if (session.payment_status !== "paid") return null;
  let credits = 0;
  for (const item of session.line_items?.data ?? []) {
    const pack = TOPUPS.find((t) => topupLookupKey(t.id) === item.price?.lookup_key);
    if (pack) credits += pack.credits * (item.quantity ?? 1);
  }
  if (credits === 0) return null;
  return {
    sessionId: session.id,
    userId: session.metadata?.userId ?? null,
    customerId: session.customer,
    credits,
  };
}

const subscriptionFields = v.object({
  subscriptionId: v.string(),
  customerId: v.string(),
  userId: v.union(v.string(), v.null()),
  status: v.string(),
  plan: v.union(planArg, v.null()),
  interval: v.union(intervalArg, v.null()),
  periodStart: v.number(),
  periodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
});

const topupFields = v.object({
  sessionId: v.string(),
  userId: v.union(v.string(), v.null()),
  customerId: v.union(v.string(), v.null()),
  credits: v.number(),
});

/** Records the event once, then writes what it changes. */
export const applyEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    subscription: v.union(subscriptionFields, v.null()),
    topup: v.union(topupFields, v.null()),
  },
  handler: async (ctx, { eventId, type, subscription, topup }) => {
    const seen = await ctx.db
      .query("stripeEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique();
    if (seen) return "duplicate";
    const now = Date.now();
    await ctx.db.insert("stripeEvents", { eventId, type, receivedAt: now });
    const target = subscription ?? topup;
    if (!target) return "ignored";

    // The user from our own metadata, else from the customer link.
    let userId = target.userId ? ctx.db.normalizeId("users", target.userId) : null;
    if (userId && !(await ctx.db.get(userId))) userId = null;
    if (!userId && target.customerId) {
      const link = await ctx.db
        .query("stripeCustomers")
        .withIndex("by_customer", (q) => q.eq("customerId", target.customerId!))
        .unique();
      userId = link?.userId ?? null;
    }
    // A deleted account, or a customer made outside the app.
    if (!userId) return "no-user";
    if (target.customerId && !(await customerOf(ctx, userId))) {
      await ctx.db.insert("stripeCustomers", { userId, customerId: target.customerId });
    }

    if (subscription) return await applySubscription(ctx, userId, subscription, now);
    return (await addTopup(ctx, userId, topup!.credits, topup!.sessionId, now)) ? "topup" : "duplicate-topup";
  },
});
