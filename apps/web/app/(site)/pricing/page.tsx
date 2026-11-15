import type { Metadata } from "next";

import { FAQ_GROUPS } from "@/content/site";
import { CapGrid, Cta, FaqList, Hero, Icon, SecHead } from "@/components/site/parts";
import { Shell } from "@/components/site/Shell";

export const metadata: Metadata = {
  title: "Pricing · Titan117",
  description:
    "Titan117 plans from €15 a month: every agent included, local models free and unlimited, credits for cloud models.",
};

const yes = <Icon name="check" />;
const COMPARE: [string, ...React.ReactNode[]][] = [
  ["Price a month", "€15", "€25", "€50", "Talk to us"],
  ["Price a year", "€150", "€250", "€500", "Custom"],
  ["Credits a month", "700", "1,500", "3,500", "Custom pool"],
  ["Local models, previews, tests", "Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  ["All agents and the app builder", yes, yes, yes, yes],
  ["Your own keys and top-ups", yes, yes, yes, yes],
  ["Remote control and chat channels", yes, yes, yes, yes],
  ["Devices", "2", "3", "5", "Custom"],
  ["Teams, roles, audit log, SSO", "—", "—", "—", yes],
  ["Agency and white-label", "—", "—", "—", yes],
  ["Support", "Email", "Email", "Priority", "Dedicated"],
];

export default function PricingPage() {
  return (
    <Shell page="pricing">
      <Hero
        pill={
          <>
            Pricing · <b>No free plan, no surprises</b>
          </>
        }
        title={
          <>
            Simple pricing, <span className="grad">local is free</span>
          </>
        }
        lead="Every plan has every agent. Credits pay only for cloud models; local models, previews, tests and your own keys never cost a credit."
        ctas={null}
      />
      <section className="section" id="pricing">
        <div className="pad" style={{ paddingBottom: "40px" }}>
          <div className="billing" role="group" aria-label="Billing period">
            <button aria-pressed="true" data-bill="m">
              Monthly
            </button>
            <button aria-pressed="false" data-bill="y">
              Yearly<em>2 months free</em>
            </button>
          </div>
        </div>
        {/* Filled by site.js from its plan list. */}
        <div className="pricing">
          <div className="plans" role="radiogroup" aria-label="Plans" id="plans" />
          <div className="includes" id="includes" />
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              Always <span className="grad">free</span>
            </>
          }
          lead="Included in every plan, without using a credit."
        />
        <CapGrid
          items={[
            { icon: "cpu", title: "Local models", text: "Built in with llama.cpp. Unlimited, private, offline." },
            { icon: "eye", title: "Previews", text: "Apps run and preview on your laptop." },
            { icon: "bug", title: "Tests", text: "Browsers, emulators and virtual machines on your laptop." },
            { icon: "file", title: "Documents", text: "Reading, OCR and local search of your folders." },
            {
              icon: "key",
              title: "Your own keys",
              text: "Anything you run on your own OpenRouter, Anthropic, OpenAI or Google key.",
            },
            { icon: "record", title: "Replays", text: "Recorded automations replay without a model." },
          ]}
        />
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              What a credit <span className="grad">buys</span>
            </>
          }
          lead="1 credit = €0.01 of cloud usage at our price: the provider's cost plus 25%. These are estimates for one typical app-builder edit."
        />
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="table-wrap rv">
            <table className="table">
              <thead>
                <tr>
                  <th>Model used</th>
                  <th>Credits per edit</th>
                  <th>Edits from Pro&apos;s 1,500 credits</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cheap open coder (DeepSeek, Qwen Coder)</td>
                  <td>about 2</td>
                  <td>
                    <b>about 750</b>
                  </td>
                </tr>
                <tr>
                  <td>Strongest models</td>
                  <td>about 17</td>
                  <td>
                    <b>about 90</b>
                  </td>
                </tr>
                <tr>
                  <td>Local model</td>
                  <td>0</td>
                  <td>
                    <b>unlimited</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note rv">
            Smart routing plans with a strong model and does bulk edits with cheaper or local ones, so most tasks land
            near the top row. Every task shows its estimate first and can be capped.
          </p>
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              Top-ups <span className="grad">when you need more</span>
            </>
          }
          lead="Top-up credits last 12 months while a paid plan is active."
        />
        <div className="topups">
          {[
            ["1,000 credits", "€10", "€0.010 per credit"],
            ["2,750 credits", "€25", "€0.009 per credit"],
            ["6,000 credits", "€50", "€0.0083 per credit"],
          ].map(([credits, price, per]) => (
            <div key={credits} className="topup rv">
              <span className="eyebrow">{credits}</span>
              <b>{price}</b>
              <small>{per}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <SecHead
          title={
            <>
              Compare <span className="grad">plans</span>
            </>
          }
        />
        <div className="pad" style={{ paddingTop: 0 }}>
          <div className="table-wrap rv">
            <table className="table compare">
              <thead>
                <tr>
                  <th />
                  <th>Starter</th>
                  <th>Pro</th>
                  <th>Max</th>
                  <th>Custom</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([label, ...cells]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {cells.map((c, k) => (
                      <td key={k}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note rv">
            Prices are before VAT and the same in euro and US dollar. Monthly credits roll over for one month. Upgrades
            start at once, prorated; downgrades at the next period. Plans and top-ups aren&apos;t refunded (see the{" "}
            <a className="text-link" href="/legal/terms#payments">
              terms
            </a>
            ).
          </p>
        </div>
      </section>
      <section className="section">
        <div className="pad">
          <div className="faq">
            <div className="sec-head" style={{ marginBottom: 0, alignContent: "start" }}>
              <h2 className="h2 rv">Pricing questions</h2>
              <p className="lead rv">
                More in the{" "}
                <a className="text-link" href="/faq">
                  full FAQ
                </a>
                .
              </p>
            </div>
            <div>
              <FaqList groups={FAQ_GROUPS.filter((g) => g.id === "models" || g.id === "pricing")} />
            </div>
          </div>
        </div>
      </section>
      <Cta />
    </Shell>
  );
}
