import type { Metadata } from "next";

import { AGENTS, TEAMS, agentBySlug } from "@/content/site";
import { AgentCard, AgentEyes, Cta, Hero, Icon } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const metadata: Metadata = {
  title: "Agents · Titan117",
  description: "Titan and nine specialist agents, grouped in teams: Operations, Build and Growth.",
};

export default function AgentsPage() {
  const titan = agentBySlug("titan")!;
  return (
    <Shell page="agents">
      <Hero
        pill="Ten agents · three teams"
        title={
          <>
            Meet <span className="grad">the agents</span>
          </>
        }
        lead="Titan runs the team and hands each part of a job to the specialist that does it best. They share one memory, and every one of them asks before anything leaves your laptop."
      />
      <section className="section agents-band">
        <div className="pad titan-feature">
          <span className="ac-mark big">
            <AgentEyes color={titan.color} follow />
          </span>
          <div>
            <span className="eyebrow">{titan.tag}</span>
            <h2 className="h2">
              Titan, <span className="grad">{titan.headline}</span>
            </h2>
            <p className="lead">{titan.lead}</p>
            <a className="btn btn-glow" href="/agents/titan" style={{ marginTop: "24px" }}>
              Meet Titan <Icon name="arrow" size={16} />
            </a>
          </div>
        </div>
      </section>
      {TEAMS.map((team) => (
        <section key={team.id} className="section" id={team.id}>
          <div className="team-head pad">
            <div>
              <span className="eyebrow">Team</span>
              <h2 className="h2 rv">{team.name}</h2>
            </div>
            <p className="lead rv">{team.lead}</p>
          </div>
          <div className="card-row">
            {AGENTS.filter((a) => a.team === team.id).map((a) => (
              <AgentCard key={a.slug} agent={a} />
            ))}
          </div>
        </section>
      ))}
      <Cta />
    </Shell>
  );
}
