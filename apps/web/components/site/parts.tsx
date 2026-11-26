/**
 * The website's shared parts (homepage-grid/design.md §5), ported from
 * homepage-grid/src/build.py. Server components: plain HTML and CSS, with the
 * behaviour (menus, eyes, filters, reveals) added by /assets/site.js.
 *
 * Links are plain <a> on purpose: every page is a full load, so site.js runs
 * on each one, as it did on the static site.
 */
import type { CSSProperties, ReactNode } from "react";

import { AGENTS, INDUSTRIES, agentBySlug, industryById, trackName, type Agent, type Lesson } from "@/content/site";

/** A CSS custom property on an inline style, typed. */
export const vars = (v: Record<string, string>) => v as CSSProperties;

export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg className="icon" style={size ? { width: `${size}px`, height: `${size}px` } : undefined}>
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function Download() {
  return (
    <a className="btn btn-glow btn-download" href="/pricing">
      <Icon name="download" size={17} />
      Download now
    </a>
  );
}

function DdItem({ href, icon, color, name, sub }: { href: string; icon: string; color: string; name: string; sub: string }) {
  return (
    <a className="dd-item" href={href}>
      <span className="dd-ic" style={vars({ "--c": color })}>
        <Icon name={icon} />
      </span>
      <span>
        <b>{name}</b>
        <small>{sub}</small>
      </span>
    </a>
  );
}

export function Header() {
  const titan = agentBySlug("titan")!;
  return (
    <header className="header">
      <div className="header-inner">
        <a className="logo" href="/" aria-label="TITAN117 home">
          <svg className="bot" data-bot="nav" aria-hidden="true" />
          TITAN117
        </a>
        <nav className="nav" id="nav" aria-label="Main">
          <a href="/#product" data-nav="home">
            Product
          </a>
          <div className="nav-item">
            <a className="nav-trigger" href="/agents" data-nav="agents" aria-haspopup="true">
              Agents
              <Icon name="down" />
            </a>
            <div className="dropdown dd-agents">
              <a className="dd-feature" href="/agents/titan">
                <span className="dd-feature-mark">
                  <svg data-agent-bot="" data-color={titan.color} data-follow="false" aria-hidden="true" />
                </span>
                <b>Titan</b>
                <small>Your general assistant, and the one who runs the team.</small>
                <span className="link-more">
                  Meet Titan <Icon name="arrow" />
                </span>
              </a>
              <div className="dd-grid">
                {AGENTS.filter((a) => a.slug !== "titan").map((a) => (
                  <DdItem key={a.slug} href={`/agents/${a.slug}`} icon={a.icon} color={a.color} name={a.name} sub={a.tag} />
                ))}
              </div>
              <div className="dd-foot">
                <span>Grouped in teams: Operations, Build, Growth</span>
                <a className="link-more" href="/agents">
                  All agents <Icon name="arrow" />
                </a>
              </div>
            </div>
          </div>
          <div className="nav-item">
            <a className="nav-trigger" href="/industries" data-nav="industries" aria-haspopup="true">
              Industries
              <Icon name="down" />
            </a>
            <div className="dropdown dd-industries">
              <div className="dd-grid">
                {INDUSTRIES.map((i) => (
                  <DdItem
                    key={i.id}
                    href={`/industries/${i.id}`}
                    icon={i.icon}
                    color="var(--accent)"
                    name={i.name}
                    sub={i.tag}
                  />
                ))}
              </div>
              <div className="dd-foot">
                <span>Workflows ready for eight kinds of small company</span>
                <a className="link-more" href="/industries">
                  All industries <Icon name="arrow" />
                </a>
              </div>
            </div>
          </div>
          <a href="/marketplace" data-nav="marketplace">
            Marketplace
          </a>
          <a href="/pricing" data-nav="pricing">
            Pricing
          </a>
          <a href="/learn" data-nav="learn">
            Learn
          </a>
          <a href="/faq" data-nav="faq">
            FAQ
          </a>
        </nav>
        <div className="header-actions">
          <button className="icon-btn" id="theme" aria-label="Toggle theme">
            <svg className="icon theme-icon-light">
              <use href="#i-moon" />
            </svg>
            <svg className="icon theme-icon-dark">
              <use href="#i-sun" />
            </svg>
          </button>
          <Download />
          <button className="icon-btn menu-btn" id="menu" aria-label="Open menu" aria-expanded="false" aria-controls="nav">
            <Icon name="menu" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <a className="logo" href="/">
            <svg className="bot" data-bot="foot" aria-hidden="true" />
            TITAN117
          </a>
          <p>A local-first AI team for small companies. Your laptop does the work; you stay in charge.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <a href="/#product">Overview</a>
          <a href="/agents">Agents</a>
          <a href="/pricing">Pricing</a>
          <a href="/marketplace">Marketplace</a>
          <a href="/#trust">Security</a>
        </div>
        <div className="footer-col">
          <h4>Industries</h4>
          {["retail", "accounting", "legal", "agencies"].map((id) => (
            <a key={id} href={`/industries/${id}`}>
              {industryById(id)!.name.split(" and ")[0]}
            </a>
          ))}
          <a href="/industries">All industries</a>
        </div>
        <div className="footer-col">
          <h4>Help</h4>
          <a href="/learn">Learn</a>
          <a href="/faq">FAQ</a>
          <a href="/legal/terms">Terms</a>
          <a href="/legal/privacy">Privacy</a>
          <a href="/legal/cookies">Cookies</a>
        </div>
      </div>
      <div className="wordmark" aria-hidden="true">
        <span>Titan117</span>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Ecotechcore. Titan117 is a product of Ecotechcore.</span>
        <span>Made for small companies, run on your laptop.</span>
      </div>
    </footer>
  );
}

export function Cta({
  title = (
    <>
      Give your company <span className="grad">a team that never sleeps in</span>
    </>
  ),
  lead = "Download Titan117, sign in, and hand over your first task in minutes.",
}: {
  title?: ReactNode;
  lead?: string;
}) {
  return (
    <section className="section">
      <div className="cta">
        <h2 className="h2 rv">{title}</h2>
        <p className="lead rv">{lead}</p>
        <div className="hero-ctas rv">
          <Download />
          <a className="btn btn-dark" href="/learn">
            Learn how it works
          </a>
        </div>
      </div>
    </section>
  );
}

export function Hero({
  pill,
  title,
  lead,
  ctas,
  mark,
  crumbs,
}: {
  pill?: ReactNode;
  title: ReactNode;
  lead: ReactNode;
  /** Defaults to Download and Learn; pass null for none. */
  ctas?: ReactNode | null;
  mark?: ReactNode;
  crumbs?: ReactNode;
}) {
  const buttons =
    ctas === undefined ? (
      <>
        <Download />
        <a className="btn btn-dark" href="/learn">
          Learn how it works
        </a>
      </>
    ) : (
      ctas
    );
  return (
    <section className="section">
      <div className="hero page-hero">
        {mark}
        {crumbs}
        {pill && <div className="pill rv">{pill}</div>}
        <h1 className="h1 rv">{title}</h1>
        <p className="lead rv">{lead}</p>
        {buttons && <div className="hero-ctas rv">{buttons}</div>}
      </div>
    </section>
  );
}

export function SecHead({ title, lead, extra }: { title: ReactNode; lead?: string; extra?: ReactNode }) {
  return (
    <div className="pad" style={{ paddingBottom: "48px" }}>
      <div className="sec-head" style={{ marginBottom: 0 }}>
        <h2 className="h2 rv">{title}</h2>
        {lead && <p className="lead rv">{lead}</p>}
        {extra}
      </div>
    </div>
  );
}

export function Crumbs({ parts }: { parts: [string, string | null][] }) {
  return (
    <nav className="crumbs rv" aria-label="Breadcrumb">
      {parts.map(([text, href], k) => (
        <span key={k}>
          {k > 0 && (
            <>
              {" "}
              <span>/</span>{" "}
            </>
          )}
          {href ? <a href={href}>{text}</a> : text}
        </span>
      ))}
    </nav>
  );
}

/** A one-task app window: the request, the steps, then an approval or the result. */
export function AppDemo({ agent }: { agent: Agent }) {
  const d = agent.demo;
  return (
    <div className="stage">
      <div className="app solo">
        <div className="app-bar">
          <span className="win-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div className="app-tabs">
            <span className="app-tab on">
              <Icon name={agent.icon} />
              {d.title}
            </span>
          </div>
        </div>
        <div className="app-main">
          <div className="app-top">
            <div className="app-title">
              {d.title}
              <small>{agent.name} · started just now</small>
            </div>
          </div>
          <div className="app-prompt">{d.prompt}</div>
          <div className="panel">
            <h5>
              <Icon name={agent.icon} size={13} />
              {agent.name}
            </h5>
            {d.steps.map((s, k) => (
              <div key={k} className="step done" style={{ animationDelay: `${(k * 0.18).toFixed(2)}s` }}>
                <i>✓</i>
                {s}
              </div>
            ))}
            {d.approve ? (
              <>
                <div className="step run" style={{ animationDelay: ".6s" }}>
                  <i>•</i>Waiting for your approval
                </div>
                <div className="approve">
                  <b>{d.approve.title}</b>
                  <p>{d.approve.text}</p>
                  <div className="approve-row">
                    <span>Approve</span>
                    <span>Review</span>
                    <span>Deny</span>
                  </div>
                </div>
              </>
            ) : (
              d.out && (
                <div className="out">
                  <Icon name={d.out.icon} />
                  {d.out.text}
                </div>
              )
            )}
          </div>
          <div className="composer">
            Ask {agent.slug === "titan" ? agent.name : "Titan"} anything…
            <span className="send">
              <Icon name="arrow-up" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** An agent's eyes, drawn by /assets/bot.js. */
export function AgentEyes({ color, follow = false }: { color: string; follow?: boolean }) {
  return <svg data-agent-bot="" data-color={color} {...(follow ? {} : { "data-follow": "false" })} aria-hidden="true" />;
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <a className="agent-card rv" href={`/agents/${agent.slug}`}>
      <span className="ac-mark">
        <AgentEyes color={agent.color} />
      </span>
      <span className="eyebrow">{agent.tag}</span>
      <h3>{agent.name}</h3>
      <p>{agent.lead}</p>
      <span className="link-more">
        Meet {agent.name} <Icon name="arrow" />
      </span>
    </a>
  );
}

export function CapGrid({ items, cols = 3 }: { items: { icon: string; title: string; text: string }[]; cols?: number }) {
  return (
    <div className={`cap-grid cols-${cols}`}>
      {items.map((c) => (
        <div key={c.title} className="cap rv">
          <span className="cap-ic">
            <Icon name={c.icon} />
          </span>
          <h3>{c.title}</h3>
          <p>{c.text}</p>
        </div>
      ))}
    </div>
  );
}

export function StepRow({ items }: { items: { title: string; text: string }[] }) {
  return (
    <div className="step-row">
      {items.map((s, k) => (
        <div key={s.title} className="step-card rv">
          <span className="num">{String(k + 1).padStart(2, "0")}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
        </div>
      ))}
    </div>
  );
}

export function FaqList({ groups }: { groups: { id: string; name: string; items: { q: string; a: string }[] }[] }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.id} className="faq-group" data-group={g.id}>
          <h3>{g.name}</h3>
          <div className="faq-list">
            {g.items.map((it) => (
              <details key={it.q} data-cat={g.id}>
                <summary>
                  {it.q}
                  <Icon name="plus" />
                </summary>
                <p>{it.a}</p>
              </details>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <a className="lesson-card" href={`/learn/${lesson.slug}`} data-cat={lesson.track}>
      <span className="lesson-thumb">
        <Icon name="play" />
        <em>{lesson.minutes} min</em>
      </span>
      <span className="eyebrow">{trackName(lesson.track)}</span>
      <h3>{lesson.title}</h3>
      <p>{lesson.summary}</p>
      <span className="lesson-meta">
        <span>
          <Icon name="video" />
          Video
        </span>
        <span>
          <Icon name="book" />
          {lesson.steps.length} steps
        </span>
        <span>{lesson.level}</span>
      </span>
    </a>
  );
}

export function VideoBand({ src, label = "The video for this guide is coming soon." }: { src: string; label?: string }) {
  return (
    <div className="video-stage">
      <video playsInline preload="none" data-src={src} />
      <button className="video-play" type="button" aria-label="Play the video">
        <Icon name="play" />
      </button>
      <button className="video-close" type="button" aria-label="Close the video">
        <Icon name="x" />
      </button>
      <p className="video-note" role="status">
        {label}
      </p>
    </div>
  );
}

export function ChipLinks({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="chip-links" style={style}>
      {children}
    </div>
  );
}
