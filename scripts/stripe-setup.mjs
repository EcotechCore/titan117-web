#!/usr/bin/env node
/**
 * Creates Titan117's plans and credit packs in Stripe, found again later by
 * their lookup keys (pricing.md; prices before VAT, the same numbers in EUR
 * and USD). Safe to run again: anything that already exists is left alone.
 *
 *   node scripts/stripe-setup.mjs                 # test mode, key from apps/web/.env.local
 *   node scripts/stripe-setup.mjs --webhook <url> # also register the webhook endpoint (prints nothing secret)
 *
 * Refuses a live key unless --live is passed. Never prints the key.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = process.argv.slice(2);
const live = args.includes("--live");
const webhookUrl = args.includes("--webhook") ? args[args.indexOf("--webhook") + 1] : null;

function readKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY;
  const env = readFileSync(join(root, "apps", "web", ".env.local"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("STRIPE_SECRET_KEY="));
  return line?.slice("STRIPE_SECRET_KEY=".length).trim().replace(/^"|"$/g, "");
}

const key = readKey();
if (!key) throw new Error("STRIPE_SECRET_KEY is not set (apps/web/.env.local)");
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_") && !live) {
  throw new Error("That isn't a test-mode key. Pass --live only when you mean to create live prices.");
}

function form(params, prefix = "") {
  return Object.entries(params).flatMap(([k, v]) => {
    if (v === undefined || v === null) return [];
    const name = prefix ? `${prefix}[${k}]` : k;
    return typeof v === "object" ? form(v, name) : [`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`];
  });
}

async function stripe(method, path, params = {}) {
  const body = form(params).join("&");
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? body : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

const PLANS = [
  { id: "starter", name: "Titan117 Starter", month: 1500, year: 15000, credits: 700 },
  { id: "pro", name: "Titan117 Pro", month: 2500, year: 25000, credits: 1500 },
  { id: "max", name: "Titan117 Max", month: 5000, year: 50000, credits: 3500 },
];
const TOPUPS = [
  { id: "topup_1000", name: "1,000 Titan117 credits", amount: 1000 },
  { id: "topup_2750", name: "2,750 Titan117 credits", amount: 2500 },
  { id: "topup_6000", name: "6,000 Titan117 credits", amount: 5000 },
];

const products = (await stripe("GET", "/products", { limit: 100 })).data;
async function product(id, name, description) {
  const found = products.find((p) => p.metadata?.titan117_id === id);
  if (found) return found.id;
  const created = await stripe("POST", "/products", { name, description, metadata: { titan117_id: id } });
  console.log(`product ${id}: created`);
  return created.id;
}

async function price(lookupKey, productId, cents, recurring) {
  const existing = await stripe("GET", "/prices", { lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return console.log(`price ${lookupKey}: exists`);
  await stripe("POST", "/prices", {
    product: productId,
    currency: "eur",
    unit_amount: cents,
    currency_options: { usd: { unit_amount: cents, tax_behavior: "exclusive" } },
    tax_behavior: "exclusive", // prices are before VAT (pricing.md)
    lookup_key: lookupKey,
    ...(recurring ? { recurring: { interval: recurring } } : {}),
  });
  console.log(`price ${lookupKey}: created`);
}

for (const p of PLANS) {
  const productId = await product(p.id, p.name, `${p.credits.toLocaleString("en")} credits a month, all agents, local models unlimited.`);
  await price(`titan117_${p.id}_month`, productId, p.month, "month");
  await price(`titan117_${p.id}_year`, productId, p.year, "year");
}
for (const t of TOPUPS) {
  const productId = await product(t.id, t.name, "Credits for cloud models and search. Last 12 months, used while a plan is active.");
  await price(`titan117_${t.id}`, productId, t.amount, null);
}

if (webhookUrl) {
  const events = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ];
  const endpoints = (await stripe("GET", "/webhook_endpoints", { limit: 100 })).data;
  if (endpoints.some((e) => e.url === webhookUrl)) {
    console.log(`webhook ${webhookUrl}: exists`);
  } else {
    const created = await stripe("POST", "/webhook_endpoints", { url: webhookUrl, enabled_events: events });
    // The signing secret is returned only now. Hand it to Convex without printing it.
    const { execFileSync } = await import("node:child_process");
    // The Convex CLI run by Node directly: no shell, so the secret isn't parsed by one.
    const backend = join(root, "packages", "backend");
    execFileSync(process.execPath, [join(backend, "node_modules", "convex", "bin", "main.js"), "env", "set", "STRIPE_WEBHOOK_SECRET", created.secret], {
      cwd: backend,
      stdio: ["ignore", "ignore", "inherit"],
    });
    console.log(`webhook ${webhookUrl}: created; its signing secret is set in Convex as STRIPE_WEBHOOK_SECRET`);
  }
}
