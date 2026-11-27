/**
 * @titan117/shared: what the web app, Convex, the desktop engine and the
 * product owner portal agree on (architecture §2). Types and schemas only;
 * no server code and nothing secret, because it ships inside the desktop app.
 *
 * The desktop and portal repos install it at a fixed version (guardrails §10).
 */

/**
 * Version of the command protocol between the web app, Convex and the engine.
 * Every protocol message carries it; an older desktop app shows "please
 * update" instead of failing (guardrails §9, §10). Raise it only for a change
 * older clients can't read.
 */
export const PROTOCOL_VERSION = 1;

/** The error codes a client may see from Convex (guardrails §2). */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  // Not enough credits for a cloud call (pricing.md).
  "INSUFFICIENT_CREDITS",
  // A second subscription while one is active; changes go through the billing portal.
  "ALREADY_SUBSCRIBED",
  // Signing in one more device than the plan allows; the user removes one on the account page.
  "DEVICE_LIMIT",
] as const;

/**
 * The plans and credit packs (docs/notes/pricing.md). Prices live in Stripe,
 * found by these lookup keys; what each plan includes lives here, so the web
 * app, Convex and the desktop app agree.
 */
export const PLAN_IDS = ["starter", "pro", "max", "team", "agency"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
/** "custom" plans are set up by hand. */
export type AnyPlanId = PlanId | "custom";

/**
 * `monthlyCredits` and `devices` are per person for the per-seat plans
 * (Team and Agency, decisions §68): credits go into one team pool
 * (credits × seats), devices are what each member may sign in.
 */
export interface PlanInfo {
  name: string;
  monthlyCredits: number;
  devices: number;
  /** Bought per seat (Stripe quantity); a team's members use the owner's plan. */
  perSeat?: { minSeats: number; maxSeats: number; teams: number; whiteLabel: boolean };
}

export const PLANS: Record<PlanId, PlanInfo> = {
  starter: { name: "Starter", monthlyCredits: 700, devices: 2 },
  pro: { name: "Pro", monthlyCredits: 1_500, devices: 3 },
  max: { name: "Max", monthlyCredits: 3_500, devices: 5 },
  // To be confirmed by the owner (decisions §68.6): names, prices, credits and limits.
  team: { name: "Team", monthlyCredits: 1_000, devices: 3, perSeat: { minSeats: 2, maxSeats: 50, teams: 1, whiteLabel: false } },
  agency: {
    name: "Agency",
    monthlyCredits: 1_500,
    devices: 3,
    perSeat: { minSeats: 3, maxSeats: 100, teams: 20, whiteLabel: true },
  },
};

/** A plan's monthly credits: per seat times seats for the per-seat plans. */
export function planAllowance(plan: AnyPlanId | undefined, seats = 1) {
  if (!plan || plan === "custom") return 0;
  const info = PLANS[plan];
  return info.perSeat ? info.monthlyCredits * Math.max(1, Math.floor(seats)) : info.monthlyCredits;
}

/** Seats a checkout may ask for: whole numbers inside the plan's range. */
export function validSeats(plan: PlanId, seats: number) {
  const per = PLANS[plan].perSeat;
  if (!per) return seats === 1;
  return Number.isInteger(seats) && seats >= per.minSeats && seats <= per.maxSeats;
}

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Stripe price lookup key for a plan, e.g. `titan117_pro_month`. */
export function planLookupKey(plan: PlanId, interval: BillingInterval) {
  return `titan117_${plan}_${interval}`;
}

export const TOPUPS = [
  { id: "topup_1000", credits: 1_000 },
  { id: "topup_2750", credits: 2_750 },
  { id: "topup_6000", credits: 6_000 },
] as const;
export type TopupId = (typeof TOPUPS)[number]["id"];

export function topupLookupKey(id: TopupId) {
  return `titan117_${id}`;
}

/** 1 credit = 0.01 of cloud usage at our price: provider cost × 1.25, rounded up (pricing.md). */
export const CREDIT_MARKUP = 1.25;
export function creditsForCost(providerCostUsd: number) {
  if (!(providerCostUsd > 0)) return 0;
  return Math.ceil(Math.round(providerCostUsd * CREDIT_MARKUP * 100 * 1e6) / 1e6);
}

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * The licence lease (decisions §17): what our server signs for one device.
 * The desktop app checks the signature with the public key built into it and
 * locks when `exp` has passed or `plan` is null.
 */
export interface LeasePayload {
  v: 1;
  /** Our user id. */
  sub: string;
  /** The device this lease is for. */
  dev: string;
  /** null: no active plan, so the app locks at once. */
  plan: AnyPlanId | null;
  devices: number;
  /** Server time when signed, ms; the app never accepts a clock earlier than this. */
  iat: number;
  /** Expiry, ms: 14 days from signing while the plan renews, never past a plan that ends. */
  exp: number;
}

/** Days the app keeps working offline on one lease (decisions §17). */
export const LEASE_OFFLINE_DAYS = 14;
export * from "./remote.js";
export * from "./addons.js";
export * from "./teams.js";
