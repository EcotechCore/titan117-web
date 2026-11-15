"use client";

import { api } from "@titan117/backend/api";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";

// Creates the Convex users row right after sign-in instead of waiting for
// Clerk's webhook, which can be late (users.ensureUser). Renders nothing.
export function EnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    if (!isAuthenticated) return;
    ensureUser().catch((error) => {
      // The webhook still creates the row, so this isn't fatal.
      console.error("Could not create the user row", error);
    });
  }, [isAuthenticated, ensureUser]);

  return null;
}
