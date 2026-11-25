"use client";

/**
 * Switch remote control on for one laptop (decisions §64.5): the Titan117 app
 * opened this page. A second factor from the last ten minutes is required;
 * Convex checks it from Clerk's verified session token (convex/remote.ts),
 * and Clerk's own prompt asks for it when it's older.
 */
import { useAuth, useReverification } from "@clerk/nextjs";
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { needsSecondFactor } from "@/lib/remote-keys";

function Enable() {
  const params = useSearchParams();
  const device = params.get("device") ?? "";
  const { isAuthenticated } = useConvexAuth();
  const { getToken } = useAuth();
  const laptops = useQuery(api.remote.laptops, isAuthenticated ? {} : "skip");
  const enable = useAction(api.remote.enable);
  const [status, setStatus] = useState<"ask" | "working" | "done" | "error" | "plan">("ask");

  const laptop = laptops?.find((l) => l.id === device);

  // Wrapped by Clerk: answering "needs a second factor" shows Clerk's prompt and runs this again.
  const confirm = useReverification(async () => {
    const sessionToken = await getToken({ skipCache: true });
    if (!sessionToken) throw new Error("Not signed in.");
    try {
      await enable({ deviceId: device as Id<"devices">, sessionToken });
      return { ok: true as const };
    } catch (error) {
      if (error instanceof ConvexError && error.data === "FORBIDDEN") return needsSecondFactor();
      throw error;
    }
  });

  async function go() {
    setStatus("working");
    try {
      const result = await confirm();
      setStatus(result && "ok" in result ? "done" : "error");
    } catch (error) {
      setStatus(error instanceof ConvexError && error.data === "PAYMENT_REQUIRED" ? "plan" : "error");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-4 text-center">
      <p className="font-semibold tracking-[.04em]">TITAN117</p>
      {laptops === undefined ? null : !laptop ? (
        <>
          <h1 className="text-2xl font-medium">This link isn&apos;t for a laptop on your account</h1>
          <p className="text-[#6b6b6b]">Start again from Remote control in the Titan117 app.</p>
        </>
      ) : status === "done" || laptop.remoteOn ? (
        <>
          <h1 className="text-2xl font-medium">Remote control is on for {laptop.name}</h1>
          <p className="text-[#6b6b6b]">Go back to the Titan117 app to pair your phone or this browser.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-medium">Switch on remote control for {laptop.name}?</h1>
          <p className="text-[#6b6b6b]">
            Your phone, other browsers and your own chat bot will be able to start tasks on this laptop and answer its
            approvals. Deleting, paying, sending things out and changing permissions are still approved on the laptop.
            To make sure it&apos;s you, confirm with your second factor (a passkey or an authenticator app).
          </p>
          {status === "error" && (
            <p className="text-[#c2361f]" role="alert">
              That didn&apos;t work. Your account needs two-factor sign-in switched on (in your profile), then try again.
            </p>
          )}
          {status === "plan" && (
            <p className="text-[#c2361f]" role="alert">
              Remote control needs an active plan.
            </p>
          )}
          <button
            className="h-11 rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
            disabled={status === "working"}
            onClick={() => void go()}
          >
            {status === "working" ? "Checking…" : "Confirm and switch on"}
          </button>
        </>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Enable />
    </Suspense>
  );
}
