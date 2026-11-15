import type { Metadata } from "next";

import { COMPANY } from "@/content/legal";
import { CompanyLine, LegalPage, Mail } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Terms of Service · Titan117",
  description: "The agreement between you and Ecotechcore for using Titan117.",
};

/**
 * Terms of Service (decisions §33.8). The waiver wording here matches the
 * checkbox at Checkout (convex/billing.ts, TERMS_TEXT): change both together.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lead="The agreement between you and us for using Titan117: the desktop app, the website, your account, plans and credits."
      sections={[
        {
          id: "who",
          title: "Who we are and who these terms are for",
          body: (
            <>
              <p>
                Titan117 is provided by <CompanyLine /> (“we”, “us”). These terms are between us and the person or
                company that creates a Titan117 account (“you”).
              </p>
              <p>
                Titan117 is made for businesses. If you use it for a company, you confirm you may accept these terms on
                its behalf. If you buy as a private individual, the consumer protection laws of your country still
                apply and nothing here takes away a right they give you that can&apos;t be waived.
              </p>
              <p>You must be at least 18 years old to use Titan117.</p>
            </>
          ),
        },
        {
          id: "service",
          title: "What Titan117 is",
          body: (
            <>
              <p>
                Titan117 is a desktop app with a general assistant (Titan) and specialist agents that work on your own
                computer. They read and write files in the folders you allow, use models running on your computer or in
                the cloud, and can use the browser, other apps and services you connect.
              </p>
              <p>
                Your files, documents, memory and chats stay on your computer. Our servers hold only what our{" "}
                <a href="/legal/privacy">privacy policy</a> lists: your account, plan and credits, your signed-in
                devices, the licence we sign, and what you choose to send or share.
              </p>
            </>
          ),
        },
        {
          id: "account",
          title: "Your account and devices",
          body: (
            <>
              <p>
                Keep your sign-in safe; you&apos;re responsible for what happens under your account. Tell us at once at{" "}
                <Mail to="security" /> if you think someone else has used it.
              </p>
              <p>
                Each plan allows a number of signed-in computers (Starter 2, Pro 3, Max 5). You can sign a computer out
                from your account page at any time.
              </p>
            </>
          ),
        },
        {
          id: "plans",
          title: "Plans, the licence and offline use",
          body: (
            <>
              <p>
                Titan117 works only with an active plan; there is no free plan. Plans renew automatically each month or
                year until you cancel. You can cancel at any time from your account page; the plan then runs to the end
                of the period you paid for.
              </p>
              <p>
                While you&apos;re online the app keeps a licence we sign, valid for up to 14 days without a connection.
                When the plan ends, a payment finally fails or the licence runs out offline, the app locks: no agents
                run, running tasks stop at the next step, and your own files stay untouched on your computer. You can
                always export your data from the lock screen.
              </p>
              <p>
                Upgrades take effect at once, prorated for the rest of the period; downgrades take effect at the next
                period. We may change prices for future periods with at least 30 days&apos; notice by email; the change
                applies from your next renewal, and you can cancel before it.
              </p>
            </>
          ),
        },
        {
          id: "credits",
          title: "Credits",
          body: (
            <>
              <p>
                Credits pay for cloud models and web search used through Titan117 (not for local models or anything you
                run with your own API keys). One credit is worth €0.01 (or $0.01) of cloud usage at our price, which is
                the provider&apos;s cost plus 25%; each task shows its estimate before it runs.
              </p>
              <ul>
                <li>Monthly credits come with your plan and can be used for the following month too, up to one month&apos;s allowance; then they expire.</li>
                <li>Top-up credits last 12 months from purchase and can be used while a plan is active.</li>
                <li>Credits are used in this order: this month&apos;s, then last month&apos;s, then top-ups, oldest first.</li>
                <li>
                  Credits have no cash value, can&apos;t be exchanged for money, transferred to another account or used
                  outside Titan117, and end when the account is deleted.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "payments",
          title: "Payments and no refunds",
          body: (
            <>
              <p>
                Payments are handled by Stripe. Prices on our site are before VAT; VAT is added where it applies. A
                business with a valid EU VAT number is charged under the reverse-charge rules.
              </p>
              <p>
                <b>Plans and credits are not refunded</b>, in whole or in part, including for unused time or credits,
                except where we charged you by mistake or Titan117&apos;s online services were unavailable to you for a
                long period through our fault; then we refund or credit what&apos;s fair. Write to <Mail to="support" />.
              </p>
              <p>
                <b>If you buy as a private individual in the EU:</b> you normally have 14 days to withdraw from a
                contract for digital services. At checkout you ask us to start the service at once and confirm that you
                lose this right once it has started, by ticking the box that says so. We confirm this in the email
                receipt for your purchase. If you don&apos;t want to give up the right, don&apos;t complete the
                purchase.
              </p>
              <p>
                If you dispute a payment with your bank instead of contacting us first, we may suspend the account while
                the dispute is open.
              </p>
            </>
          ),
        },
        {
          id: "keys",
          title: "Your own API keys and other services",
          body: (
            <>
              <p>
                You can use your own keys for OpenRouter, Anthropic, OpenAI or Google, and connect your own accounts
                with other services. Those are your accounts: the provider bills you, its own terms apply, and you
                must follow them. Your keys stay on your computer; we never receive them.
              </p>
              <p>We&apos;re not responsible for services we don&apos;t run, or for what they charge you.</p>
            </>
          ),
        },
        {
          id: "use",
          title: "Acceptable use",
          body: (
            <>
              <p>You agree not to use Titan117 to:</p>
              <ul>
                <li>break the law or infringe anyone&apos;s rights, including privacy, intellectual property and consumer law;</li>
                <li>send spam, run scams, impersonate others or mislead people about who they&apos;re dealing with;</li>
                <li>create or spread malware, or attack, probe or overload systems you&apos;re not allowed to;</li>
                <li>bypass CAPTCHAs, bot detection, paywalls or other access controls;</li>
                <li>make content that sexualises minors, or content that the providers of the models you use forbid;</li>
                <li>copy, resell or reverse engineer Titan117 itself, or get around its licence and plan limits.</li>
              </ul>
              <p>
                <b>Automating websites and apps.</b> Titan117 can use a browser and other apps for you on the sites you
                choose. You decide which sites to automate and you&apos;re responsible for following their terms; the app
                warns you where a site&apos;s terms may forbid automation. The agents always stop and ask before
                publishing, sending, launching or paying.
              </p>
            </>
          ),
        },
        {
          id: "output",
          title: "AI output and your responsibility",
          body: (
            <>
              <p>
                Agents use AI models, which make mistakes. Their output (text, code, apps, documents, actions) may be
                wrong, incomplete or unsuitable, and isn&apos;t professional advice (legal, tax, financial, medical or
                otherwise). Check it before you rely on it, and review what an agent asks to do before you approve it.
              </p>
              <p>
                You own what you create with Titan117, as far as the law and the model providers&apos; terms allow. We
                claim no rights in your content.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Shared links and reporting content",
          body: (
            <>
              <p>
                When you share something by link, it&apos;s stored on our servers so others can open it, and you&apos;re
                responsible for it. Anyone can report a shared page they believe is illegal with its Report button or by
                writing to <Mail to="abuse" />. We review reports, may remove content and tell the person who shared it
                why, and they can ask us to look again (EU Digital Services Act).
              </p>
            </>
          ),
        },
        {
          id: "ours",
          title: "Titan117 belongs to us",
          body: (
            <p>
              The app, the website and our brand belong to us or our licensors. Your plan gives you a personal,
              non-transferable licence to use the app for as long as the plan is active. Open-source parts keep their own
              licences, listed in the app.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Liability",
          body: (
            <>
              <p>
                Titan117 is provided as it is. We work to keep it reliable, but we don&apos;t promise it will be free of
                errors or always available, or that it suits a particular purpose.
              </p>
              <p>
                As far as the law allows, we&apos;re not liable for indirect or consequential losses, such as lost profit,
                lost data or business interruption, and our total liability for any claim is limited to what you paid us
                in the 12 months before it. Nothing here limits liability that can&apos;t be limited by law, such as for
                intent or gross negligence, or a consumer&apos;s statutory rights.
              </p>
              <p>
                If you use Titan117 for a business, you&apos;ll cover our reasonable costs from claims by others that
                arise from your content or from breaking these terms.
              </p>
            </>
          ),
        },
        {
          id: "end",
          title: "Suspension and ending the agreement",
          body: (
            <>
              <p>
                You can delete your account at any time from your account page. We may suspend or end an account that
                seriously or repeatedly breaks these terms, or where the law requires; we&apos;ll tell you why unless the
                law or safety prevents it. Your files on your computer are never affected.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: (
            <p>
              We may update these terms. For important changes we&apos;ll email you at least 30 days before they apply;
              if you don&apos;t agree, you can cancel before then. The date at the top shows the latest version.
            </p>
          ),
        },
        {
          id: "law",
          title: "Law and disputes",
          body: (
            <p>
              Romanian law applies, and the courts of Romania decide disputes. If you&apos;re a consumer in the EU, you
              keep the protection of your own country&apos;s mandatory laws and can also go to its courts.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <p>
              Support and questions about these terms: <Mail to="support" />. Security: <Mail to="security" />. Shared
              content reports: <Mail to="abuse" />. Website: {COMPANY.website}.
            </p>
          ),
        },
      ]}
    />
  );
}
