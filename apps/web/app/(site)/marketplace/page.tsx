/**
 * The marketplace (features 10.3, 10.7; decisions §66.3): add-ons found
 * through the `titan117-addon` GitHub topic. Only the listing comes from us;
 * the code stays on GitHub, and the desktop app downloads it from there,
 * pinned to a commit, with its own checks before anything is installed.
 */
import { api } from "@titan117/backend/api";
import { ADDON_TOPIC, ADDON_TYPES } from "@titan117/shared";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Hero, Icon } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

// The search and the kind come from the address, and the listing changes every hour: rendered on request.
export const instant = false;

export const metadata: Metadata = {
  title: "Marketplace · Titan117",
  description: "Agents, skills, tools and app templates made by the community, installed from GitHub with a check before anything runs.",
};

const TYPE_NAMES: Record<string, string> = {
  agent: "Agents",
  skill: "Skills",
  tool: "Tools",
  "app-template": "App templates",
  "sidebar-app": "Sidebar apps",
};

const LICENCE_OK = /^(MIT|Apache-2\.0|BSD-[23]-Clause|ISC|0BSD|Unlicense)$/i;

/** What the user pastes on the desktop app's Add-ons screen: the repository at the listed commit. */
function installAddress(fullName: string, commit: string) {
  return `${fullName}@${commit.slice(0, 12)}`;
}

async function Listing({ q, type }: { q: string; type: string | null }) {
  await connection();
  let items: Awaited<ReturnType<typeof fetchQuery<typeof api.market.list>>> = [];
  try {
    items = await fetchQuery(api.market.list, { q: q || undefined, type: type ?? undefined });
  } catch {
    items = [];
  }
  if (!items.length)
    return (
      <p className="empty">
        Nothing matches that yet. Made something? Add the <code>{ADDON_TOPIC}</code> topic and a <code>titan.json</code> to
        your repository.
      </p>
    );
  return (
    <div className="lesson-grid">
      {items.map((item) => (
        <article key={item.fullName} className="lesson-card market-card">
          <span className="eyebrow">
            {TYPE_NAMES[item.type] ?? item.type}
            {item.verified ? " · Verified" : ""}
          </span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <p className="market-meta">
            <a href={`https://github.com/${item.owner}/${item.repo}`} rel="noopener noreferrer" target="_blank">
              {item.owner}/{item.repo}
            </a>{" "}
            · v{item.version} · {item.installs} {item.installs === 1 ? "install" : "installs"} ·{" "}
            {item.rating !== null ? `★ ${item.rating} (${item.ratings})` : "not rated yet"} · {item.stars} on GitHub ·{" "}
            <span className={item.license && LICENCE_OK.test(item.license) ? "" : "market-warn"}>
              {item.license ?? "No licence found"}
            </span>
          </p>
          <p className="market-install">
            To install, paste on the Add-ons screen in Titan117: <code>{installAddress(item.fullName, item.commit)}</code>
          </p>
        </article>
      ))}
    </div>
  );
}

export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const type =
    typeof params.type === "string" && (ADDON_TYPES as readonly string[]).includes(params.type) ? params.type : null;
  const href = (t: string | null) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (t) sp.set("type", t);
    const s = sp.toString();
    return s ? `/marketplace?${s}` : "/marketplace";
  };
  return (
    <Shell page="marketplace">
      <Hero
        pill="Marketplace · built on GitHub"
        title={
          <>
            Add-ons from <span className="grad">the community</span>
          </>
        }
        lead="Agents, skills, tools and app templates other companies made. The code stays on GitHub; Titan117 installs it pinned to a commit and shows you what it may do, its licence and a security check before anything runs."
        ctas={null}
      />
      <section className="section">
        <div className="pad">
          <form className="filter-bar" action="/marketplace" method="get">
            <label className="search">
              <Icon name="search" />
              <input type="search" name="q" defaultValue={q} placeholder="Search add-ons" aria-label="Search add-ons" />
              {type ? <input type="hidden" name="type" value={type} /> : null}
            </label>
            <div className="chips" role="group" aria-label="Kinds">
              <a className="chip-link" href={href(null)} aria-current={type === null ? "true" : undefined}>
                All
              </a>
              {ADDON_TYPES.map((t) => (
                <a key={t} className="chip-link" href={href(t)} aria-current={type === t ? "true" : undefined}>
                  {TYPE_NAMES[t]}
                </a>
              ))}
            </div>
          </form>
          <Suspense fallback={<p className="empty">Loading the add-ons…</p>}>
            <Listing q={q} type={type} />
          </Suspense>
          <p className="market-note">
            Anything here is someone else’s code. Before installing, Titan117 shows what it may reach, its licence, known
            vulnerabilities in its dependencies and any keys found in it, and you approve it on your laptop. Verified means we
            read the code at that commit.
          </p>
        </div>
      </section>
    </Shell>
  );
}
