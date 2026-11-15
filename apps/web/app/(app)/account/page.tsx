"use client";

import { UserButton } from "@clerk/nextjs";
import { api } from "@titan117/backend/api";
import { PLAN_IDS, PLANS, TOPUPS, type BillingInterval, type PlanId, type TopupId } from "@titan117/shared";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Prices as in pricing.md; Stripe charges what its prices say, these are labels.
const PRICE: Record<PlanId, Record<BillingInterval, number>> = {
  starter: { month: 15, year: 150 },
  pro: { month: 25, year: 250 },
  max: { month: 50, year: 500 },
};
const TOPUP_PRICE: Record<TopupId, number> = { topup_1000: 10, topup_2750: 25, topup_6000: 50 };

const REASONS: Record<string, string> = {
  monthly: "Monthly credits",
  upgrade: "Upgrade",
  topup: "Top-up",
  usage: "Cloud usage",
  expired: "Expired",
};

const date = (ms: number | null) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

function errorText(error: unknown) {
  const code = error instanceof ConvexError ? String(error.data) : "";
  if (code === "ALREADY_SUBSCRIBED") return "You already have a plan. Change it from Manage billing.";
  if (code === "PAYMENT_REQUIRED") return "Top-ups need an active plan.";
  return "Something went wrong talking to our payment provider. Please try again.";
}

function Account() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);
  const summary = useQuery(api.billing.summary, ready ? {} : "skip");
  const devices = useQuery(api.devices.list, ready ? {} : "skip");
  const revoke = useMutation(api.devices.revoke);
  const deletion = useQuery(api.account.deletionStatus, ready ? {} : "skip");
  const requestDeletion = useAction(api.account.requestDeletion);
  const cancelDeletion = useAction(api.account.cancelDeletion);

  const checkout = useAction(api.billing.checkout);
  const topUp = useAction(api.billing.topUp);
  const portal = useAction(api.billing.portal);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();

  async function go(key: string, start: () => Promise<{ url: string }>) {
    setBusy(key);
    setError(null);
    try {
      const { url } = await start();
      if (url) window.location.assign(url);
      else setBusy(null);
    } catch (e) {
      setError(errorText(e));
      setBusy(null);
    }
  }

  if (isLoading || (isAuthenticated && summary === undefined)) {
    return <p className="p-10 text-center text-[#6b6b6b]">Loading…</p>;
  }
  if (!isAuthenticated || !summary) {
    return <p className="p-10 text-center text-[#6b6b6b]">Sign in to see your account.</p>;
  }

  const notice =
    params.get("checkout") === "success"
      ? "Thanks! Your plan starts as soon as the payment is confirmed, usually within seconds."
      : params.get("topup") === "success"
        ? "Thanks! Your credits arrive as soon as the payment is confirmed."
        : null;

  return (
    <main className="mx-auto w-full max-w-[1200px] border-x border-[#e6e6e6] dark:border-[#262626]">
      <header className="flex items-center justify-between border-b border-[#e6e6e6] px-4 py-5 sm:px-10 dark:border-[#262626]">
        <span className="font-semibold tracking-[.04em]">TITAN117</span>
        <UserButton />
      </header>

      <section className="border-b border-[#e6e6e6] px-4 py-12 sm:px-10 dark:border-[#262626]">
        <h1 className="text-4xl font-medium tracking-tight">Your account</h1>
        {notice && <p className="mt-4 rounded-lg bg-[#ffece8] px-4 py-3 text-[#c2361f] dark:bg-[#2e1310]">{notice}</p>}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-[#ff6347] px-4 py-3">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-[#e6e6e6] bg-[#e6e6e6] sm:grid-cols-3 dark:border-[#262626] dark:bg-[#262626]">
          <Stat label="Plan" value={summary.plan ? PLANS[summary.plan as PlanId]?.name ?? "Custom" : "No plan"}>
            {summary.plan
              ? summary.cancelAtPeriodEnd
                ? `Ends ${date(summary.paidUntil)}`
                : summary.status === "past_due"
                  ? "Payment failed: we're retrying. Check your card in Manage billing."
                  : `Renews ${date(summary.paidUntil)}`
              : "Choose a plan below to use Titan117."}
          </Stat>
          <Stat label="Credits" value={summary.credits.total.toLocaleString()}>
            {summary.credits.monthly.toLocaleString()} this month · {summary.credits.rollover.toLocaleString()} rolled
            over · {summary.credits.topup.toLocaleString()} top-ups
          </Stat>
          <Stat label="Billing" value={summary.hasBilling ? "Stripe" : "None yet"}>
            {summary.hasBilling ? (
              <button
                className="underline decoration-[#ff6347] underline-offset-4"
                disabled={busy !== null}
                onClick={() => go("portal", () => portal({}))}
              >
                {busy === "portal" ? "Opening…" : "Manage billing and invoices"}
              </button>
            ) : (
              "Invoices appear here after your first payment."
            )}
          </Stat>
        </div>
      </section>

      {!summary.plan && (
        <section className="border-b border-[#e6e6e6] px-4 py-12 sm:px-10 dark:border-[#262626]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-medium">Choose a plan</h2>
            <div className="flex rounded-lg border border-[#e6e6e6] p-1 text-sm dark:border-[#262626]">
              {(["month", "year"] as const).map((i) => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  className={`rounded-md px-3 py-1.5 ${interval === i ? "bg-[#f4f4f5] font-medium dark:bg-[#161618]" : "text-[#6b6b6b]"}`}
                >
                  {i === "month" ? "Monthly" : "Yearly (2 months free)"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-[#e6e6e6] bg-[#e6e6e6] sm:grid-cols-3 dark:border-[#262626] dark:bg-[#262626]">
            {PLAN_IDS.map((id) => (
              <div key={id} className="flex flex-col gap-3 bg-white p-6 dark:bg-[#0b0b0b]">
                <h3 className="text-lg font-medium">{PLANS[id].name}</h3>
                <p className="text-3xl font-medium">
                  €{PRICE[id][interval]}
                  <span className="text-base text-[#6b6b6b]"> / {interval}</span>
                </p>
                <p className="text-sm text-[#6b6b6b]">
                  {PLANS[id].monthlyCredits.toLocaleString()} credits a month · {PLANS[id].devices} devices · local models
                  unlimited. Prices before VAT.
                </p>
                <button
                  className="mt-auto h-11 rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
                  disabled={busy !== null}
                  onClick={() => go(id, () => checkout({ plan: id, interval }))}
                >
                  {busy === id ? "Opening checkout…" : `Choose ${PLANS[id].name}`}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary.plan && (
        <section className="border-b border-[#e6e6e6] px-4 py-12 sm:px-10 dark:border-[#262626]">
          <h2 className="text-2xl font-medium">Top up credits</h2>
          <p className="mt-2 text-sm text-[#6b6b6b]">Top-ups last 12 months and are used after your monthly credits.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {TOPUPS.map((t) => (
              <button
                key={t.id}
                className="h-11 rounded-[10px] border border-[#e6e6e6] px-4 hover:border-[#ff6347] disabled:opacity-60 dark:border-[#262626]"
                disabled={busy !== null}
                onClick={() => go(t.id, () => topUp({ pack: t.id }))}
              >
                {busy === t.id ? "Opening…" : `${t.credits.toLocaleString()} credits · €${TOPUP_PRICE[t.id]}`}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="border-b border-[#e6e6e6] px-4 py-12 sm:px-10 dark:border-[#262626]">
        <h2 className="text-2xl font-medium">Devices</h2>
        <p className="mt-2 text-sm text-[#6b6b6b]">
          Computers signed in to the Titan117 app
          {summary.plan && PLANS[summary.plan as PlanId] ? ` (your plan allows ${PLANS[summary.plan as PlanId].devices})` : ""}.
          Signing one out locks the app there the next time it checks in.
        </p>
        {!devices || devices.length === 0 ? (
          <p className="mt-4 text-[#6b6b6b]">No devices yet. Download the app and sign in.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#e6e6e6] dark:divide-[#262626]">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>
                  {d.name}
                  <span className="ml-2 text-[#6b6b6b]">
                    signed in {date(d.createdAt)}
                    {d.lastSeenAt ? ` · last seen ${date(d.lastSeenAt)}` : ""}
                  </span>
                </span>
                <button
                  className="underline decoration-[#ff6347] underline-offset-4"
                  onClick={() => {
                    if (window.confirm(`Sign out ${d.name}? The app there locks until someone signs in again.`))
                      void revoke({ deviceId: d.id });
                  }}
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-b border-[#e6e6e6] px-4 py-12 sm:px-10 dark:border-[#262626]">
        <h2 className="text-2xl font-medium">Credit history</h2>
        {summary.history.length === 0 ? (
          <p className="mt-4 text-[#6b6b6b]">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#e6e6e6] dark:divide-[#262626]">
            {summary.history.map((h, i) => (
              <li key={i} className="flex justify-between gap-4 py-3 text-sm">
                <span>
                  {REASONS[h.reason] ?? h.reason}
                  <span className="ml-2 text-[#6b6b6b]">{date(h.at)}</span>
                </span>
                <span className={`font-mono ${h.amount > 0 ? "text-[#c2361f]" : ""}`}>
                  {h.amount > 0 ? "+" : ""}
                  {h.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="px-4 py-12 sm:px-10">
        <h2 className="text-2xl font-medium">Delete account</h2>
        {deletion?.deleteAfter ? (
          <>
            <p className="mt-4 rounded-lg bg-[#ffece8] px-4 py-3 text-[#c2361f] dark:bg-[#2e1310]">
              Your account will be deleted on {date(deletion.deleteAfter)}, with its plan, credits and devices. Your plan
              won&apos;t renew; it works until the end of the period you paid for. Invoices stay with Stripe, as the law
              requires. Your files on your computers are never touched.
            </p>
            <button
              className="mt-4 h-11 rounded-[10px] bg-[#ff6347] px-4 font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => go("cancel-deletion", async () => (await cancelDeletion({}), { url: "" }))}
            >
              {busy === "cancel-deletion" ? "Cancelling…" : "Keep my account"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 max-w-2xl text-sm text-[#6b6b6b]">
              Deletes your account 30 days after you ask, so you can change your mind. Your plan stops renewing at once;
              unused credits are lost and nothing is refunded. Your files on your computers are never touched.
            </p>
            <button
              className="mt-4 h-11 rounded-[10px] border border-[#e6e6e6] px-4 hover:border-[#ff6347] disabled:opacity-60 dark:border-[#262626]"
              disabled={busy !== null}
              onClick={() => {
                if (window.confirm("Delete your Titan117 account in 30 days? Your plan stops renewing now."))
                  void go("delete", async () => (await requestDeletion({}), { url: "" }));
              }}
            >
              {busy === "delete" ? "Scheduling…" : "Delete my account"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 dark:bg-[#0b0b0b]">
      <p className="font-mono text-xs uppercase tracking-wider text-[#6b6b6b]">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
      <div className="mt-2 text-sm text-[#6b6b6b]">{children}</div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
