"use client";

/**
 * Pair this browser or phone with a laptop (decisions §64.6). The laptop's QR
 * leads here with the pairing id and the laptop's public key in the address's
 * fragment, which never reaches a server. This browser makes its own key,
 * sends only the public half (with a fresh second factor), and both screens
 * show the same 6-character code; the laptop trusts this browser only when
 * the user clicks Allow there.
 */
import { useAuth, useReverification } from "@clerk/nextjs";
import { api } from "@titan117/backend/api";
import type { Id } from "@titan117/backend/dataModel";
import { PUBLIC_KEY_PATTERN, pairingCode } from "@titan117/shared";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { browserCanPair, browserName, ensureDeviceKey, isPhone, needsSecondFactor, trustLaptop } from "@/lib/remote-keys";

const noop = () => () => {};
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readFragment() {
  if (typeof window === "undefined") return null;
  const f = new URLSearchParams(window.location.hash.slice(1));
  const p = f.get("p") ?? "";
  const k = f.get("k") ?? "";
  const n = (f.get("n") ?? "your laptop").slice(0, 60);
  return /^[a-z0-9]{10,64}$/i.test(p) && PUBLIC_KEY_PATTERN.test(k) ? { pairingId: p, laptopKey: k, laptopName: n } : null;
}

export default function Pair() {
  // The fragment and the browser exist only in the browser; the server renders nothing here.
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => null);
  const loaded = hash !== null;
  const link = useMemo(() => (hash === null ? null : readFragment()), [hash]);
  const phone = useSyncExternalStore(noop, isPhone, () => false);
  const { isAuthenticated } = useConvexAuth();
  const { getToken } = useAuth();
  const claim = useAction(api.remote.claimPairing);
  const [step, setStep] = useState<"ask" | "working" | "code" | "done" | "refused" | "error" | "unsupported" | "limit">("ask");
  const [code, setCode] = useState<string | null>(null);
  const status = useQuery(
    api.remote.pairingStatus,
    isAuthenticated && link && step === "code" ? { pairingId: link.pairingId as Id<"pairings"> } : "skip",
  );

  useEffect(() => {
    void browserCanPair().then((ok) => !ok && setStep("unsupported"));
  }, []);

  useEffect(() => {
    if (!link || step !== "code" || !status) return;
    if (status.status === "confirmed") {
      void trustLaptop({ publicKey: link.laptopKey, name: link.laptopName, pairedAt: Date.now() }).then(() => setStep("done"));
    }
  }, [status, step, link]);
  const refused = step === "code" && !!status && ["refused", "expired", "gone"].includes(status.status);

  const send = useReverification(async () => {
    const key = await ensureDeviceKey();
    const sessionToken = await getToken({ skipCache: true });
    if (!sessionToken || !link) throw new Error("Not signed in.");
    try {
      const result = await claim({
        pairingId: link.pairingId as Id<"pairings">,
        publicKey: key.publicKey,
        name: browserName(),
        kind: isPhone() ? "phone" : "browser",
        sessionToken,
      });
      return { ok: true as const, laptopKey: result.laptopKey, publicKey: key.publicKey };
    } catch (error) {
      if (error instanceof ConvexError && error.data === "FORBIDDEN") return needsSecondFactor();
      throw error;
    }
  });

  async function pair() {
    setStep("working");
    try {
      const result = await send();
      if (!result || !("ok" in result)) return setStep("error");
      // The key Convex returned must be the one in the QR: otherwise someone swapped it.
      if (result.laptopKey !== link!.laptopKey) return setStep("error");
      setCode(await pairingCode(link!.laptopKey, result.publicKey));
      setStep("code");
    } catch (error) {
      setStep(error instanceof ConvexError && error.data === "DEVICE_LIMIT" ? "limit" : "error");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-4 text-center">
      <p className="font-semibold tracking-[.04em]">TITAN117</p>
      {!loaded ? null : !link ? (
        <>
          <h1 className="text-2xl font-medium">This pairing link isn&apos;t valid</h1>
          <p className="text-[#6b6b6b]">On the laptop, open Remote control and choose Pair a phone or browser.</p>
        </>
      ) : step === "unsupported" ? (
        <>
          <h1 className="text-2xl font-medium">This browser can&apos;t keep a key safely</h1>
          <p className="text-[#6b6b6b]">Use a current Edge, Chrome, Safari or Firefox, not a private window.</p>
        </>
      ) : step === "code" && !refused ? (
        <>
          <h1 className="text-2xl font-medium">Check the code on your laptop</h1>
          <p className="font-mono text-4xl tracking-[.12em] text-[#c2361f]">{code}</p>
          <p className="text-[#6b6b6b]">
            {link.laptopName} shows a code too. If it&apos;s the same, click Allow there. If it isn&apos;t, click Don&apos;t
            allow.
          </p>
        </>
      ) : step === "done" ? (
        <>
          <h1 className="text-2xl font-medium">Paired with {link.laptopName}</h1>
          <p className="text-[#6b6b6b]">Only this browser and your laptop can read what you send each other.</p>
          <Link
            href="/remote"
            className="flex h-11 items-center justify-center rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f]"
          >
            Open Remote control
          </Link>
        </>
      ) : step === "refused" || refused ? (
        <>
          <h1 className="text-2xl font-medium">Not paired</h1>
          <p className="text-[#6b6b6b]">The laptop didn&apos;t allow it, or the link ran out. Start again on the laptop.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-medium">Pair this {phone ? "phone" : "browser"} with {link.laptopName}?</h1>
          <p className="text-[#6b6b6b]">
            You&apos;ll be able to start tasks there and answer its approvals from here. To make sure it&apos;s you,
            confirm with your second factor.
          </p>
          {step === "error" && (
            <p className="text-[#c2361f]" role="alert">
              That didn&apos;t work. Your account needs two-factor sign-in, and the link works once for five minutes.
            </p>
          )}
          {step === "limit" && (
            <p className="text-[#c2361f]" role="alert">
              Your plan&apos;s devices are all paired. Remove one on the laptop first.
            </p>
          )}
          <button
            className="h-11 rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
            disabled={step === "working" || !isAuthenticated}
            onClick={() => void pair()}
          >
            {step === "working" ? "Pairing…" : "Pair"}
          </button>
        </>
      )}
    </main>
  );
}
