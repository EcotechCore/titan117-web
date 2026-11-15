import type { Metadata } from "next";

import { LEARN_TRACKS, LESSONS } from "@/content/site";
import { Cta, Hero, Icon, LessonCard, VideoBand } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const metadata: Metadata = {
  title: "Learn · Titan117",
  description:
    "Guides and videos for Titan117: install, models, your first task, approvals, memory, agents, automations and remote control.",
};

export default function LearnPage() {
  return (
    <Shell page="learn">
      <Hero
        pill={
          <>
            Learn · <b>Guides and videos</b>
          </>
        }
        title={
          <>
            Learn <span className="grad">Titan117</span>
          </>
        }
        lead="Short guides with step-by-step instructions and a video for each, from your first task to building apps and automations."
        ctas={null}
      />
      <section className="section">
        <div className="with-head" style={{ paddingBottom: "40px" }}>
          <span className="eyebrow">Start here</span>
          <h2 className="h2 rv" style={{ marginTop: "12px" }}>
            A tour of <span className="grad">the whole app</span>
          </h2>
          <p className="lead rv" style={{ marginTop: "16px" }}>
            Ten minutes: install, models, your first task, approvals, and where every agent lives.
          </p>
        </div>
        <VideoBand src="/assets/learn/tour.mp4" label="The tour video is coming soon." />
      </section>
      <section className="section" data-filter-scope="">
        <div className="pad">
          <div className="filter-bar">
            <label className="search">
              <Icon name="search" />
              <input type="search" placeholder="Search the guides" data-search="" aria-label="Search the guides" />
            </label>
            <div className="chips" role="group" aria-label="Topics">
              <button data-filter="all" aria-pressed="true">
                All
              </button>
              {LEARN_TRACKS.map((t) => (
                <button key={t.id} data-filter={t.id} aria-pressed="false">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lesson-grid">
          {LESSONS.map((l) => (
            <LessonCard key={l.slug} lesson={l} />
          ))}
        </div>
        <p className="empty pad" data-empty="" hidden>
          No guide matches that yet. Try another word, or <a href="/faq">check the FAQ</a>.
        </p>
      </section>
      <Cta
        title={
          <>
            Ready to <span className="grad">try it</span>?
          </>
        }
        lead="Download Titan117 and follow along with the first guide."
      />
    </Shell>
  );
}
