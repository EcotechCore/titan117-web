"use client";

import { UserButton } from "@clerk/nextjs";
import { api } from "@titan117/backend/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

// Phase 0: proves sign-in reaches Convex. The real account page (plan,
// credits, devices) comes in phase 2.
export default function AccountPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const [ready, setReady] = useState(false);
  // users.me needs the row, so make sure it exists before asking.
  useEffect(() => {
    if (isAuthenticated) ensureUser().then(() => setReady(true));
  }, [isAuthenticated, ensureUser]);
  const me = useQuery(api.users.me, ready ? {} : "skip");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <UserButton />
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p className="text-zinc-500">
        {isLoading
          ? "Connecting…"
          : !isAuthenticated
            ? "Signed in with Clerk, but Convex didn't accept the token. Check CLERK_FRONTEND_API_URL."
            : me === undefined
              ? "Loading…"
              : "Signed in. Convex knows who you are."}
      </p>
    </main>
  );
}
