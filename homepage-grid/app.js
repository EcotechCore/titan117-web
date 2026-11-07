// Titan117 homepage: tabs, sliders, reveals. Plain JS, no dependencies.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ic = (id, style = "") => `<svg class="icon"${style ? ` style="${style}"` : ""}><use href="#i-${id}"/></svg>`;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- theme + menu ---------- */
$("#theme").addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("t117-theme", root.dataset.theme); } catch (e) {}
});
$("#menu").addEventListener("click", (e) => {
  const open = $("#nav").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
$$("#nav a").forEach((a) => a.addEventListener("click", () => $("#nav").classList.remove("open")));

/* Titan's eyes on the logos, from new-mockups: ink at rest, looking around on their own
   (the engine's idle wander; still under reduced motion), tomato on hover.
   Logos without a fixed data-ink follow the theme. */
const bots = [];
const themeInk = () => (document.documentElement.dataset.theme === "dark" ? "#f2f2f3" : "#141414");
const hoverInk = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff6347";
if (window.TitanBot) $$("svg[data-bot]").forEach((svg) => {
  const inkOf = () => svg.dataset.ink || themeInk();
  const bot = TitanBot.mount(svg, { expression: "colere", color: inkOf(), follow: false, still: reduced });
  const host = svg.closest("a") || svg;
  const on = () => bot.setColor(hoverInk), off = () => bot.setColor(inkOf());
  host.addEventListener("mouseenter", on); host.addEventListener("mouseleave", off);
  host.addEventListener("focusin", on); host.addEventListener("focusout", off);
  bots.push(off);
});
$("#theme").addEventListener("click", () => bots.forEach((f) => f()));

/* ---------- product stage ---------- */
const sideAgents = [
  ["sparkles", "Titan"], ["code", "App builder"], ["folder", "Folder agent"],
  ["record", "Recorder"], ["megaphone", "Marketing"], ["bug", "QA and tests"],
];

const scenes = [
  {
    agent: 0, title: "Titan · Supplier follow-up",
    prompt: "Find every supplier email about late deliveries this week, draft replies and add the dates to the calendar.",
    steps: [["done", "Searched Gmail · 14 threads", "4s"], ["done", "Matched 3 suppliers to open orders", "2s"], ["done", "Drafted 3 replies in your tone", "6s"], ["run", "Waiting for your approval", ""]],
    approve: ["Send 3 emails?", "Ionescu SRL, Delta Parts and NordFood. Calendar holds added for the new dates."],
    stats: [["Model", "Qwen 7B · local"], ["Cost", "0 credits"]], big: "3 drafts", bar: 75, out: ["mail", "replies-draft.eml × 3"],
  },
  {
    agent: 1, title: "App builder · Booking app",
    prompt: "Build a booking web app for my salon: services, staff, time slots and a reminder email.",
    steps: [["done", "Plan approved · 6 pages, 4 tables", "1m"], ["done", "Coder wrote 38 files", "4m"], ["done", "Tests pass in Chromium, Firefox, WebKit", "52s"], ["run", "Publish to salon-booking.app?", ""]],
    approve: ["Publish the web app?", "Version 3 is ready. Hosting costs about 40 credits a month."],
    stats: [["Planner", "Strong cloud model"], ["Coder", "DeepSeek · 212 credits"]], big: "v3 ready", bar: 90, out: ["globe", "Preview on localhost:5173"],
  },
  {
    agent: 2, title: "Folder agent · Contracts",
    prompt: "Which supplier contracts renew automatically before March, and what is the notice period?",
    steps: [["done", "Indexed /Contracts · 214 files", "38s"], ["done", "OCR on 31 scanned PDFs", "1m"], ["done", "Found 7 matching clauses", "3s"], ["done", "Answer with file and page", ""]],
    approve: null,
    stats: [["Folder", "Local models only"], ["Cost", "0 credits"]], big: "7 contracts", bar: 100, out: ["file", "Nord_supply_2024.pdf · p. 4, §9.2"],
  },
  {
    agent: 3, title: "Recorder · Weekly stock export",
    prompt: "Every Monday at 8:00, log in to the supplier portal, export stock levels and update the inventory sheet.",
    steps: [["done", "Recorded 9 browser steps", ""], ["done", "Login from OS keychain", "1s"], ["done", "Paused for 2FA code", ""], ["run", "Next run · Monday 08:00", ""]],
    approve: null,
    stats: [["Schedule", "Weekly"], ["Last run", "Succeeded"]], big: "9 steps", bar: 60, out: ["calendar", "stock-levels.xlsx updated"],
  },
  {
    agent: 4, title: "Marketing · March calendar",
    prompt: "Plan a month of posts for LinkedIn and Instagram from our brand kit, around the spring launch.",
    steps: [["done", "Read brand kit from memory", "1s"], ["done", "Planned 18 posts around 3 dates", "22s"], ["done", "Made images and captions", "2m"], ["run", "Schedule 18 posts?", ""]],
    approve: ["Schedule 18 posts?", "LinkedIn × 8, Instagram × 10. They go out even with the laptop closed."],
    stats: [["Model", "Cloud · 96 credits"], ["Brand kit", "Applied"]], big: "18 posts", bar: 85, out: ["calendar", "March content calendar"],
  },
];

function renderSide(active) {
  $("#app-agents").innerHTML = sideAgents.map(([i, n], k) =>
    `<div class="app-item${k === active ? " on" : ""}">${ic(i)}${n}${k === active ? '<span class="dot"></span>' : ""}</div>`).join("");
}

function sceneHTML(s) {
  const steps = s.steps.map(([st, t, time], k) =>
    `<div class="step ${st}" style="animation-delay:${k * 0.18}s"><i>${st === "done" ? "✓" : "•"}</i>${t}<small>${time}</small></div>`).join("");
  const approve = s.approve
    ? `<div class="approve"><b>${s.approve[0]}</b><p>${s.approve[1]}</p><div class="approve-row"><span>Approve</span><span>Review</span><span>Deny</span></div></div>`
    : `<div class="out">${ic(s.out[0])}${s.out[1]}</div>`;
  return `
    <div class="app-top"><div class="app-title">${s.title}</div>
      <div class="app-chips"><span class="chip on">Local</span><span class="chip">Cloud</span><span class="chip">Activity</span></div></div>
    <div class="app-prompt"><span>YOU</span>${s.prompt}</div>
    <div class="app-grid">
      <div class="panel"><h5>Steps</h5>${steps}${approve}</div>
      <div class="panel"><h5>Task</h5>
        <div class="big">${s.big}</div>
        <div class="bar"><div style="width:${s.bar}%"></div></div>
        ${s.stats.map(([k, v]) => `<div class="kv">${k}<b>${v}</b></div>`).join("")}
        ${s.approve ? `<div class="out" style="margin-top:auto">${ic(s.out[0])}${s.out[1]}</div>` : ""}
      </div>
    </div>`;
}

const tabs = $$(".tab");
let tabIndex = 0, tabTimer;
function showTab(i, user) {
  tabIndex = i;
  tabs.forEach((t, k) => {
    t.setAttribute("aria-selected", k === i);
    t.tabIndex = k === i ? 0 : -1;
  });
  // restart the progress bar
  const sel = tabs[i]; sel.style.animation = "none"; void sel.offsetWidth; sel.style.animation = "";
  renderSide(scenes[i].agent);
  const main = $("#app-main");
  main.innerHTML = sceneHTML(scenes[i]);
  main.classList.remove("fade-swap"); void main.offsetWidth; main.classList.add("fade-swap");
  if (user) { $(".tabs").classList.add("paused"); clearInterval(tabTimer); }
}
tabs.forEach((t, k) => {
  t.addEventListener("click", () => showTab(k, true));
  t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = (k + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    showTab(n, true); tabs[n].focus();
  });
});
showTab(0);
if (!reduced) tabTimer = setInterval(() => showTab((tabIndex + 1) % tabs.length), 6000);
else $(".tabs").classList.add("paused");

/* features block window */
$("#feat-main").innerHTML = `
  <div class="app-top"><div class="app-title">Chat</div></div>
  <div class="app-prompt"><span>YOU</span>Sort my Downloads folder and make an Excel report from the invoices in it.</div>
  <div class="panel"><h5>Titan</h5>
    <div class="step done" style="animation-delay:.1s"><i>✓</i>Moved 212 files into 6 folders</div>
    <div class="step done" style="animation-delay:.3s"><i>✓</i>Read 42 invoices</div>
    <div class="step done" style="animation-delay:.5s"><i>✓</i>Saved the method as a skill</div>
    <div class="out">${ic("file")}invoices-q1.xlsx</div>
  </div>`;

/* feature accordion */
$$("#feat-list .feat-item").forEach((item) => {
  $("button", item).addEventListener("click", () => {
    $$("#feat-list .feat-item").forEach((o) => {
      const on = o === item;
      o.classList.toggle("open", on);
      $("button", o).setAttribute("aria-expanded", on);
    });
  });
});

/* ---------- agents ---------- */
const agents = [
  ["sparkles", "Titan", "General assistant", "The default agent. Files, a sandboxed shell, the browser, scripts and your tools through MCP. Does one-off tasks itself and hands big jobs to the specialists."],
  ["code", "App builder", "Web, mobile, desktop", "Turns a prompt into a web, mobile or desktop app. Plans, builds, tests and previews it on your laptop, then publishes."],
  ["terminal", "Code builder", "For developers", "Works in any repo on your laptop: plans, edits as diffs, runs tests, commits and opens pull requests."],
  ["folder", "Folder agent", "Your documents", "Answers questions about your PDFs, Word, Excel and email, citing the file, page and passage."],
  ["bug", "QA and tests", "Websites and apps", "Explores your site, writes tests that run without AI, and checks accessibility and speed."],
  ["video", "Promo video", "Website to video", "Reads your website and makes a promo video with a script, voiceover and your brand colours."],
  ["chart", "SEO agent", "Search visibility", "Audits your site, fixes what it can, tracks rankings and writes content you approve."],
  ["megaphone", "Marketing", "Posts and campaigns", "Social posts, newsletters and a content calendar, all from your brand kit."],
  ["eye", "Web watcher", "Changes that matter", "Checks sources on a schedule and tells you what changed that matters to your company."],
  ["record", "Recorder", "Repeat it for me", "Record browser steps once and replay them on a schedule, with logins from your keychain."],
];
$("#agent-grid").innerHTML = agents.map(([i, n, tag, d], k) => `
  <article class="agent${k === 0 ? " lead-agent" : ""} rv">
    <div class="agent-top"><span class="agent-ic">${ic(i)}</span>${k === 0 ? "" : `<span class="eyebrow">${String(k).padStart(2, "0")}</span>`}</div>
    <div><span class="eyebrow">${tag}</span><h3>${n}</h3></div>
    <p>${d}</p>
  </article>`).join("");

/* ---------- industries ---------- */
const industries = [
  { id: "retail", icon: "store", name: "Retail and e-commerce",
    ask: "“Write product descriptions for the 60 new items, update the shop, and plan the posts for the spring sale.”",
    pitch: "Run the shop, the listings and the marketing without hiring a team.",
    flow: ["Reads the supplier price list", "Writes descriptions and photos alt text", "Updates the shop after your OK"],
    uses: ["Product descriptions and SEO", "Stock and order reports", "A month of social posts", "Promo video from your site"],
    agents: ["Titan", "Marketing", "SEO agent"] },
  { id: "hospitality", icon: "cup", name: "Restaurants and cafés",
    ask: "“Update the menu on the website, post the weekend special, and reply to this week's reviews.”",
    pitch: "Menus, bookings and reviews handled between services.",
    flow: ["Reads the new menu photo", "Updates the site and Google profile", "Drafts review replies for approval"],
    uses: ["Booking app for your site", "Review replies in your voice", "Supplier orders and costs", "Local SEO and Google profile"],
    agents: ["App builder", "Marketing", "SEO agent"] },
  { id: "accounting", icon: "calc", name: "Accounting and bookkeeping",
    ask: "“Match this month's bank statement to the invoices folder and list what's missing per client.”",
    pitch: "Real calculations on your spreadsheets, never guesses, and client files that never leave the office.",
    flow: ["Reads statements and invoices locally", "Computes matches in the spreadsheet", "Lists gaps per client with sources"],
    uses: ["Reconcile statements", "Client document requests", "Tax law change alerts", "Excel reports from PDFs"],
    agents: ["Folder agent", "Web watcher", "Titan"] },
  { id: "legal", icon: "scale", name: "Law firms",
    ask: "“Which of our supplier contracts renew automatically before March, and what's the notice period?”",
    pitch: "Search every contract and file with answers that cite the page, on local models for confidential folders.",
    flow: ["Indexes the matter folder with OCR", "Finds clauses across documents", "Answers with file, page and passage"],
    uses: ["Clause search across contracts", "New legislation summaries", "First drafts from templates", "Deadline tracking"],
    agents: ["Folder agent", "Web watcher", "Titan"] },
  { id: "realestate", icon: "home", name: "Real estate agencies",
    ask: "“Turn these 12 listing photos and notes into listings, a video tour and posts for this week.”",
    pitch: "Listings, videos and follow-ups out the door the same day.",
    flow: ["Reads photos and agent notes", "Writes listings and a short video", "Schedules posts after your OK"],
    uses: ["Listing descriptions", "Property promo videos", "Lead follow-up emails", "Portal uploads, recorded once"],
    agents: ["Promo video", "Marketing", "Recorder"] },
  { id: "agencies", icon: "palette", name: "Agencies and studios",
    ask: "“Audit the client's site, fix the SEO issues on our build, and send me the report for Monday.”",
    pitch: "More client work with the same people: build, test, rank and report.",
    flow: ["Crawls the client site", "Fixes issues through the code builder", "Writes a client-ready report"],
    uses: ["Client sites and apps", "SEO audits and fixes", "QA reports and tests", "Campaign content"],
    agents: ["App builder", "SEO agent", "QA and tests"] },
  { id: "trades", icon: "hammer", name: "Trades and construction",
    ask: "“Make a quote from these site notes and photos, and remind the client on Friday if they haven't replied.”",
    pitch: "Quotes, schedules and paperwork done from your phone, between jobs.",
    flow: ["Reads notes and photos from chat", "Builds the quote from your price list", "Sends after your OK, then follows up"],
    uses: ["Quotes from site notes", "Job scheduling", "Permit and regulation alerts", "A simple jobs app"],
    agents: ["Titan", "App builder", "Web watcher"] },
  { id: "wholesale", icon: "box", name: "Wholesale and manufacturing",
    ask: "“Every Monday, export stock from the supplier portal and flag anything below two weeks of cover.”",
    pitch: "Stock, orders and supplier portals on autopilot, with you approving what matters.",
    flow: ["Logs in with keychain credentials", "Exports and merges stock data", "Flags low stock and drafts orders"],
    uses: ["Supplier portal exports", "Inventory and CRM apps", "Order confirmations", "Price list updates"],
    agents: ["Recorder", "App builder", "Titan"] },
];

let indIndex = 0, indTimer;
$("#ind-tabs").innerHTML = industries.map((d, k) =>
  `<button class="ind-tab" role="tab" aria-selected="${k === 0}" data-i="${k}">${ic(d.icon)}${d.name}</button>`).join("");
$("#ind-dots").innerHTML = industries.map((d, k) =>
  `<button aria-label="${d.name}" data-i="${k}"></button>`).join("");

function showInd(i, user) {
  indIndex = (i + industries.length) % industries.length;
  const d = industries[indIndex];
  $$("#ind-tabs .ind-tab").forEach((t, k) => t.setAttribute("aria-selected", k === indIndex));
  $$("#ind-dots button").forEach((t, k) => t.setAttribute("aria-current", k === indIndex));
  const slide = $("#ind-slide");
  slide.innerHTML = `
    <div class="ind-vis">
      <div class="ind-card">
        <div class="ind-card-top"><span class="ind-card-ic">${ic(d.icon, "width:22px;height:22px")}</span><div><b>${d.name}</b><small>Example workflow</small></div></div>
        <div class="ind-flow">${d.flow.map((f, k) => `<div style="animation-delay:${k * 0.2}s"><span>${k + 1}</span>${f}</div>`).join("")}</div>
      </div>
    </div>
    <div class="ind-text">
      <p class="ind-quote">${d.ask}</p>
      <p>${d.pitch}</p>
      <ul class="ind-uses">${d.uses.map((u) => `<li>${ic("check")}${u}</li>`).join("")}</ul>
      <div class="ind-meta">
        <div class="ind-agents">${d.agents.map((a) => `<span>${a}</span>`).join("")}</div>
        <div class="ind-nav">
          <button class="icon-btn" data-step="-1" aria-label="Previous industry">${ic("left")}</button>
          <button class="icon-btn" data-step="1" aria-label="Next industry">${ic("right")}</button>
        </div>
      </div>
    </div>`;
  slide.classList.remove("fade-swap"); void slide.offsetWidth; slide.classList.add("fade-swap");
  $$("[data-step]", slide).forEach((b) => b.addEventListener("click", () => showInd(indIndex + +b.dataset.step, true)));
  if (user) clearInterval(indTimer);
}
$$("#ind-tabs .ind-tab, #ind-dots button").forEach((b) => b.addEventListener("click", () => showInd(+b.dataset.i, true)));
$$("[data-ind]").forEach((a) => a.addEventListener("click", () => showInd(industries.findIndex((d) => d.id === a.dataset.ind), true)));
showInd(0);
if (!reduced) indTimer = setInterval(() => showInd(indIndex + 1), 8000);

/* ---------- pricing ---------- */
const plans = [
  { name: "Starter", who: "The way in", icon: "circle4", m: 15, y: 150, credits: "700", devices: 2, support: "Email support" },
  { name: "Pro", who: "One person running a company", icon: "star4", m: 25, y: 250, credits: "1,500", devices: 3, support: "Email support" },
  { name: "Max", who: "Heavy daily use of cloud models", icon: "half", m: 50, y: 500, credits: "3,500", devices: 5, support: "Priority support" },
  { name: "Custom", who: "Teams and agencies", icon: "team", m: null, y: null, credits: "A custom pool of", devices: "Custom", support: "Dedicated support" },
];
let planIndex = 1, yearly = false;
function renderPlans() {
  $("#plans").innerHTML = plans.map((p, k) => {
    const price = p.m === null ? "Talk to us"
      : `€${yearly ? p.y : p.m}<small>/${yearly ? "year" : "month"}</small>`;
    return `<button class="plan" role="radio" aria-checked="${k === planIndex}" data-p="${k}">
      <span class="plan-ic">${ic(p.icon, "width:20px;height:20px")}</span>
      <span class="plan-name">${p.name}<small>${p.who}</small></span>
      <span class="plan-price">${price}</span></button>`;
  }).join("");
  $$("#plans .plan").forEach((b) => b.addEventListener("click", () => { planIndex = +b.dataset.p; renderPlans(); }));
  const p = plans[planIndex];
  const items = [
    `${p.credits} credits a month for cloud models`,
    "Unlimited local models, previews and tests",
    "All agents and the app builder",
    "Your own API keys and credit top-ups",
    "Remote control and chat channels",
    `${p.devices} devices · ${p.support}`,
  ];
  if (p.m === null) items.push("Teams, roles, audit log and SSO", "Agency and white-label");
  $("#includes").innerHTML = `
    <span class="eyebrow">Includes</span>
    <ul>${items.map((t) => `<li>${ic("check")}${t}</li>`).join("")}</ul>
    <p class="credit-note">1 credit = €0.01 of cloud usage. Credits roll over for a month; top-ups last 12 months. Prices before VAT, also in USD.</p>
    <a class="btn btn-dark" href="#top">${p.m === null ? "Contact us" : `Choose ${p.name}`}</a>`;
}
$$("[data-bill]").forEach((b) => b.addEventListener("click", () => {
  yearly = b.dataset.bill === "y";
  $$("[data-bill]").forEach((o) => o.setAttribute("aria-pressed", o === b));
  renderPlans();
}));
renderPlans();

/* ---------- trust carousel ---------- */
$$("[data-trust]").forEach((b) => b.addEventListener("click", () => {
  const track = $("#trust-track");
  track.scrollBy({ left: +b.dataset.trust * track.firstElementChild.offsetWidth, behavior: reduced ? "auto" : "smooth" });
}));

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".rv").forEach((el) => io.observe(el));

/* count-up facts */
const countIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  countIO.unobserve(e.target);
  const end = +e.target.dataset.count, t0 = performance.now(), dur = reduced ? 0 : 1200;
  const tick = (t) => {
    const p = dur ? Math.min(1, (t - t0) / dur) : 1;
    e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { threshold: 0.5 });
$$("[data-count]").forEach((el) => countIO.observe(el));

/* word-by-word statement */
const reveal = $("#reveal");
const highlight = new Set(["whole", "team", "own", "laptop,", "asks"]);
reveal.innerHTML = reveal.textContent.trim().split(/\s+/)
  .map((w) => `<span class="w${highlight.has(w) ? " hl" : ""}">${w}</span>`).join(" ");
const words = $$(".w", reveal);
function litWords() {
  if (reduced) return;
  const r = reveal.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
  const n = Math.round(p * words.length);
  words.forEach((w, k) => w.classList.toggle("lit", k < n));
}

/* nav highlight + back to top */
const sections = ["product", "agents", "industries", "pricing", "faq"].map((id) => document.getElementById(id));
function onScroll() {
  litWords();
  $("#to-top").classList.toggle("show", scrollY > 900);
  let cur = "product";
  sections.forEach((s) => { if (s.getBoundingClientRect().top < 140) cur = s.id; });
  $$("#nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();
if (reduced) words.forEach((w) => w.classList.add("lit"));
$("#to-top").addEventListener("click", () => scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));
