import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LESSONS, trackName } from "@/content/site";
import { Crumbs, Cta, Icon, VideoBand } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const generateStaticParams = () => LESSONS.map((l) => ({ slug: l.slug }));
// Every page is listed above and each visit is a full page load, so rendering may block on the URL.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const l = LESSONS.find((x) => x.slug === slug);
  return l ? { title: `${l.title} · Learn Titan117`, description: l.summary } : {};
}

export default async function LessonPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const k = LESSONS.findIndex((x) => x.slug === slug);
  if (k < 0) notFound();
  const l = LESSONS[k];
  const prev = LESSONS[k - 1];
  const next = LESSONS[k + 1];
  return (
    <Shell page="learn">
      <section className="section">
        <div className="lesson-head pad">
          <Crumbs
            parts={[
              ["Learn", "/learn"],
              [trackName(l.track), "/learn"],
              [l.title, null],
            ]}
          />
          <h1 className="h2 rv">{l.title}</h1>
          <p className="lead rv">{l.summary}</p>
          <div className="lesson-meta rv">
            <span>
              <Icon name="time" />
              {l.minutes} min
            </span>
            <span>
              <Icon name="video" />
              Video
            </span>
            <span>
              <Icon name="book" />
              {l.steps.length} steps
            </span>
            <span>{l.level}</span>
          </div>
        </div>
        <VideoBand src={`/assets/learn/${l.slug}.mp4`} />
      </section>
      <section className="section">
        <div className="lesson">
          <div className="lesson-body pad">
            <h2 className="h3">Step by step</h2>
            <ol className="lesson-steps">
              {l.steps.map((s, n) => (
                <li key={s.title} className="rv">
                  <span className="num">{n + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="tips rv">
              <b>Good to know</b>
              <ul>
                {l.tips.map((t) => (
                  <li key={t}>
                    <Icon name="sparkles" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="pager">
              {prev ? (
                <a className="pager-link" href={`/learn/${prev.slug}`}>
                  <Icon name="left" />
                  <span>
                    <small>Previous</small>
                    {prev.title}
                  </span>
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a className="pager-link next" href={`/learn/${next.slug}`}>
                  <span>
                    <small>Next</small>
                    {next.title}
                  </span>
                  <Icon name="right" />
                </a>
              )}
            </div>
          </div>
          <aside className="lesson-side pad">
            <span className="eyebrow">{trackName(l.track)}</span>
            <div className="side-list">
              {LESSONS.filter((x) => x.track === l.track).map((x) => (
                <a key={x.slug} href={`/learn/${x.slug}`} aria-current={x.slug === l.slug ? "page" : undefined}>
                  <Icon name="play" />
                  <span>
                    {x.title}
                    <small>{x.minutes} min</small>
                  </span>
                </a>
              ))}
            </div>
            <a className="link-more" href="/learn" style={{ marginTop: "20px" }}>
              All guides <Icon name="arrow" />
            </a>
          </aside>
        </div>
      </section>
      <Cta />
    </Shell>
  );
}
