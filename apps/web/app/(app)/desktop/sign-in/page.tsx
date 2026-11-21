"use client";

/**
 * Desktop sign-in, step 2 (convex/devices.ts): the Titan117 app on this
 * laptop opened this page with its PKCE challenge and the port it listens on.
 * After the user confirms, the one-time code goes back to the app at
 * 127.0.0.1 only (RFC 8252's loopback redirect), never to another host.
 */
import { api } from "@titan117/backend/api";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function validParams(params: URLSearchParams) {
  const challenge = params.get("challenge") ?? "";
  const state = params.get("state") ?? "";
  const port = Number(params.get("port"));
  const name = (params.get("name") ?? "").slice(0, 60);
  // The app install's fingerprint (its ID never leaves the laptop): the same install signing in again replaces itself.
  const install = params.get("install") ?? "";
  const ok =
    /^[A-Za-z0-9_-]{43}$/.test(challenge) &&
    /^[A-Za-z0-9_-]{16,128}$/.test(state) &&
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535;
  return ok
    ? {
        challenge,
        state,
        port,
        name: name || "Desktop",
        install: /^[A-Za-z0-9_-]{43}$/.test(install) ? install : undefined,
      }
    : null;
}

function SignIn() {
  const params = useSearchParams();
  const request = validParams(params);
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const startSignIn = useAction(api.devices.startSignIn);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"ask" | "working" | "done" | "error" | "limit">("ask");
  // At the plan's device limit: the devices, to sign one out here and try again.
  const devices = useQuery(api.devices.list, ready && status === "limit" ? {} : "skip");
  const revoke = useMutation(api.devices.revoke);

  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);

  async function approve() {
    if (!request) return;
    setStatus("working");
    try {
      const { code } = await startSignIn({
        challenge: request.challenge,
        name: request.name,
        ...(request.install ? { install: request.install } : {}),
      });
      const back = new URL(`http://127.0.0.1:${request.port}/callback`);
      back.searchParams.set("code", code);
      back.searchParams.set("state", request.state);
      setStatus("done");
      window.location.assign(back.toString());
    } catch (error) {
      setStatus(error instanceof ConvexError && error.data === "DEVICE_LIMIT" ? "limit" : "error");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-4 text-center">
      <p className="font-semibold tracking-[.04em]">TITAN117</p>
      {!request ? (
        <>
          <h1 className="text-2xl font-medium">This sign-in link isn&apos;t valid</h1>
          <p className="text-[#6b6b6b]">Start again from Sign in in the Titan117 app.</p>
        </>
      ) : status === "done" ? (
        <>
          <h1 className="text-2xl font-medium">You&apos;re signed in</h1>
          <p className="text-[#6b6b6b]">Go back to the Titan117 app. You can close this tab.</p>
        </>
      ) : status === "limit" ? (
        <>
          <h1 className="text-2xl font-medium">Your plan&apos;s devices are all signed in</h1>
          <p className="text-[#6b6b6b]">
            Sign one of them out to sign in on <strong className="text-inherit">{request.name}</strong>. A device you
            sign out stops working until it signs in again.
          </p>
          <ul className="flex flex-col gap-2 text-left">
            {(devices ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] px-4 py-3">
                <span>
                  <strong className="font-medium">{d.name}</strong>
                  <span className="block text-sm text-[#6b6b6b]">
                    {d.lastSeenAt ? `Last seen ${new Date(d.lastSeenAt).toLocaleString()}` : "Not seen yet"}
                  </span>
                </span>
                <button
                  className="h-9 rounded-[8px] border border-[#e5e5e5] px-3 text-sm hover:border-[#ff6347]"
                  onClick={() => void revoke({ deviceId: d.id })}
                >
                  Sign out
                </button>
              </li>
            ))}
          </ul>
          <button
            className="h-11 rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
            onClick={approve}
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-medium">Sign in to the Titan117 app?</h1>
          <p className="text-[#6b6b6b]">
            The app on <strong className="text-inherit">{request.name}</strong> asked to sign in to your account. Only
            continue if you just clicked Sign in in the app on this computer.
          </p>
          {status === "error" && (
            <p role="alert" className="rounded-lg border border-[#ff6347] px-4 py-3 text-sm">
              Something went wrong. Start again from the app.
            </p>
          )}
          <button
            className="h-11 rounded-[10px] bg-[#ff6347] font-medium text-white hover:bg-[#c2361f] disabled:opacity-60"
            disabled={!ready || status === "working"}
            onClick={approve}
          >
            {status === "working" ? "Signing in…" : "Sign in to the app"}
          </button>
        </>
      )}
    </main>
  );
}

export default function DesktopSignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
