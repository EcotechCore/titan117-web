"use client";

/**
 * Desktop sign-in, step 2 (convex/devices.ts): the Titan117 app on this
 * laptop opened this page with its PKCE challenge and the port it listens on.
 * After the user confirms, the one-time code goes back to the app at
 * 127.0.0.1 only (RFC 8252's loopback redirect), never to another host.
 */
import { api } from "@titan117/backend/api";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function validParams(params: URLSearchParams) {
  const challenge = params.get("challenge") ?? "";
  const state = params.get("state") ?? "";
  const port = Number(params.get("port"));
  const name = (params.get("name") ?? "").slice(0, 60);
  const ok =
    /^[A-Za-z0-9_-]{43}$/.test(challenge) &&
    /^[A-Za-z0-9_-]{16,128}$/.test(state) &&
    Number.isInteger(port) &&
    port >= 1024 &&
    port <= 65535;
  return ok ? { challenge, state, port, name: name || "Desktop" } : null;
}

function SignIn() {
  const params = useSearchParams();
  const request = validParams(params);
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const startSignIn = useAction(api.devices.startSignIn);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"ask" | "working" | "done" | "error">("ask");

  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);

  async function approve() {
    if (!request) return;
    setStatus("working");
    try {
      const { code } = await startSignIn({ challenge: request.challenge, name: request.name });
      const back = new URL(`http://127.0.0.1:${request.port}/callback`);
      back.searchParams.set("code", code);
      back.searchParams.set("state", request.state);
      setStatus("done");
      window.location.assign(back.toString());
    } catch {
      setStatus("error");
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
