import type { Metadata } from "next";

import { LegalPage, Mail } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Cookie Policy · Titan117",
  description: "Titan117 uses only the cookies needed to sign in and to run the website. No tracking, no advertising.",
};

/**
 * Cookie policy. Only strictly necessary cookies and storage, so no consent
 * banner is needed (ePrivacy Directive art. 5(3)). If analytics or anything
 * non-essential is ever added, a consent banner must come with it.
 */
export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      lead="We use only what's needed to sign you in and to run the website. No analytics, no tracking, no advertising, so there's nothing to accept or refuse."
      sections={[
        {
          id: "what",
          title: "What we use",
          body: (
            <ul>
              <li>
                <b>Sign-in cookies</b> (set by Clerk, our sign-in provider, on titan117.com): keep you signed in to your
                account page and protect sign-in from abuse. Needed for the service you ask for.
              </li>
              <li>
                <b>Payment cookies</b> (set by Stripe on its own checkout and billing pages, not on ours): needed to take
                payments safely and prevent fraud.
              </li>
              <li>
                <b>Your theme choice</b> (light or dark), kept in your browser&apos;s local storage, not a cookie; it
                never leaves your browser.
              </li>
            </ul>
          ),
        },
        {
          id: "not",
          title: "What we don't use",
          body: (
            <p>
              No analytics or tracking cookies, no advertising or social media pixels. Our fonts are served from our own
              site, so your browser doesn&apos;t contact Google or other font services.
            </p>
          ),
        },
        {
          id: "control",
          title: "Your control",
          body: (
            <p>
              You can delete or block cookies in your browser&apos;s settings. If you block sign-in cookies, you
              won&apos;t be able to sign in to your account page. Questions: <Mail to="privacy" />.
            </p>
          ),
        },
      ]}
    />
  );
}
