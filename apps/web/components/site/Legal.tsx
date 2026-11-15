/**
 * The frame for a legal page: a plain reading column inside the site's frame,
 * with a table of contents and the "draft" note until our lawyer has reviewed
 * it (decisions §33.8).
 */
import type { ReactNode } from "react";

import { COMPANY, LEGAL_UPDATED } from "@/content/legal";
import { Shell } from "./Shell";

/** A company fact that isn't filled in yet shows as a marked gap, never as something invented. */
export function Fact({ value, label }: { value: string | null; label: string }) {
  return value ? <>{value}</> : <mark className="legal-gap">[{label}: to be added]</mark>;
}

export function CompanyLine() {
  return (
    <>
      <Fact value={COMPANY.legalName} label="registered company name" /> (trading as {COMPANY.name}), registered in{" "}
      {COMPANY.country} under number <Fact value={COMPANY.registrationNumber} label="registration number" />, VAT number{" "}
      <Fact value={COMPANY.vatNumber} label="VAT number" />, with its registered office at{" "}
      <Fact value={COMPANY.address} label="registered address" />
    </>
  );
}

export function Mail({ to }: { to: keyof typeof COMPANY.emails }) {
  return <a href={`mailto:${COMPANY.emails[to]}`}>{COMPANY.emails[to]}</a>;
}

export function LegalPage({
  title,
  lead,
  sections,
}: {
  title: string;
  lead: string;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <Shell page="legal">
      <section className="section">
        <div className="legal pad">
          <p className="eyebrow">Legal · updated {LEGAL_UPDATED}</p>
          <h1 className="h2">{title}</h1>
          <p className="lead">{lead}</p>
          <p className="legal-draft" role="note">
            Draft: this page is complete but has not yet had its review by our lawyer, which happens before Titan117
            launches. Questions until then: <Mail to="support" />.
          </p>
          <nav className="legal-toc" aria-label="On this page">
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s, k) => (
            <section key={s.id} id={s.id} className="legal-section">
              <h2>
                {k + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </div>
      </section>
    </Shell>
  );
}
