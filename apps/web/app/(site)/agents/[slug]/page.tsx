import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AGENTS, agentBySlug, industryById } from "@/content/site";
import { AgentEyes, AppDemo, CapGrid, ChipLinks, Cta, Hero, Icon, SecHead, StepRow, vars } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const generateStaticParams = () => AGENTS.map((a) => ({ slug: a.slug }));
// Every page is listed above and each visit is a full page load, so rendering may block on the URL.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/agents/[slug]">): Promise<Metadata> {
  const agent = agentBySlug((await params).slug);
  return agent ? { title: `${agent.name} · Titan117 agents`, description: agent.lead } : {};
}

export default async function AgentPage({ params }: PageProps<"/agents/[slug]">) {
  const a = agentBySlug((await params).slug);
  if (!a) notFound();
  return (
    <Shell page="agents">
      <Hero
        mark={
          <span className="ac-mark hero-mark rv">
            <AgentEyes color={a.color} follow />
          </span>
        }
        title={
          <>
            {a.name}, <br />
            <span className="grad">{a.headline}</span>
          </>
        }
        lead={a.lead}
      />
      <section className="section">
        <AppDemo agent={a} />
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              What it <span className="grad">does</span>
            </>
          }
        />
        <CapGrid items={a.caps} />
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              How it <span className="grad">works</span>
            </>
          }
        />
        <StepRow items={a.steps} />
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              Try <span className="grad">asking</span>
            </>
          }
          lead="A few things to hand over on day one."
        />
        <div className="prompt-grid">
          {a.prompts.map((p) => (
            <div key={p} className="prompt rv">
              <span>
                <Icon name="chat" />
              </span>
              {p}
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="spec-wrap">
          <div className="pad">
            <h2 className="h2 rv">
              What it <span className="grad">needs</span>
            </h2>
            <dl className="spec">
              {a.needs.map((n) => (
                <div key={n.label} className="rv">
                  <dt>{n.label}</dt>
                  <dd>{n.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="pad spec-side">
            <span className="eyebrow">Works well with</span>
            <ChipLinks>
              {a.pairs.map((slug) => {
                const p = agentBySlug(slug)!;
                return (
                  <a key={slug} href={`/agents/${slug}`}>
                    <span className="dot" style={vars({ background: p.color })} />
                    {p.name}
                  </a>
                );
              })}
            </ChipLinks>
            <span className="eyebrow" style={{ marginTop: "28px" }}>
              Used in
            </span>
            <ChipLinks>
              {a.industries.map((id) => {
                const i = industryById(id)!;
                return (
                  <a key={id} href={`/industries/${id}`}>
                    <Icon name={i.icon} />
                    {i.name}
                  </a>
                );
              })}
            </ChipLinks>
          </div>
        </div>
      </section>
      <Cta
        title={
          <>
            Put {a.name} <span className="grad">to work</span>
          </>
        }
        lead="Every agent is included in every plan. Download Titan117 and hand over your first task."
      />
    </Shell>
  );
}
