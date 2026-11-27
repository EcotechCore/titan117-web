/**
 * Stripe without the SDK, as in Ninjathons: the webhook signature check, the
 * few REST calls we make, and reading a subscription into the fields an
 * entitlement needs. Runs in the Convex runtime, so only fetch and Web Crypto.
 *
 * Checked against Stripe's docs on 15 Nov 2026 (external-services.md):
 * the signature is an HMAC-SHA256 of `${t}.${raw body}`; only `v1` entries
 * count; events can arrive twice and out of order.
 */
import { PLAN_IDS, type BillingInterval, type PlanId } from "@titan117/shared";

const API = "https://api.stripe.com/v1";

// Stripe's default tolerance for a signature's timestamp.
const TOLERANCE_SECONDS = 5 * 60;

/** Days a plan stays usable after its paid period, while Stripe retries a failed payment. */
export const GRACE_MS = 2 * 24 * 60 * 60 * 1000;

const ACTIVE = new Set(["active", "trialing", "past_due"]);
/** Statuses whose period has been paid, so its monthly credits are due. */
const PAID = new Set(["active", "trialing"]);

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

/** The parts of a subscription the entitlement needs, read from Stripe's object. */
export type SubscriptionState = {
  subscriptionId: string;
  customerId: string;
  // From the Checkout's subscription_data.metadata.
  userId: string | null;
  status: string;
  // From the price's lookup key; null for a price that isn't ours.
  plan: PlanId | null;
  /** The subscription's quantity: seats for the per-seat plans. */
  seats?: number;
  interval: BillingInterval | null;
  // Milliseconds. Newer API versions keep these on each item, older ones on the subscription.
  periodStart: number;
  periodEnd: number;
  cancelAtPeriodEnd: boolean;
};

async function hmacHex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equalTimingSafe(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The `Stripe-Signature` header for a payload, as Stripe signs it. For tests. */
export async function signPayload(payload: string, secret: string, timestamp: number) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`;
}

/**
 * Checks a webhook delivery's `Stripe-Signature` header and returns the event,
 * or null for a bad signature, an old timestamp or a body that isn't JSON.
 */
export async function verifyStripeEvent(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<StripeEvent | null> {
  if (!header) return null;
  const parts = header.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as const;
  });
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return null;

  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  if (!signatures.some((s) => equalTimingSafe(s, expected))) return null;
  try {
    return JSON.parse(payload) as StripeEvent;
  } catch {
    return null;
  }
}

/** Form-encodes nested params the way Stripe's API reads them: `a[b][0][c]=…`. */
export function toForm(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object") out.push(...toForm(value as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return out;
}

export class StripeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** One call to Stripe's REST API with the secret key from the Convex environment. */
export async function stripe<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in the Convex environment");
  const form = toForm(params).join("&");
  const url = method === "POST" || !form ? `${API}${path}` : `${API}${path}?${form}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? form : undefined,
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  // Stripe's message, never the request: it could hold the key's prefix or user data.
  if (!response.ok) throw new StripeError(response.status, body.error?.message ?? `Stripe ${response.status}`);
  return body;
}

/** `titan117_pro_month` → pro and month; anything else → nulls. */
export function planFromLookupKey(key: string | null | undefined): { plan: PlanId | null; interval: BillingInterval | null } {
  const m = /^titan117_(\w+?)_(month|year)$/.exec(key ?? "");
  const plan = m && (PLAN_IDS as readonly string[]).includes(m[1]!) ? (m[1] as PlanId) : null;
  return { plan, interval: plan ? (m![2] as BillingInterval) : null };
}

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: {
    data?: {
      current_period_start?: number;
      current_period_end?: number;
      quantity?: number;
      price?: { lookup_key?: string | null; recurring?: { interval?: string } | null };
    }[];
  };
};

export function subscriptionState(raw: Record<string, unknown>): SubscriptionState {
  const sub = raw as unknown as StripeSubscription;
  const items = sub.items?.data ?? [];
  const periodEnd = Math.max(sub.current_period_end ?? 0, ...items.map((i) => i.current_period_end ?? 0));
  const starts = [sub.current_period_start ?? 0, ...items.map((i) => i.current_period_start ?? 0)].filter((s) => s > 0);
  const { plan, interval } = planFromLookupKey(items[0]?.price?.lookup_key);
  return {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    userId: sub.metadata?.userId ?? null,
    status: sub.status,
    plan,
    interval,
    seats: Math.max(1, Math.floor(items[0]?.quantity ?? 1)),
    periodStart: (starts.length ? Math.min(...starts) : 0) * 1000,
    periodEnd: periodEnd * 1000,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
}

export function isActiveStatus(status: string) {
  return ACTIVE.has(status);
}

export function isPaidStatus(status: string) {
  return PAID.has(status);
}
