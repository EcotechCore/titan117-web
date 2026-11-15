import type { Metadata } from "next";

import { FAQ_GROUPS } from "@/content/site";
import { Cta, FaqList, Hero, Icon } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const metadata: Metadata = {
  title: "FAQ · Titan117",
  description: "Answers about Titan117: privacy, models, credits, plans, setup and remote control.",
};

export default function FaqPage() {
  return (
    <Shell page="faq">
      <Hero
        pill="Help · FAQ"
        title={
          <>
            Questions, <span className="grad">answered</span>
          </>
        }
        lead="Everything small companies ask us about Titan117: privacy, models, credits, plans and setup."
        ctas={null}
      />
      {/* Search and topic chips are wired by site.js. */}
      <section className="section" data-filter-scope="">
        <div className="pad">
          <div className="filter-bar">
            <label className="search">
              <Icon name="search" />
              <input type="search" placeholder="Search the questions" data-search="" aria-label="Search the questions" />
            </label>
            <div className="chips" role="group" aria-label="Topics">
              <button data-filter="all" aria-pressed="true">
                All
              </button>
              {FAQ_GROUPS.map((g) => (
                <button key={g.id} data-filter={g.id} aria-pressed="false">
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="faq-groups">
            <FaqList groups={FAQ_GROUPS} />
          </div>
          <p className="empty" data-empty="" hidden>
            No question matches that. Try another word, or <a href="/learn">browse the guides</a>.
          </p>
        </div>
      </section>
      <Cta
        title={
          <>
            Still unsure? <span className="grad">Try it</span>
          </>
        }
        lead="Every plan includes every agent and unlimited local models."
      />
    </Shell>
  );
}
