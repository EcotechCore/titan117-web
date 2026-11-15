import type { Metadata } from "next";

import { COMPANY, DELETION_GRACE_DAYS } from "@/content/legal";
import { CompanyLine, LegalPage, Mail } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Titan117",
  description: "What Titan117 keeps on your computer, the little our servers hold, who processes it, and your rights.",
};

/** Privacy policy (GDPR), written from decisions §32's closed list of what our cloud may hold. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lead="Titan117 is local-first: your files, documents, memory and chats stay on your computer. This page says what little our servers hold, why, who helps us run them, and your rights."
      sections={[
        {
          id: "controller",
          title: "Who is responsible",
          body: (
            <p>
              The controller of the personal data described here is <CompanyLine />. Contact for anything about your
              data: <Mail to="privacy" />.
            </p>
          ),
        },
        {
          id: "local",
          title: "What stays on your computer",
          body: (
            <>
              <p>
                The Titan117 app keeps on your computer, and never sends to our servers: your files and documents, the
                agents&apos; memory, your chats and tasks, recordings and browsing, the apps you build and their data,
                and every password, API key and token you add (in your operating system&apos;s keychain).
              </p>
              <p>
                When you use a cloud model, what the task needs is sent to that model&apos;s provider: through our
                credits service if you pay with credits, or straight from your computer if you use your own key. Local
                models send nothing anywhere.
              </p>
            </>
          ),
        },
        {
          id: "held",
          title: "What our servers hold",
          body: (
            <ul>
              <li>
                <b>Your account:</b> your email address, name and sign-in details, held by Clerk (we never see your
                password), and an internal account id.
              </li>
              <li>
                <b>Plan and credits:</b> your plan and its renewal dates, your credits and their history, and for each
                cloud call made with credits the model, the time and what it cost. Never the prompt or the answer.
              </li>
              <li>
                <b>Payments:</b> handled by Stripe, which holds your card and billing details and invoices; we keep the
                link between your account and your Stripe customer.
              </li>
              <li>
                <b>Devices:</b> the name and app version of each computer you sign in on, when it signed in and was last
                seen, and a fingerprint (hash) of its sign-in token, never the token itself.
              </li>
              <li>
                <b>The licence we sign</b> for each device, saying which plan it has and until when.
              </li>
              <li>
                <b>What you choose to send or share:</b> error reports you review and send, and anything you share by
                link, which the people you share it with can read.
              </li>
              <li>
                <b>Security records:</b> limited server logs and records of staff access, kept to protect the service.
              </li>
            </ul>
          ),
        },
        {
          id: "credits-calls",
          title: "Cloud calls paid with credits",
          body: (
            <p>
              When you pay with credits, the request passes through our server on its way to OpenRouter, which sends it
              to the model&apos;s provider. Our server doesn&apos;t store or log the prompt or the answer; it records
              only the model, time and cost. OpenRouter and the model provider process the request under their own
              policies. For confidential work, use a local model or mark the folder local-only.
            </p>
          ),
        },
        {
          id: "why",
          title: "Why we use it (legal bases)",
          body: (
            <ul>
              <li>
                <b>To provide the service you signed up for</b> (contract): your account, plan, credits, devices and
                licence, payments, and cloud calls you ask for.
              </li>
              <li>
                <b>To meet legal obligations:</b> invoices and accounting records, tax, and requests from authorities
                that the law requires us to answer.
              </li>
              <li>
                <b>Our legitimate interests:</b> keeping the service secure, preventing fraud and abuse, and fixing
                faults from error reports you send.
              </li>
              <li>
                <b>Your consent,</b> where we ask for it, such as for optional emails. You can withdraw it at any time.
              </li>
            </ul>
          ),
        },
        {
          id: "processors",
          title: "Who helps us run it",
          body: (
            <>
              <p>These companies process data for us under data processing agreements:</p>
              <ul>
                <li>
                  <b>Clerk</b> (accounts and sign-in), <b>Convex</b> (our database), <b>Vercel</b> (hosting of the website
                  and the credits service), <b>Stripe</b> (payments and tax) and <b>OpenRouter</b> (cloud models paid with
                  credits).
                </li>
              </ul>
              <p>
                Some of them are in the United States. Where data leaves the European Economic Area, it&apos;s protected
                by the EU-U.S. Data Privacy Framework where the company is certified, or by the European Commission&apos;s
                standard contractual clauses.
              </p>
              <p>We don&apos;t sell personal data, and we don&apos;t use it for advertising.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <ul>
              <li>
                Account, plan, credits and devices: while your account exists. When you delete your account, it&apos;s
                removed {DELETION_GRACE_DAYS} days later (you can cancel the deletion until then), from our database,
                Clerk and Stripe.
              </li>
              <li>Invoices and payment records: as long as Romanian tax and accounting law requires, held by Stripe.</li>
              <li>Records of cloud calls: up to 90 days in detail; the charge stays in your credit history.</li>
              <li>Error reports: 90 days, or at once when you delete your account.</li>
              <li>Shared links: until you delete them or your account.</li>
            </ul>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>
                You can ask to see, correct, delete or take a copy of your personal data, to restrict or object to how we
                use it, and to withdraw consent. Most of it you can manage yourself: your account page shows your plan,
                credits and devices, and lets you delete your account; the app&apos;s lock screen and settings let you
                export your data. For anything else, write to <Mail to="privacy" />; we answer within one month.
              </p>
              <p>
                You can also complain to a data protection authority, in Romania the{" "}
                <a href={COMPANY.authority.url}>{COMPANY.authority.name}</a>, or where you live or work.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              We use only cookies that are needed for signing in and for the website to work. See the{" "}
              <a href="/legal/cookies">cookie policy</a>.
            </p>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: <p>Titan117 is for people aged 18 and over. We don&apos;t knowingly hold data about children.</p>,
        },
        {
          id: "security",
          title: "Security",
          body: (
            <p>
              Data is encrypted in transit, secrets stay in your computer&apos;s keychain, staff access is limited and
              recorded, and remote control is off until you turn it on with two-factor sign-in. Report a security issue
              to <Mail to="security" />.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes",
          body: (
            <p>
              We&apos;ll update this page when what we do changes, and email you about important changes before they
              apply.
            </p>
          ),
        },
      ]}
    />
  );
}
