// Titan117 website: what every page shares. Each block runs only when its markup is on the page.
// Plain JS, no dependencies; assets/bot.js (Titan's eyes) loads before this file.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ic = (id, style = "") => `<svg class="icon"${style ? ` style="${style}"` : ""}><use href="#i-${id}"/></svg>`;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- theme + menu ---------- */
$("#theme")?.addEventListener("click", () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("t117-theme", root.dataset.theme); } catch (e) {}
});
$("#menu")?.addEventListener("click", (e) => {
  const open = $("#nav").classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", open);
});
$$("#nav a").forEach((a) => a.addEventListener("click", () => $("#nav").classList.remove("open")));

/* nav dropdowns (Agents, Industries) open on hover or keyboard focus (CSS); the trigger itself links to the overview page.
   Escape closes an open one and returns focus to its trigger. */
document.addEventListener("keydown", (e) => {
  const item = e.key === "Escape" && document.activeElement?.closest(".nav-item");
  if (item) { $(".nav-trigger", item).focus(); item.classList.add("closed"); }
});
$$(".nav-item").forEach((item) => item.addEventListener("mouseleave", () => item.classList.remove("closed")));
$$(".nav-trigger").forEach((t) => t.addEventListener("focus", () => t.closest(".nav-item").classList.remove("closed")));

/* current page in the nav: the build writes <body data-page> and, for links made here, data-root ("../" per level) */
const ROOT = document.body.dataset.root || "";
const link = (path) => `${ROOT}${path}${path.endsWith("/") ? "index.html" : ""}`;
$$("#nav [data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === document.body.dataset.page));

/* ---------- Titan's eyes ---------- */
// logos: ink at rest, looking around on their own (still under reduced motion), tomato on hover.
// Logos without a fixed data-ink follow the theme.
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
$("#theme")?.addEventListener("click", () => bots.forEach((f) => f()));

// an agent's own eyes (agent pages and cards): its colour, following the cursor
if (window.TitanBot) $$("svg[data-agent-bot]").forEach((svg) => {
  TitanBot.mount(svg, { expression: svg.dataset.expression || "colere", color: svg.dataset.color, follow: !reduced && svg.dataset.follow !== "false", still: reduced });
});

/* ---------- pricing (home and /pricing/) ---------- */
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
    <a class="btn btn-dark" href="${link("pricing/")}">${p.m === null ? "Contact us" : `Choose ${p.name}`}</a>`;
}
if ($("#plans")) {
  $$("[data-bill]").forEach((b) => b.addEventListener("click", () => {
    yearly = b.dataset.bill === "y";
    $$("[data-bill]").forEach((o) => o.setAttribute("aria-pressed", o === b));
    renderPlans();
  }));
  renderPlans();
}

/* ---------- video bands ---------- */
// each file loads only on play; until it exists the poster says the video is coming
$$(".video-stage").forEach((stage) => {
  const video = $("video", stage), play = $(".video-play", stage);
  const close = () => { video.pause(); stage.classList.remove("playing"); play.focus(); };
  video.addEventListener("error", () => { stage.classList.remove("playing"); stage.classList.add("missing"); });
  play.addEventListener("click", () => {
    if (!video.src) video.src = video.dataset.src;
    stage.classList.add("playing");
    video.controls = true;
    video.play().catch(() => {});
  });
  $(".video-close", stage).addEventListener("click", close);
  video.addEventListener("ended", close);
});

/* ---------- card carousel ---------- */
$$("[data-trust]").forEach((b) => b.addEventListener("click", () => {
  const track = $("#trust-track");
  track.scrollBy({ left: +b.dataset.trust * track.firstElementChild.offsetWidth, behavior: reduced ? "auto" : "smooth" });
}));

/* ---------- search + filter chips (FAQ and Learn) ---------- */
// items carry data-cat and their text; chips carry data-filter; one input[data-search] filters by text
$$("[data-filter-scope]").forEach((scope) => {
  const items = $$("[data-cat]", scope), groups = $$("[data-group]", scope), empty = $("[data-empty]", scope);
  const input = $("[data-search]", scope);
  let cat = "all";
  const apply = () => {
    const q = (input?.value || "").trim().toLowerCase();
    let shown = 0;
    items.forEach((it) => {
      const ok = (cat === "all" || it.dataset.cat === cat) && (!q || it.textContent.toLowerCase().includes(q));
      it.hidden = !ok; if (ok) shown++;
    });
    groups.forEach((g) => { g.hidden = !$$("[data-cat]", g).some((it) => !it.hidden); });
    if (empty) empty.hidden = shown > 0;
  };
  $$("[data-filter]", scope).forEach((chip) => chip.addEventListener("click", () => {
    cat = chip.dataset.filter;
    $$("[data-filter]", scope).forEach((c) => c.setAttribute("aria-pressed", c === chip));
    apply();
  }));
  input?.addEventListener("input", apply);
});

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".rv").forEach((el) => io.observe(el));

/* count-up numbers */
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

/* back to top */
if ($("#to-top")) {
  addEventListener("scroll", () => $("#to-top").classList.toggle("show", scrollY > 900), { passive: true });
  $("#to-top").addEventListener("click", () => scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));
}
