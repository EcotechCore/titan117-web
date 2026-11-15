import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { INDUSTRIES, agentBySlug, industryById } from "@/content/site";
import { AgentCard, CapGrid, ChipLinks, Crumbs, Cta, Hero, Icon, SecHead, vars } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const generateStaticParams = () => INDUSTRIES.map((i) => ({ id: i.id }));
// Every page is listed above and each visit is a full page load, so rendering may block on the URL.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/industries/[id]">): Promise<Metadata> {
  const i = industryById((await params).id);
  return i ? { title: `${i.name} · Titan117`, description: i.pitch } : {};
}

export default async function IndustryPage({ params }: PageProps<"/industries/[id]">) {
  const i = industryById((await params).id);
  if (!i) notFound();
  return (
    <Shell page="industries">
      <Hero
        mark={
          <span className="ind-card-ic hero-ind rv">
            <Icon name={i.icon} size={30} />
          </span>
        }
        crumbs={
          <Crumbs
            parts={[
              ["Industries", "/industries"],
              [i.name, null],
            ]}
          />
        }
        pill={
          <>
            Workflows · <b>{i.tag}</b>
          </>
        }
        title={
          <>
            {i.name}, <br />
            <span className="grad">handled</span>
          </>
        }
        lead={i.pitch}
      />
      <section className="section">
        <div className="ind-slide" style={{ borderTop: 0 }}>
          <div className="ind-vis">
            <div className="ind-card">
              <div className="ind-card-top">
                <span className="ind-card-ic">
                  <Icon name={i.icon} size={22} />
                </span>
                <div>
                  <b>{i.name}</b>
                  <small>Example workflow</small>
                </div>
              </div>
              <div className="ind-flow">
                {i.flow.map((f, k) => (
                  <div key={k} style={{ animationDelay: `${(k * 0.2).toFixed(1)}s` }}>
                    <span>{k + 1}</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="ind-text">
            <span className="eyebrow">You ask</span>
            <p className="ind-quote">“{i.ask}”</p>
            <p>
              Titan plans it, the agents below do the work on your laptop, and anything that leaves it waits for your
              OK.
            </p>
          </div>
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              What Titan <span className="grad">takes off your plate</span>
            </>
          }
        />
        <div className="cap-grid cols-2">
          {i.uses.map((u) => {
            const a = agentBySlug(u.agent)!;
            return (
              <a key={u.title} className="cap rv" href={`/agents/${a.slug}`}>
                <span className="cap-ic">
                  <Icon name={a.icon} />
                </span>
                <h3>{u.title}</h3>
                <p>{u.text}</p>
                <span className="cap-agent">
                  <span className="dot" style={vars({ background: a.color })} />
                  {a.name}
                </span>
              </a>
            );
          })}
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              The agents <span className="grad">on the job</span>
            </>
          }
        />
        <div className="card-row">
          {i.agents.map((slug) => (
            <AgentCard key={slug} agent={agentBySlug(slug)!} />
          ))}
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              Your files <span className="grad">stay yours</span>
            </>
          }
        />
        <CapGrid
          items={[
            { icon: "lock", title: "On your laptop", text: "Documents, memory and app data stay in a local database." },
            { icon: "shield", title: "Asks first", text: "Sending, publishing and deleting always wait for your approval." },
            {
              icon: "cpu",
              title: "Local models only",
              text: "Mark confidential folders so nothing in them reaches a cloud model.",
            },
          ]}
        />
      </section>
      <section className="section">
        <div className="pad">
          <span className="eyebrow">Other industries</span>
          <ChipLinks style={{ marginTop: "16px" }}>
            {INDUSTRIES.filter((o) => o.id !== i.id).map((o) => (
              <a key={o.id} href={`/industries/${o.id}`}>
                <Icon name={o.icon} />
                {o.name}
              </a>
            ))}
          </ChipLinks>
        </div>
      </section>
      <Cta />
    </Shell>
  );
}
