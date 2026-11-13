import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

// Clerk reads the URL, so it renders inside Suspense (Next's cacheComponents).
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <SignIn />
      </Suspense>
    </main>
  );
}
