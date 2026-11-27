/**
 * A shared artifact (feature 17.13, decisions §44): the title, who made it
 * with what, a Report button, and the page itself in a sandboxed frame.
 */
import { api } from "@titan117/backend/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Comments } from "./comments";
import { ReportButton } from "./report";

// Every share is a private link fetched on request.
export const instant = false;

async function load(id: string) {
  // A share can be unshared or taken down at any moment: always read it at request time.
  await connection();
  try {
    return await fetchQuery(api.shares.view, { publicId: id });
  } catch {
    return null;
  }
}

async function loadComments(id: string) {
  try {
    return await fetchQuery(api.shares.comments, { publicId: id });
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const share = await load((await params).id);
  return { title: share?.state === "live" && share.title ? `${share.title} · Shared with Titan117` : "Shared with Titan117" };
}

async function Shared({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const share = await load(id);
  if (!share)
    return (
      <main className="notice">
        <h1>This link doesn&apos;t lead anywhere</h1>
        <p>The page was unshared by its owner, or the link is wrong.</p>
      </main>
    );
  if (share.state === "removed")
    return (
      <main className="notice">
        <h1>This page was removed</h1>
        <p>It was taken down after a report, under our content rules.</p>
      </main>
    );
  return (
    <>
      <header className="bar" style={share.brand ? { borderBottom: `3px solid ${share.brand.accent}` } : undefined}>
        {share.brand && (
          <span className="brand">
            {share.brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={share.brand.logoUrl} alt="" width={24} height={24} />
            )}
            {share.brand.name}
          </span>
        )}
        <h1>{share.title}</h1>
        {!share.brand?.hideMadeWith && (
          <span className="by">
            Made with <a href="https://titan117.com">Titan117</a>
          </span>
        )}
        <Comments id={id} comments={await loadComments(id)} />
        <ReportButton id={id} />
      </header>
      {/* The artifact runs in an opaque origin: no cookies, no access to this page. */}
      <iframe className="frame" title={share.title ?? "Shared page"} src={`/s/${id}/raw`} sandbox="allow-scripts" referrerPolicy="no-referrer" />
    </>
  );
}

export default function SharedPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<main className="notice"><p>Loading…</p></main>}>
      <Shared params={params} />
    </Suspense>
  );
}
