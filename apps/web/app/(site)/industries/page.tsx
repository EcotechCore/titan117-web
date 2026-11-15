import type { Metadata } from "next";

import { INDUSTRIES } from "@/content/site";
import { Cta, Hero, Icon } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const metadata: Metadata = {
  title: "Industries · Titan117",
  description:
    "Titan117 workflows for retail, restaurants, accounting, law firms, real estate, agencies, trades and wholesale.",
};

export default function IndustriesPage() {
  return (
    <Shell page="industries">
      <Hero
        pill="Eight kinds of small company"
        title={
          <>
            Made for <span className="grad">your industry</span>
          </>
        }
        lead="Ready-made workflows for the work that fills your week, run by agents on your own laptop."
      />
      <section className="section">
        <div className="ind-grid">
          {INDUSTRIES.map((i) => (
            <a key={i.id} className="ind-tile rv" href={`/industries/${i.id}`}>
              <span className="ind-card-ic">
                <Icon name={i.icon} size={22} />
              </span>
              <h3>{i.name}</h3>
              <p>{i.pitch}</p>
              <span className="link-more">
                Explore <Icon name="arrow" />
              </span>
            </a>
          ))}
        </div>
      </section>
      <Cta />
    </Shell>
  );
}
