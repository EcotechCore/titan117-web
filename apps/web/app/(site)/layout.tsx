/**
 * The public website (decisions §18): home, agents, industries, pricing, FAQ,
 * Learn and the legal pages. Its own root layout, so these pages carry no
 * sign-in or database code; the signed-in app is under app/(app).
 */
import type { Metadata } from "next";
import { Figtree, Unbounded } from "next/font/google";

import "./site.css";

// Self-hosted at build time: visitors' browsers never contact Google (GDPR).
const figtree = Figtree({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-figtree" });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["600"], variable: "--font-unbounded" });

export const metadata: Metadata = {
  metadataBase: new URL("https://titan117.com"),
  title: "Titan117 · Your AI team, on your own laptop",
  description:
    "A general assistant and nine specialist agents for small companies. They run on your laptop; nothing goes out without your OK.",
};

// The theme is set before the page paints, as on the static site (saved as t117-theme).
const THEME = `var t=null;try{t=localStorage.getItem("t117-theme")}catch(e){}document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");`;

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
