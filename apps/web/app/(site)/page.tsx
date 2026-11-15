/**
 * The home page (homepage-grid/index.html, hand-written there). Its moving parts
 * (tabs, the agents board, industries, pricing, counters) are driven by
 * /assets/home.js, which reads the elements and ids below.
 */
import { Shell } from "@/components/site/Shell";

export default function Home() {
  return (
    <Shell page="home" home>
      <section className="section">
        <div className="hero">
          <a className="pill rv" href="#product">
            {"Local-first · "}
            <b>{"Windows & macOS"}</b>{" "}
            <span className="pill-arrow">
              <svg className="icon" style={{ width: "13px", height: "13px" } as React.CSSProperties}>
                <use href="#i-arrow" />
              </svg>
            </span>
          </a>
          <h1 className="h1 rv">
            Your AI team,
            <br />
            <span className="grad">on your own laptop</span>
          </h1>
          <p className="lead rv">
            Titan117 is a general assistant and nine specialist agents for small companies. They build apps, read your
            documents, test your site, market your business and watch the web. Your data stays on your machine, and
            nothing goes out without your OK.
          </p>
          <div className="hero-ctas rv">
            <a className="btn btn-glow btn-download" href="#pricing">
              <svg className="icon" style={{ width: "17px", height: "17px" } as React.CSSProperties}>
                <use href="#i-download" />
              </svg>
              Download now
            </a>
            <a className="btn btn-dark" href="#how">
              See how it works
            </a>
          </div>
          <p className="hero-note rv">
            For Windows and macOS · Local models free and unlimited · Any model on OpenRouter, with credits or your own
            key
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="What Titan117 does" id="product">
          <button className="tab" role="tab" aria-selected="true" data-tab="0">
            <svg className="icon">
              <use href="#i-sparkles" />
            </svg>
            Titan assistant
          </button>
          <button className="tab" role="tab" aria-selected="false" data-tab="1">
            <svg className="icon">
              <use href="#i-code" />
            </svg>
            App builder
          </button>
          <button className="tab" role="tab" aria-selected="false" data-tab="2">
            <svg className="icon">
              <use href="#i-folder" />
            </svg>
            Documents
          </button>
          <button className="tab" role="tab" aria-selected="false" data-tab="3">
            <svg className="icon">
              <use href="#i-clock" />
            </svg>
            Automation
          </button>
          <button className="tab" role="tab" aria-selected="false" data-tab="4">
            <svg className="icon">
              <use href="#i-megaphone" />
            </svg>
            Marketing
          </button>
          <button className="tab" role="tab" aria-selected="false" data-tab="5">
            <svg className="icon">
              <use href="#i-terminal" />
            </svg>
            {"Code & QA"}
          </button>
        </div>
        <div className="stage">
          <div className="app" aria-live="polite">
            <div className="app-bar">
              <span className="win-dots" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
              <div className="app-tabs">
                <span className="app-tab on" id="app-tab"></span>
                <span className="app-tab">
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </span>
              </div>
              <div className="app-bar-right">
                <span className="bar-btn" title="Memory">
                  <svg className="icon">
                    <use href="#i-brain" />
                  </svg>
                </span>
                <span className="bar-btn" title="Approvals">
                  <svg className="icon">
                    <use href="#i-shield" />
                  </svg>
                  <b id="app-approvals">1</b>
                </span>
                <span className="bar-btn" title="Apps">
                  <svg className="icon">
                    <use href="#i-layers" />
                  </svg>
                </span>
              </div>
            </div>
            <aside className="app-side">
              <div className="ws">
                <span className="ws-ic">AN</span>
                <span className="ws-name">
                  Atelier Nord<small>Pro · 3 devices</small>
                </span>
                <svg className="icon">
                  <use href="#i-updown" />
                </svg>
              </div>
              <div className="app-search">
                <svg className="icon">
                  <use href="#i-search" />
                </svg>
                Search<kbd>Ctrl K</kbd>
              </div>
              <div id="app-agents"></div>
              <div className="app-label">AUTOMATIONS</div>
              <div className="auto">
                <svg className="icon">
                  <use href="#i-record" />
                </svg>
                Stock export<small>Mon 08:00</small>
              </div>
              <div className="auto">
                <svg className="icon">
                  <use href="#i-eye" />
                </svg>
                Law watch<small>Daily 07:00</small>
              </div>
              <div className="auto">
                <svg className="icon">
                  <use href="#i-chart" />
                </svg>
                SEO re-audit<small>Fri 18:00</small>
              </div>
            </aside>
            <div className="app-main" id="app-main"></div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="with-head">
          <h2 className="h2 rv">
            {"What Titan does "}
            <span className="grad">on day one</span>
          </h2>
          <p className="lead rv" style={{ marginTop: "16px" } as React.CSSProperties}>
            Ten jobs you can hand over the day you install it. Hover a tile to see which agent takes it, and what it
            costs.
          </p>
        </div>
        <div className="logos">
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-folder" />
            </svg>
            Sort my Downloads
            <span className="tag">
              <b>Titan</b>Files into folders, renamed and deduplicated · free on a local model
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-file" />
            </svg>
            Invoices to Excel
            <span className="tag">
              <b>Titan</b>Reads every PDF and builds the sheet, sent to you on Telegram
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-search" />
            </svg>
            Ask my contracts
            <span className="tag">
              <b>Folder agent</b>Answers with the file, page and passage · never leaves the laptop
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-video" />
            </svg>
            Site to promo video
            <span className="tag">
              <b>Promo video</b>Script, voiceover and your brand colours, read from your website
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-bug" />
            </svg>
            Test my website
            <span className="tag">
              <b>QA and tests</b>Chromium, Firefox and WebKit, with tests that then run without AI
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-chart" />
            </svg>
            Fix my SEO
            <span className="tag">
              <b>SEO agent</b>Audit, fixes and real Search Console data, re-checked every week
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-megaphone" />
            </svg>
            A month of posts
            <span className="tag">
              <b>Marketing</b>Posts for LinkedIn, Instagram and Facebook from your brand kit, ready to post in a click
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-code" />
            </svg>
            Build a booking app
            <span className="tag">
              <b>App builder</b>Web, mobile or desktop, previewed on your laptop for free
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-record" />
            </svg>
            Weekly export
            <span className="tag">
              <b>Recorder</b>Record a supplier portal export once; it runs every Monday on its own
            </span>
          </div>
          <div className="logo-cell">
            <svg className="icon">
              <use href="#i-eye" />
            </svg>
            Watch law changes
            <span className="tag">
              <b>Web watcher</b>Checks the sources daily and tells you what changed that matters
            </span>
          </div>
        </div>
      </section>
      <section className="section" id="video">
        <div className="with-head">
          <h2 className="h2 rv">
            {"See Titan "}
            <span className="grad">at work</span>
          </h2>
          <p className="lead rv" style={{ marginTop: "16px" } as React.CSSProperties}>
            One real task from request to result: Titan plans it, the agents do the work on the laptop, and you approve
            what leaves it.
          </p>
        </div>
        <div className="video-stage" id="video-stage">
          <video id="demo-video" playsInline preload="none" data-src="/assets/titan-demo.mp4"></video>
          <button className="video-play" type="button" aria-label="Play the video">
            <svg className="icon">
              <use href="#i-play" />
            </svg>
          </button>
          <button className="video-close" type="button" aria-label="Close the video">
            <svg className="icon">
              <use href="#i-x" />
            </svg>
          </button>
          <p className="video-note" role="status">
            The demo video is coming soon.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="statement">
          <p className="reveal-text" id="reveal">
            {
              "Most AI tools rent you a chatbot in someone else's cloud. Titan117 gives a small company a whole team that lives on its own laptop, remembers how the business works, and asks before it acts."
            }
          </p>
          <p className="lead">
            Agents run where your files already are. When the laptop sleeps, they pause at a checkpoint and pick up
            where they left off.
          </p>
          <a className="btn btn-glow" href="#how">
            How it works
          </a>
        </div>
      </section>
      <section className="section">
        <div className="facts">
          <div className="fact intro">
            <h3 className="h3">Built for the way small companies work</h3>
            <p>
              No servers to rent, nothing to install first. Download, sign in, and Titan downloads only what the
              features you pick need.
            </p>
          </div>
          <div className="fact">
            <div className="fact-num">
              <span data-count="10">0</span>
            </div>
            <p>Agents: Titan plus nine specialists, sharing one memory</p>
          </div>
          <div className="fact">
            <div className="fact-num">
              <span data-count="8">0</span>
            </div>
            <p>Industries with ready-made workflows</p>
          </div>
          <div className="fact">
            <div className="fact-num">
              <span data-count="0">0</span>
              <sup>credits</sup>
            </div>
            <p>For local models, previews, tests and documents</p>
          </div>
          <div className="fact">
            <div className="fact-num">
              <span data-count="3">0</span>
            </div>
            <p>App targets from one prompt: web, mobile, desktop</p>
          </div>
          <div className="fact">
            <div className="fact-num">
              €<span data-count="15">0</span>
              <sup>/mo</sup>
            </div>
            <p>Plans from Starter, with every agent included</p>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="pad" style={{ paddingBottom: "56px" } as React.CSSProperties}>
          <div className="sec-head" style={{ marginBottom: "0" } as React.CSSProperties}>
            <h2 className="h2 rv">
              {"One app, "}
              <span className="grad">every kind of work</span>
            </h2>
            <p className="lead rv">
              A general assistant that can do almost any computer task, with the safe defaults a company can trust.
            </p>
          </div>
        </div>
        <div className="features">
          <div className="feat-media">
            <div className="feat-media-inner">
              <div className="app" id="feat-app">
                <aside className="app-side">
                  <div className="app-brand">
                    <svg className="bot" data-bot="feat" data-ink="#141414" aria-hidden="true"></svg>Titan
                  </div>
                  <div className="app-item on">
                    <svg className="icon">
                      <use href="#i-chat" />
                    </svg>
                    Chat
                  </div>
                  <div className="app-item">
                    <svg className="icon">
                      <use href="#i-brain" />
                    </svg>
                    Memory
                  </div>
                  <div className="app-item">
                    <svg className="icon">
                      <use href="#i-shield" />
                    </svg>
                    Approvals
                  </div>
                  <div className="app-item">
                    <svg className="icon">
                      <use href="#i-chart" />
                    </svg>
                    Activity
                  </div>
                </aside>
                <div className="app-main" id="feat-main"></div>
              </div>
            </div>
          </div>
          <div className="feat-list" id="feat-list">
            <div className="feat-item open">
              <button aria-expanded="true">
                <span className="feat-ic">
                  <svg className="icon">
                    <use href="#i-sparkles" />
                  </svg>
                </span>
                A general assistant with real tools
              </button>
              <div className="feat-body">
                <div>
                  <p>
                    Titan works with your files, a sandboxed shell, a browser and small scripts. Sort a folder, build an
                    Excel report from invoices, reply to suppliers, convert a batch of videos. Big jobs go to the
                    specialists.
                  </p>
                </div>
              </div>
            </div>
            <div className="feat-item">
              <button aria-expanded="false">
                <span className="feat-ic">
                  <svg className="icon">
                    <use href="#i-brain" />
                  </svg>
                </span>
                Memory you can see and edit
              </button>
              <div className="feat-body">
                <div>
                  <p>
                    Facts, preferences and your company profile, shared by every agent and scoped so the QA agent never
                    reads finance notes. After doing a task once, Titan saves how as a skill you can read, edit or
                    delete.
                  </p>
                </div>
              </div>
            </div>
            <div className="feat-item">
              <button aria-expanded="false">
                <span className="feat-ic">
                  <svg className="icon">
                    <use href="#i-shield" />
                  </svg>
                </span>
                Approvals before anything external
              </button>
              <div className="feat-body">
                <div>
                  <p>
                    Publishing, sending, posting and deleting always ask you first, on the laptop, on the web or in
                    chat. Web content is treated as data, never as instructions, and every task has a credit cap.
                  </p>
                </div>
              </div>
            </div>
            <div className="feat-item">
              <button aria-expanded="false">
                <span className="feat-ic">
                  <svg className="icon">
                    <use href="#i-cpu" />
                  </svg>
                </span>
                Any model, local or cloud
              </button>
              <div className="feat-body">
                <div>
                  <p>
                    Pick a model per agent and override it per step. Local models are free and offline; OpenRouter
                    brings the strongest ones. You see the estimated cost before a task runs.
                  </p>
                </div>
              </div>
            </div>
            <div className="feat-item">
              <button aria-expanded="false">
                <span className="feat-ic">
                  <svg className="icon">
                    <use href="#i-phone" />
                  </svg>
                </span>
                Control it from anywhere
              </button>
              <div className="feat-body">
                <div>
                  <p>
                    Start tasks and approve them from the web app, your phone, or Telegram and WhatsApp. Commands are
                    end-to-end encrypted; the laptop does the work.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="section agents-band" id="agents">
        <div className="pad">
          <div className="sec-head">
            <h2 className="h2">
              {"Meet "}
              <span className="grad">the agents</span>
            </h2>
            <p className="lead">
              Titan runs the team and hands parts of a job to the specialist that does it best. Clone any agent and make
              it your own.
            </p>
          </div>
          <div className="agent-grid" id="agent-grid"></div>
        </div>
      </section>
      <section className="section" id="how">
        <div className="pad" style={{ paddingBottom: "56px" } as React.CSSProperties}>
          <div className="sec-head" style={{ marginBottom: "0" } as React.CSSProperties}>
            <h2 className="h2 rv">
              {"How "}
              <span className="grad">Titan117</span>
              {" works"}
            </h2>
            <p className="lead rv">
              From download to finished work in three steps. No Python, Docker or Node to install first.
            </p>
          </div>
        </div>
        <div className="how">
          <article className="how-card rv">
            <div className="how-vis">
              <div className="vis-models">
                <div className="vis-row">
                  <svg className="icon" style={{ width: "16px", height: "16px" } as React.CSSProperties}>
                    <use href="#i-cpu" />
                  </svg>
                  Local · Qwen 7B<em>free</em>
                  <span className="sw on"></span>
                </div>
                <div className="vis-row">
                  <svg className="icon" style={{ width: "16px", height: "16px" } as React.CSSProperties}>
                    <use href="#i-globe" />
                  </svg>
                  OpenRouter<em>credits</em>
                  <span className="sw on"></span>
                </div>
                <div className="vis-row">
                  <svg className="icon" style={{ width: "16px", height: "16px" } as React.CSSProperties}>
                    <use href="#i-key" />
                  </svg>
                  Your own key<em>BYOK</em>
                  <span className="sw"></span>
                </div>
              </div>
            </div>
            <span className="num">01</span>
            <h3 className="h3">Install and pick your models</h3>
            <p>
              One signed installer. A hardware check suggests local models your laptop can run; add cloud models for the
              heavy jobs.
            </p>
            <a className="link-more" href="#faq">
              {"Requirements "}
              <svg className="icon">
                <use href="#i-arrow" />
              </svg>
            </a>
          </article>
          <article className="how-card rv">
            <div className="how-vis">
              <div className="vis-chat">
                <div className="bubble me">Build an Excel report from the invoices folder</div>
                <div className="bubble ai">Reading 42 PDFs · est. 0 credits</div>
                <div className="bubble ai">
                  <span className="typing">
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                </div>
              </div>
            </div>
            <span className="num">02</span>
            <h3 className="h3">Tell Titan the job</h3>
            <p>
              Type or message it from your phone. Titan plans, shows the cost up front, and splits the work between
              agents.
            </p>
            <a className="link-more" href="#agents">
              {"Meet the agents "}
              <svg className="icon">
                <use href="#i-arrow" />
              </svg>
            </a>
          </article>
          <article className="how-card rv">
            <div className="how-vis">
              <div className="vis-approve">
                <b>Send the report on Telegram?</b>
                <p style={{ color: "var(--muted-fg)" } as React.CSSProperties}>
                  invoices-march.xlsx · 42 invoices, 3 overdue
                </p>
                <div className="row">
                  <span className="yes">Approve</span>
                  <span>Review</span>
                </div>
              </div>
            </div>
            <span className="num">03</span>
            <h3 className="h3">Approve and get the result</h3>
            <p>
              Anything that leaves your laptop waits for your OK. Results land as files, reports, apps or posts, with a
              timeline of every step.
            </p>
            <a className="link-more" href="#trust">
              {"Safety by default "}
              <svg className="icon">
                <use href="#i-arrow" />
              </svg>
            </a>
          </article>
        </div>
      </section>
      <section className="section" id="industries">
        <div className="pad" style={{ paddingBottom: "32px" } as React.CSSProperties}>
          <div className="sec-head" style={{ marginBottom: "0" } as React.CSSProperties}>
            <h2 className="h2 rv">
              {"Made for "}
              <span className="grad">your industry</span>
            </h2>
            <p className="lead rv">Eight kinds of small company, each with workflows Titan takes off their plate.</p>
          </div>
        </div>
        <div className="ind-tabs" role="tablist" aria-label="Industries" id="ind-tabs"></div>
        <div className="ind-slide" id="ind-slide" role="tabpanel"></div>
        <div className="dots" id="ind-dots"></div>
      </section>
      <section className="section" id="pricing">
        <div className="pad" style={{ paddingBottom: "48px" } as React.CSSProperties}>
          <div className="sec-head" style={{ marginBottom: "0" } as React.CSSProperties}>
            <h2 className="h2 rv">
              {"Simple pricing, "}
              <span className="grad">local is free</span>
            </h2>
            <p className="lead rv">
              Every plan has every agent. Credits pay only for cloud models; local models, previews and tests never cost
              a credit.
            </p>
            <div className="billing rv" role="group" aria-label="Billing period">
              <button aria-pressed="true" data-bill="m">
                Monthly
              </button>
              <button aria-pressed="false" data-bill="y">
                Yearly<em>2 months free</em>
              </button>
            </div>
          </div>
        </div>
        <div className="pricing">
          <div className="plans" role="radiogroup" aria-label="Plans" id="plans"></div>
          <div className="includes" id="includes"></div>
        </div>
      </section>
      <section className="section" id="trust">
        <div
          className="pad"
          style={
            {
              paddingBottom: "48px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: "24px",
              flexWrap: "wrap",
            } as React.CSSProperties
          }
        >
          <div className="sec-head" style={{ marginBottom: "0" } as React.CSSProperties}>
            <h2 className="h2 rv">
              {"Safe "}
              <span className="grad">by default</span>
            </h2>
            <p className="lead rv">Everything a general agent can do, with the guardrails a company needs.</p>
          </div>
          <div className="ind-nav">
            <button className="icon-btn" data-trust="-1" aria-label="Previous">
              <svg className="icon">
                <use href="#i-left" />
              </svg>
            </button>
            <button className="icon-btn" data-trust="1" aria-label="Next">
              <svg className="icon">
                <use href="#i-right" />
              </svg>
            </button>
          </div>
        </div>
        <div className="trust" id="trust-track">
          <article className="trust-card">
            <div className="trust-vis tv1">
              <svg className="icon">
                <use href="#i-lock" />
              </svg>
            </div>
            <span className="eyebrow">{"//Local-first"}</span>
            <h3>Your data stays on your laptop</h3>
            <p>
              Files, memory and app data live in a local database. Our cloud only handles your account, plan and
              credits.
            </p>
          </article>
          <article className="trust-card">
            <div className="trust-vis tv2">
              <svg className="icon">
                <use href="#i-shield" />
              </svg>
            </div>
            <span className="eyebrow">{"//Approvals"}</span>
            <h3>Nothing goes out without your OK</h3>
            <p>Send, publish, post and delete always wait for you. Risky shell commands too.</p>
          </article>
          <article className="trust-card">
            <div className="trust-vis tv3">
              <svg className="icon">
                <use href="#i-folder" />
              </svg>
            </div>
            <span className="eyebrow">{"//Permissions"}</span>
            <h3>Only the folders you allow</h3>
            <p>Agents touch the files you point them at, and confidential folders can be set to local models only.</p>
          </article>
          <article className="trust-card">
            <div className="trust-vis tv4">
              <svg className="icon">
                <use href="#i-key" />
              </svg>
            </div>
            <span className="eyebrow">{"//Secrets"}</span>
            <h3>Keys in your OS keychain</h3>
            <p>API keys and logins never sit in files, recordings or memory. Titan pauses for two-factor codes.</p>
          </article>
          <article className="trust-card">
            <div className="trust-vis tv5">
              <svg className="icon">
                <use href="#i-wifi-off" />
              </svg>
            </div>
            <span className="eyebrow">{"//Offline"}</span>
            <h3>Works without internet</h3>
            <p>Local models, tools and data keep working offline. Cloud tasks can switch to a local model.</p>
          </article>
          <article className="trust-card">
            <div className="trust-vis tv6">
              <svg className="icon">
                <use href="#i-eye" />
              </svg>
            </div>
            <span className="eyebrow">{"//Transparency"}</span>
            <h3>See every step and its cost</h3>
            <p>An activity timeline shows what each agent did, why, with which model and for how many credits.</p>
          </article>
        </div>
      </section>
      <section className="section" id="faq">
        <div className="pad">
          <div className="faq">
            <div className="sec-head" style={{ marginBottom: "0", alignContent: "start" } as React.CSSProperties}>
              <h2 className="h2 rv">FAQs</h2>
              <p className="lead rv">Still unsure? These are the questions small companies ask us most.</p>
            </div>
            <div className="faq-list">
              <details open>
                <summary>
                  Does Titan117 run on my own computer?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  Yes. The agents run in the desktop app on your Windows or Mac laptop. Our cloud only handles your
                  account, plan, credits and the relay for remote control. When the laptop is off, agents stop;
                  scheduled work catches up on the next launch.
                </p>
              </details>
              <details>
                <summary>
                  What do I need to install first?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  Nothing. One signed installer has everything the core needs. Heavier parts, like local models or an
                  Android emulator, download when a feature needs them, with their size shown first.
                </p>
              </details>
              <details>
                <summary>
                  Which industries is it for?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  Any small company, with ready-made workflows for retail and e-commerce, restaurants and cafés,
                  accounting, law firms, real estate, agencies and studios, trades and construction, and wholesale and
                  manufacturing.
                </p>
              </details>
              <details>
                <summary>
                  What is a credit?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  One credit is €0.01 of cloud model usage at our price. Every task shows its estimate first and can be
                  capped. Local models, previews, tests and anything you run with your own API key cost no credits.
                </p>
              </details>
              <details>
                <summary>
                  Can it act without asking me?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  Not for anything external. Sending, publishing, posting and deleting always need your approval, from
                  the app, the web, your phone or a linked chat channel.
                </p>
              </details>
              <details>
                <summary>
                  Is there a free plan?
                  <svg className="icon">
                    <use href="#i-plus" />
                  </svg>
                </summary>
                <p>
                  No. Titan117 works with a subscription from €15 a month. Local models are unlimited on every plan, so
                  you only pay for cloud usage beyond your monthly credits.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="cta">
          <h2 className="h2 rv">
            {"Give your company "}
            <span className="grad">a team that never sleeps in</span>
          </h2>
          <p className="lead rv">Download Titan117, sign in, and hand over your first task in minutes.</p>
          <div className="hero-ctas rv">
            <a className="btn btn-glow btn-download" href="#pricing">
              <svg className="icon" style={{ width: "17px", height: "17px" } as React.CSSProperties}>
                <use href="#i-download" />
              </svg>
              Download now
            </a>
            <a className="btn btn-dark" href="#faq">
              Read the FAQ
            </a>
          </div>
        </div>
      </section>
    </Shell>
  );
}
