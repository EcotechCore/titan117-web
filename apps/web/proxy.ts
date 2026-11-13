import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Sends signed-out visitors to sign-in on account pages. User experience
// only: data is protected by the Convex wrappers (guardrails §2), never here.
const isAccountRoute = createRouteMatcher(["/account(.*)"]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isAccountRoute(req)) await auth.protect();
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
