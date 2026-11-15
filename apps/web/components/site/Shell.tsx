/**
 * One website page: the icon sprite, header, the page's sections, footer, the
 * back-to-top button and the page scripts (homepage-grid/design.md).
 *
 * The scripts change the page (they draw the eyes, mark the current nav item,
 * add listeners), so they must start after React has hydrated it; otherwise
 * React sees a page that differs from the server's and re-renders it. One
 * loader runs after hydration and loads them in order: the eyes, what every
 * page shares, then the home page's own.
 */
import Script from "next/script";
import type { ReactNode } from "react";

import { Footer, Header, Icon } from "./parts";
import { Sprite } from "./Sprite";

function loader(page: string, home: boolean) {
  const files = ["/assets/bot.js", "/assets/site.js", ...(home ? ["/assets/home.js"] : [])];
  return `document.body.dataset.page=${JSON.stringify(page)};
(function next(files){if(!files.length)return;var s=document.createElement("script");s.src=files[0];s.onload=function(){next(files.slice(1))};document.body.appendChild(s)})(${JSON.stringify(files)});`;
}

export function Shell({ page, children, home = false }: { page: string; children: ReactNode; home?: boolean }) {
  return (
    <>
      <Sprite />
      <Header />
      <main id="top" className="frame">
        {children}
        <Footer />
      </main>
      <button className="to-top" id="to-top" aria-label="Back to top">
        <Icon name="arrow-up" />
      </button>
      <Script id="site-scripts" strategy="afterInteractive">
        {loader(page, home)}
      </Script>
    </>
  );
}
