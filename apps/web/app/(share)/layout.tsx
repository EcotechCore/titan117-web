/**
 * Shared artifacts (feature 17.13): its own root layout, with no sign-in code.
 * The artifact itself never runs here: it's framed from /s/<id>/raw, which is
 * served in a sandbox with no access to this origin (decisions §44).
 */
import type { Metadata } from "next";

import "./share.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://titan117.com"),
  title: "Shared with Titan117",
  // Shared pages are private links, not for search engines.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const THEME = `document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";`;

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
