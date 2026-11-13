import type { AuthConfig } from "convex/server";

// Convex accepts tokens from our Clerk application (docs.convex.dev/auth/clerk,
// checked 12 Nov 2026): activate the Convex integration in the Clerk dashboard
// and set CLERK_FRONTEND_API_URL (the Clerk Frontend API URL; Clerk's name for
// it, Convex's docs call it CLERK_JWT_ISSUER_DOMAIN) in the Convex
// deployment's environment variables.
//
// The staff Clerk application for the product owner portal is added here as a
// second provider in phase 5, with the portal's first Convex calls.
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
