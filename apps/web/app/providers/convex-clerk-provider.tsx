"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

import { EnsureUser } from "./ensure-user";

// Clerk wraps Convex, so Convex gets Clerk's token (docs.convex.dev/auth/clerk).
// Who may see what is decided in Convex, never here (guardrails §2).
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
const convex = new ConvexReactClient(convexUrl);

export default function ConvexClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <EnsureUser />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
