"""Build the Titan117 website pages.

    python homepage-grid/src/build.py

Writes every page as <route>/index.html under homepage-grid/ (so /pricing/, /agents/titan/ ... work
on any static server rooted at homepage-grid/), and refreshes the shared icons, header and footer
inside the hand-written homepage (index.html) between its <!-- @name --> markers.
Content lives in content.py; styles in styles.css; behaviour in assets/site.js.
"""

import html
import re
from pathlib import Path

from content import AGENTS, FAQ_GROUPS, INDUSTRIES, LEARN_TRACKS, LESSONS, TEAMS

ROOT = Path(__file__).resolve().parent.parent
SPRITE = (ROOT / "src" / "partials" / "icons.svg").read_text(encoding="utf-8").strip()
AG = {a["slug"]: a for a in AGENTS}
IND = {i["id"]: i for i in INDUSTRIES}
TRACK = dict(LEARN_TRACKS)

e = html.escape


def ic(name, size=None):
    style = f' style="width:{size}px;height:{size}px"' if size else ""
    return f'<svg class="icon"{style}><use href="#i-{name}"/></svg>'


DOWNLOAD = f'<a class="btn btn-glow btn-download" href="/pricing/">{ic("download", 17)}Download now</a>'


# ---------- shared parts ----------

def head(title, desc):
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Unbounded:wght@600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <script>
    var t = null;
    try {{ t = localStorage.getItem("t117-theme"); }} catch (e) {{}}
    document.documentElement.dataset.theme = t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  </script>
</head>
<body>
"""


def dd_item(href, icon, color, name, sub):
    return (f'<a class="dd-item" href="{href}"><span class="dd-ic" style="--c:{color}">{ic(icon)}</span>'
            f'<span><b>{e(name)}</b><small>{e(sub)}</small></span></a>')


def header():
    titan = AG["titan"]
    agents = "".join(dd_item(f"/agents/{a['slug']}/", a["icon"], a["color"], a["name"], a["tag"]) for a in AGENTS if a["slug"] != "titan")
    inds = "".join(dd_item(f"/industries/{i['id']}/", i["icon"], "var(--accent)", i["name"], i["tag"]) for i in INDUSTRIES)
    return f"""<header class="header">
  <div class="header-inner">
    <a class="logo" href="/" aria-label="TITAN117 home"><svg class="bot" data-bot="nav" aria-hidden="true"></svg>TITAN117</a>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="/#product" data-nav="home">Product</a>
      <div class="nav-item">
        <a class="nav-trigger" href="/agents/" data-nav="agents" aria-haspopup="true">Agents{ic("down")}</a>
        <div class="dropdown dd-agents">
          <a class="dd-feature" href="/agents/titan/">
            <span class="dd-feature-mark"><svg data-agent-bot data-color="{titan['color']}" data-follow="false" aria-hidden="true"></svg></span>
            <b>Titan</b><small>Your general assistant, and the one who runs the team.</small>
            <span class="link-more">Meet Titan {ic("arrow")}</span>
          </a>
          <div class="dd-grid">{agents}</div>
          <div class="dd-foot"><span>Grouped in teams: Operations, Build, Growth</span><a class="link-more" href="/agents/">All agents {ic("arrow")}</a></div>
        </div>
      </div>
      <div class="nav-item">
        <a class="nav-trigger" href="/industries/" data-nav="industries" aria-haspopup="true">Industries{ic("down")}</a>
        <div class="dropdown dd-industries">
          <div class="dd-grid">{inds}</div>
          <div class="dd-foot"><span>Workflows ready for eight kinds of small company</span><a class="link-more" href="/industries/">All industries {ic("arrow")}</a></div>
        </div>
      </div>
      <a href="/pricing/" data-nav="pricing">Pricing</a>
      <a href="/learn/" data-nav="learn">Learn</a>
      <a href="/faq/" data-nav="faq">FAQ</a>
    </nav>
    <div class="header-actions">
      <button class="icon-btn" id="theme" aria-label="Toggle theme">
        <svg class="icon theme-icon-light"><use href="#i-moon"/></svg>
        <svg class="icon theme-icon-dark"><use href="#i-sun"/></svg>
      </button>
      {DOWNLOAD}
      <button class="icon-btn menu-btn" id="menu" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><svg class="icon"><use href="#i-menu"/></svg></button>
    </div>
  </div>
</header>"""


def footer():
    inds = "".join(f'<a href="/industries/{i}/">{e(IND[i]["name"].split(" and ")[0])}</a>' for i in ["retail", "accounting", "legal", "agencies"])
    return f"""  <footer>
    <div class="footer-top">
      <div>
        <a class="logo" href="/"><svg class="bot" data-bot="foot" aria-hidden="true"></svg>TITAN117</a>
        <p>A local-first AI team for small companies. Your laptop does the work; you stay in charge.</p>
      </div>
      <div class="footer-col"><h4>Product</h4><a href="/#product">Overview</a><a href="/agents/">Agents</a><a href="/pricing/">Pricing</a><a href="/#trust">Security</a></div>
      <div class="footer-col"><h4>Industries</h4>{inds}<a href="/industries/">All industries</a></div>
      <div class="footer-col"><h4>Help</h4><a href="/learn/">Learn</a><a href="/faq/">FAQ</a><a href="#">Terms</a><a href="#">Privacy</a></div>
    </div>
    <div class="wordmark" aria-hidden="true"><span>Titan117</span></div>
    <div class="footer-bottom"><span>© 2026 Titan117. All rights reserved.</span><span>Made for small companies, run on your laptop.</span></div>
  </footer>"""


def cta(title="Give your company <span class=\"grad\">a team that never sleeps in</span>",
        lead="Download Titan117, sign in, and hand over your first task in minutes."):
    return f"""  <section class="section">
    <div class="cta">
      <h2 class="h2 rv">{title}</h2>
      <p class="lead rv">{lead}</p>
      <div class="hero-ctas rv">
        {DOWNLOAD}
        <a class="btn btn-dark" href="/learn/">Learn how it works</a>
      </div>
    </div>
  </section>"""


def relativize(doc, depth):
    """Templates write site paths ("/styles.css", "/agents/titan/"); pages ship relative ones
    ("../../styles.css", "../../agents/titan/index.html"), so the site works from any folder,
    any server root, or straight from the file system."""
    prefix = "../" * depth

    def fix(m):
        attr, path = m.group(1), m.group(2)
        path, _, frag = path.partition("#")
        if path == "" or path.endswith("/"):
            path += "index.html"
        return f'{attr}="{prefix}{path}{"#" + frag if frag else ""}"'

    return re.sub(r'\b(href|src|data-src)="/([^"/][^"]*|)"', fix, doc)


def section_of(route):
    return route.strip("/").split("/")[0] or "home"


def page(route, title, desc, body, scripts=""):
    depth = len([p for p in route.strip("/").split("/") if p])
    out = head(title, desc).replace("<body>", f'<body data-page="{section_of(route)}" data-root="{"../" * depth}">') + f"""
{SPRITE}

{header()}

<main id="top" class="frame">
{body}

{footer()}
</main>

<button class="to-top" id="to-top" aria-label="Back to top">{ic("arrow-up")}</button>

<script src="/assets/bot.js"></script>
<script src="/assets/site.js"></script>{scripts}
</body>
</html>
"""
    path = ROOT / route.strip("/") / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(relativize(out, depth), encoding="utf-8")
    return path


def hero(pill, h1, lead, ctas=None, mark=""):
    ctas = ctas if ctas is not None else f'{DOWNLOAD}<a class="btn btn-dark" href="/learn/">Learn how it works</a>'
    return f"""  <section class="section">
    <div class="hero page-hero">
      {mark}
      {f'<div class="pill rv">{pill}</div>' if pill else ""}
      <h1 class="h1 rv">{h1}</h1>
      <p class="lead rv">{lead}</p>
      {f'<div class="hero-ctas rv">{ctas}</div>' if ctas else ""}
    </div>
  </section>"""


def sec_head(title, lead="", extra=""):
    return f"""    <div class="pad" style="padding-bottom:48px">
      <div class="sec-head" style="margin-bottom:0">
        <h2 class="h2 rv">{title}</h2>
        {f'<p class="lead rv">{lead}</p>' if lead else ""}
        {extra}
      </div>
    </div>"""


def crumbs(*parts):
    links = " <span>/</span> ".join(f'<a href="{h}">{e(t)}</a>' if h else e(t) for t, h in parts)
    return f'<nav class="crumbs rv" aria-label="Breadcrumb">{links}</nav>'


def app_demo(a):
    """A one-task app window: the request, the steps, then an approval or the result."""
    d = a["demo"]
    steps = "".join(f'<div class="step done" style="animation-delay:{k * .18:.2f}s"><i>✓</i>{e(s)}</div>' for k, s in enumerate(d["steps"]))
    if d.get("approve"):
        t, p = d["approve"]
        last = (f'<div class="step run" style="animation-delay:.6s"><i>•</i>Waiting for your approval</div>'
                f'<div class="approve"><b>{e(t)}</b><p>{e(p)}</p><div class="approve-row"><span>Approve</span><span>Review</span><span>Deny</span></div></div>')
    else:
        i, t = d["out"]
        last = f'<div class="out">{ic(i)}{e(t)}</div>'
    return f"""    <div class="stage">
      <div class="app solo">
        <div class="app-bar">
          <span class="win-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <div class="app-tabs"><span class="app-tab on">{ic(a["icon"])}{e(d["title"])}</span></div>
        </div>
        <div class="app-main">
          <div class="app-top"><div class="app-title">{e(d["title"])}<small>{e(a["name"])} · started just now</small></div></div>
          <div class="app-prompt">{e(d["prompt"])}</div>
          <div class="panel"><h5>{ic(a["icon"], 13)}{e(a["name"])}</h5>{steps}{last}</div>
          <div class="composer">Ask {e(a["name"]) if a["slug"] == "titan" else "Titan"} anything…<span class="send">{ic("arrow-up")}</span></div>
        </div>
      </div>
    </div>"""


def agent_card(a, eyes=True):
    mark = (f'<span class="ac-mark"><svg data-agent-bot data-color="{a["color"]}" data-follow="false" aria-hidden="true"></svg></span>'
            if eyes else f'<span class="dd-ic" style="--c:{a["color"]}">{ic(a["icon"])}</span>')
    return f"""<a class="agent-card rv" href="/agents/{a['slug']}/">
        {mark}
        <span class="eyebrow">{e(a['tag'])}</span>
        <h3>{e(a['name'])}</h3>
        <p>{e(a['lead'])}</p>
        <span class="link-more">Meet {e(a['name'])} {ic("arrow")}</span>
      </a>"""


def cap_grid(items, cols=3):
    cells = "".join(f'<div class="cap rv"><span class="cap-ic">{ic(i)}</span><h3>{e(t)}</h3><p>{e(d)}</p></div>' for i, t, d in items)
    return f'<div class="cap-grid cols-{cols}">{cells}</div>'


def step_row(items):
    cells = "".join(f'<div class="step-card rv"><span class="num">{k + 1:02d}</span><h3>{e(t)}</h3><p>{e(d)}</p></div>' for k, (t, d) in enumerate(items))
    return f'<div class="step-row">{cells}</div>'


# ---------- pages ----------

def agents_index():
    teams = ""
    for tid, tname, tlead in TEAMS:
        cards = "".join(agent_card(a) for a in AGENTS if a["team"] == tid)
        teams += f"""  <section class="section" id="{tid}">
    <div class="team-head pad"><div><span class="eyebrow">Team</span><h2 class="h2 rv">{tname}</h2></div><p class="lead rv">{tlead}</p></div>
    <div class="card-row">{cards}</div>
  </section>
"""
    titan = AG["titan"]
    body = hero("Ten agents · three teams", 'Meet <span class="grad">the agents</span>',
                "Titan runs the team and hands each part of a job to the specialist that does it best. They share one memory, and every one of them asks before anything leaves your laptop.")
    body += f"""
  <section class="section agents-band">
    <div class="pad titan-feature">
      <span class="ac-mark big"><svg data-agent-bot data-color="{titan['color']}" aria-hidden="true"></svg></span>
      <div>
        <span class="eyebrow">{e(titan['tag'])}</span>
        <h2 class="h2">Titan, <span class="grad">{e(titan['headline'])}</span></h2>
        <p class="lead">{e(titan['lead'])}</p>
        <a class="btn btn-glow" href="/agents/titan/" style="margin-top:24px">Meet Titan {ic("arrow", 16)}</a>
      </div>
    </div>
  </section>
{teams}{cta()}"""
    page("/agents/", "Agents · Titan117", "Titan and nine specialist agents, grouped in teams: Operations, Build and Growth.", body)


def agent_page(a):
    # the hero is just the eyes (no tile), the name with its headline, and the lead
    mark = f'<span class="ac-mark hero-mark rv"><svg data-agent-bot data-color="{a["color"]}" aria-hidden="true"></svg></span>'
    body = hero("", f'{e(a["name"])}, <br><span class="grad">{e(a["headline"])}</span>', e(a["lead"]), mark=mark)
    body += f"\n  <section class=\"section\">\n{app_demo(a)}\n  </section>\n"
    body += f"""  <section class="section">
{sec_head('What it <span class="grad">does</span>')}
    {cap_grid(a["caps"])}
  </section>
  <section class="section">
{sec_head('How it <span class="grad">works</span>')}
    {step_row(a["steps"])}
  </section>
  <section class="section">
{sec_head('Try <span class="grad">asking</span>', "A few things to hand over on day one.")}
    <div class="prompt-grid">{"".join(f'<div class="prompt rv"><span>{ic("chat")}</span>{e(p)}</div>' for p in a["prompts"])}</div>
  </section>
  <section class="section">
    <div class="spec-wrap">
      <div class="pad">
        <h2 class="h2 rv">What it <span class="grad">needs</span></h2>
        <dl class="spec">{"".join(f'<div class="rv"><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in a["needs"])}</dl>
      </div>
      <div class="pad spec-side">
        <span class="eyebrow">Works well with</span>
        <div class="chip-links">{"".join(f'<a href="/agents/{p}/"><span class="dot" style="background:{AG[p]["color"]}"></span>{e(AG[p]["name"])}</a>' for p in a["pairs"])}</div>
        <span class="eyebrow" style="margin-top:28px">Used in</span>
        <div class="chip-links">{"".join(f'<a href="/industries/{i}/">{ic(IND[i]["icon"])}{e(IND[i]["name"])}</a>' for i in a["industries"])}</div>
      </div>
    </div>
  </section>
{cta(f'Put {e(a["name"])} <span class="grad">to work</span>', "Every agent is included in every plan. Download Titan117 and hand over your first task.")}"""
    page(f"/agents/{a['slug']}/", f"{a['name']} · Titan117 agents", a["lead"], body)


def industries_index():
    tiles = "".join(f"""<a class="ind-tile rv" href="/industries/{i['id']}/">
        <span class="ind-card-ic">{ic(i['icon'], 22)}</span>
        <h3>{e(i['name'])}</h3>
        <p>{e(i['pitch'])}</p>
        <span class="link-more">Explore {ic("arrow")}</span>
      </a>""" for i in INDUSTRIES)
    body = hero("Eight kinds of small company", 'Made for <span class="grad">your industry</span>',
                "Ready-made workflows for the work that fills your week, run by agents on your own laptop.")
    body += f"""
  <section class="section">
    <div class="ind-grid">{tiles}</div>
  </section>
{cta()}"""
    page("/industries/", "Industries · Titan117", "Titan117 workflows for retail, restaurants, accounting, law firms, real estate, agencies, trades and wholesale.", body)


def industry_page(i):
    flow = "".join(f'<div style="animation-delay:{k * .2:.1f}s"><span>{k + 1}</span>{e(f)}</div>' for k, f in enumerate(i["flow"]))
    uses = "".join(f"""<a class="cap rv" href="/agents/{a}/"><span class="cap-ic">{ic(AG[a]['icon'])}</span><h3>{e(t)}</h3><p>{e(d)}</p>
        <span class="cap-agent"><span class="dot" style="background:{AG[a]['color']}"></span>{e(AG[a]['name'])}</span></a>""" for t, d, a in i["uses"])
    others = "".join(f'<a href="/industries/{o["id"]}/">{ic(o["icon"])}{e(o["name"])}</a>' for o in INDUSTRIES if o["id"] != i["id"])
    mark = f'<span class="ind-card-ic hero-ind rv">{ic(i["icon"], 30)}</span>'
    body = hero("Workflows · <b>" + e(i["tag"]) + "</b>", f'{e(i["name"])}, <br><span class="grad">handled</span>', e(i["pitch"]), mark=mark)
    body = body.replace('<div class="pill rv">', crumbs(("Industries", "/industries/"), (i["name"], None)) + '\n      <div class="pill rv">', 1)
    body += f"""
  <section class="section">
    <div class="ind-slide" style="border-top:0">
      <div class="ind-vis">
        <div class="ind-card">
          <div class="ind-card-top"><span class="ind-card-ic">{ic(i['icon'], 22)}</span><div><b>{e(i['name'])}</b><small>Example workflow</small></div></div>
          <div class="ind-flow">{flow}</div>
        </div>
      </div>
      <div class="ind-text">
        <span class="eyebrow">You ask</span>
        <p class="ind-quote">“{e(i['ask'])}”</p>
        <p>Titan plans it, the agents below do the work on your laptop, and anything that leaves it waits for your OK.</p>
      </div>
    </div>
  </section>
  <section class="section">
{sec_head('What Titan <span class="grad">takes off your plate</span>')}
    <div class="cap-grid cols-2">{uses}</div>
  </section>
  <section class="section">
{sec_head('The agents <span class="grad">on the job</span>')}
    <div class="card-row">{"".join(agent_card(AG[a]) for a in i["agents"])}</div>
  </section>
  <section class="section">
{sec_head('Your files <span class="grad">stay yours</span>')}
    {cap_grid([("lock", "On your laptop", "Documents, memory and app data stay in a local database."),
               ("shield", "Asks first", "Sending, publishing and deleting always wait for your approval."),
               ("cpu", "Local models only", "Mark confidential folders so nothing in them reaches a cloud model.")])}
  </section>
  <section class="section">
    <div class="pad"><span class="eyebrow">Other industries</span><div class="chip-links" style="margin-top:16px">{others}</div></div>
  </section>
{cta()}"""
    page(f"/industries/{i['id']}/", f"{i['name']} · Titan117", i["pitch"], body)


def faq_list(groups, scope=True):
    out = ""
    for gid, gname, qas in groups:
        items = "".join(f'<details data-cat="{gid}"><summary>{e(q)}{ic("plus")}</summary><p>{e(a)}</p></details>' for q, a in qas)
        out += f'<div class="faq-group" data-group="{gid}"><h3>{e(gname)}</h3><div class="faq-list">{items}</div></div>'
    return out


def faq_page():
    chips = '<button data-filter="all" aria-pressed="true">All</button>' + "".join(
        f'<button data-filter="{g}" aria-pressed="false">{e(n)}</button>' for g, n, _ in FAQ_GROUPS)
    body = hero("Help · FAQ", 'Questions, <span class="grad">answered</span>',
                "Everything small companies ask us about Titan117: privacy, models, credits, plans and setup.", ctas="")
    body += f"""
  <section class="section" data-filter-scope>
    <div class="pad">
      <div class="filter-bar">
        <label class="search">{ic("search")}<input type="search" placeholder="Search the questions" data-search aria-label="Search the questions"></label>
        <div class="chips" role="group" aria-label="Topics">{chips}</div>
      </div>
      <div class="faq-groups">{faq_list(FAQ_GROUPS)}</div>
      <p class="empty" data-empty hidden>No question matches that. Try another word, or <a href="/learn/">browse the guides</a>.</p>
    </div>
  </section>
{cta("Still unsure? <span class=\"grad\">Try it</span>", "Every plan includes every agent and unlimited local models.")}"""
    page("/faq/", "FAQ · Titan117", "Answers about Titan117: privacy, models, credits, plans, setup and remote control.", body)


def pricing_page():
    pricing_faq = [g for g in FAQ_GROUPS if g[0] in ("models", "pricing")]
    body = hero("Pricing · <b>No free plan, no surprises</b>", 'Simple pricing, <span class="grad">local is free</span>',
                "Every plan has every agent. Credits pay only for cloud models; local models, previews, tests and your own keys never cost a credit.", ctas="")
    body += f"""
  <section class="section" id="pricing">
    <div class="pad" style="padding-bottom:40px">
      <div class="billing" role="group" aria-label="Billing period">
        <button aria-pressed="true" data-bill="m">Monthly</button>
        <button aria-pressed="false" data-bill="y">Yearly<em>2 months free</em></button>
      </div>
    </div>
    <div class="pricing">
      <div class="plans" role="radiogroup" aria-label="Plans" id="plans"></div>
      <div class="includes" id="includes"></div>
    </div>
  </section>
  <section class="section">
{sec_head('Always <span class="grad">free</span>', "Included in every plan, without using a credit.")}
    {cap_grid([("cpu", "Local models", "Built in with llama.cpp. Unlimited, private, offline."),
               ("eye", "Previews", "Apps run and preview on your laptop."),
               ("bug", "Tests", "Browsers, emulators and virtual machines on your laptop."),
               ("file", "Documents", "Reading, OCR and local search of your folders."),
               ("key", "Your own keys", "Anything you run on your own OpenRouter, Anthropic, OpenAI or Google key."),
               ("record", "Replays", "Recorded automations replay without a model.")])}
  </section>
  <section class="section">
{sec_head('What a credit <span class="grad">buys</span>', "1 credit = €0.01 of cloud usage at our price: the provider's cost plus 25%. These are estimates for one typical app-builder edit.")}
    <div class="pad" style="padding-top:0">
      <div class="table-wrap rv"><table class="table">
        <thead><tr><th>Model used</th><th>Credits per edit</th><th>Edits from Pro's 1,500 credits</th></tr></thead>
        <tbody>
          <tr><td>Cheap open coder (DeepSeek, Qwen Coder)</td><td>about 2</td><td><b>about 750</b></td></tr>
          <tr><td>Strongest models</td><td>about 17</td><td><b>about 90</b></td></tr>
          <tr><td>Local model</td><td>0</td><td><b>unlimited</b></td></tr>
        </tbody>
      </table></div>
      <p class="note rv">Smart routing plans with a strong model and does bulk edits with cheaper or local ones, so most tasks land near the top row. Every task shows its estimate first and can be capped.</p>
    </div>
  </section>
  <section class="section">
{sec_head('Top-ups <span class="grad">when you need more</span>', "Top-up credits last 12 months while a paid plan is active.")}
    <div class="topups">
      <div class="topup rv"><span class="eyebrow">1,000 credits</span><b>€10</b><small>€0.010 per credit</small></div>
      <div class="topup rv"><span class="eyebrow">2,750 credits</span><b>€25</b><small>€0.009 per credit</small></div>
      <div class="topup rv"><span class="eyebrow">6,000 credits</span><b>€50</b><small>€0.0083 per credit</small></div>
    </div>
  </section>
  <section class="section">
{sec_head('Compare <span class="grad">plans</span>')}
    <div class="pad" style="padding-top:0">
      <div class="table-wrap rv"><table class="table compare">
        <thead><tr><th></th><th>Starter</th><th>Pro</th><th>Max</th><th>Custom</th></tr></thead>
        <tbody>
          <tr><td>Price a month</td><td>€15</td><td>€25</td><td>€50</td><td>Talk to us</td></tr>
          <tr><td>Price a year</td><td>€150</td><td>€250</td><td>€500</td><td>Custom</td></tr>
          <tr><td>Credits a month</td><td>700</td><td>1,500</td><td>3,500</td><td>Custom pool</td></tr>
          <tr><td>Local models, previews, tests</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
          <tr><td>All agents and the app builder</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td></tr>
          <tr><td>Your own keys and top-ups</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td></tr>
          <tr><td>Remote control and chat channels</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td><td>{ic("check")}</td></tr>
          <tr><td>Devices</td><td>2</td><td>3</td><td>5</td><td>Custom</td></tr>
          <tr><td>Teams, roles, audit log, SSO</td><td>—</td><td>—</td><td>—</td><td>{ic("check")}</td></tr>
          <tr><td>Agency and white-label</td><td>—</td><td>—</td><td>—</td><td>{ic("check")}</td></tr>
          <tr><td>Support</td><td>Email</td><td>Email</td><td>Priority</td><td>Dedicated</td></tr>
        </tbody>
      </table></div>
      <p class="note rv">Prices are before VAT and the same in euro and US dollar. Monthly credits roll over for one month. Upgrades start at once, prorated; downgrades at the next period. Unused top-ups are refundable within 14 days.</p>
    </div>
  </section>
  <section class="section">
    <div class="pad"><div class="faq">
      <div class="sec-head" style="margin-bottom:0; align-content:start"><h2 class="h2 rv">Pricing questions</h2><p class="lead rv">More in the <a class="text-link" href="/faq/">full FAQ</a>.</p></div>
      <div>{faq_list(pricing_faq)}</div>
    </div></div>
  </section>
{cta()}"""
    page("/pricing/", "Pricing · Titan117", "Titan117 plans from €15 a month: every agent included, local models free and unlimited, credits for cloud models.", body)


def lesson_card(l):
    slug, track, title, summary, minutes, level, steps, _ = l
    return f"""<a class="lesson-card" href="/learn/{slug}/" data-cat="{track}">
        <span class="lesson-thumb">{ic("play")}<em>{minutes} min</em></span>
        <span class="eyebrow">{e(TRACK[track])}</span>
        <h3>{e(title)}</h3>
        <p>{e(summary)}</p>
        <span class="lesson-meta"><span>{ic("video")}Video</span><span>{ic("book")}{len(steps)} steps</span><span>{e(level)}</span></span>
      </a>"""


def video_band(src, label="The video for this guide is coming soon."):
    return f"""<div class="video-stage">
      <video playsinline preload="none" data-src="{src}"></video>
      <button class="video-play" type="button" aria-label="Play the video">{ic("play")}</button>
      <button class="video-close" type="button" aria-label="Close the video">{ic("x")}</button>
      <p class="video-note" role="status">{e(label)}</p>
    </div>"""


def learn_page():
    chips = '<button data-filter="all" aria-pressed="true">All</button>' + "".join(
        f'<button data-filter="{t}" aria-pressed="false">{e(n)}</button>' for t, n in LEARN_TRACKS)
    body = hero("Learn · <b>Guides and videos</b>", 'Learn <span class="grad">Titan117</span>',
                "Short guides with step-by-step instructions and a video for each, from your first task to building apps and automations.", ctas="")
    body += f"""
  <section class="section">
    <div class="with-head" style="padding-bottom:40px">
      <span class="eyebrow">Start here</span>
      <h2 class="h2 rv" style="margin-top:12px">A tour of <span class="grad">the whole app</span></h2>
      <p class="lead rv" style="margin-top:16px">Ten minutes: install, models, your first task, approvals, and where every agent lives.</p>
    </div>
    {video_band("/assets/learn/tour.mp4", "The tour video is coming soon.")}
  </section>
  <section class="section" data-filter-scope>
    <div class="pad">
      <div class="filter-bar">
        <label class="search">{ic("search")}<input type="search" placeholder="Search the guides" data-search aria-label="Search the guides"></label>
        <div class="chips" role="group" aria-label="Topics">{chips}</div>
      </div>
    </div>
    <div class="lesson-grid">{"".join(lesson_card(l) for l in LESSONS)}</div>
    <p class="empty pad" data-empty hidden>No guide matches that yet. Try another word, or <a href="/faq/">check the FAQ</a>.</p>
  </section>
{cta('Ready to <span class="grad">try it</span>?', "Download Titan117 and follow along with the first guide.")}"""
    page("/learn/", "Learn · Titan117", "Guides and videos for Titan117: install, models, your first task, approvals, memory, agents, automations and remote control.", body)


def lesson_page(k, l):
    slug, track, title, summary, minutes, level, steps, tips = l
    prev_l = LESSONS[k - 1] if k > 0 else None
    next_l = LESSONS[k + 1] if k + 1 < len(LESSONS) else None
    in_track = [x for x in LESSONS if x[1] == track]
    current = ' aria-current="page"'
    side = "".join(f'<a href="/learn/{x[0]}/"{current if x[0] == slug else ""}>{ic("play")}<span>{e(x[2])}<small>{x[4]} min</small></span></a>' for x in in_track)
    steps_html = "".join(f'<li class="rv"><span class="num">{n + 1}</span><div><h3>{e(t)}</h3><p>{e(d)}</p></div></li>' for n, (t, d) in enumerate(steps))
    tips_html = "".join(f"<li>{ic('sparkles')}{e(t)}</li>" for t in tips)
    pager = ""
    if prev_l:
        pager += f'<a class="pager-link" href="/learn/{prev_l[0]}/">{ic("left")}<span><small>Previous</small>{e(prev_l[2])}</span></a>'
    else:
        pager += "<span></span>"
    if next_l:
        pager += f'<a class="pager-link next" href="/learn/{next_l[0]}/"><span><small>Next</small>{e(next_l[2])}</span>{ic("right")}</a>'
    body = f"""  <section class="section">
    <div class="lesson-head pad">
      {crumbs(("Learn", "/learn/"), (TRACK[track], "/learn/"), (title, None))}
      <h1 class="h2 rv">{e(title)}</h1>
      <p class="lead rv">{e(summary)}</p>
      <div class="lesson-meta rv"><span>{ic("time")}{minutes} min</span><span>{ic("video")}Video</span><span>{ic("book")}{len(steps)} steps</span><span>{e(level)}</span></div>
    </div>
    {video_band(f"/assets/learn/{slug}.mp4")}
  </section>
  <section class="section">
    <div class="lesson">
      <div class="lesson-body pad">
        <h2 class="h3">Step by step</h2>
        <ol class="lesson-steps">{steps_html}</ol>
        <div class="tips rv"><b>Good to know</b><ul>{tips_html}</ul></div>
        <div class="pager">{pager}</div>
      </div>
      <aside class="lesson-side pad">
        <span class="eyebrow">{e(TRACK[track])}</span>
        <div class="side-list">{side}</div>
        <a class="link-more" href="/learn/" style="margin-top:20px">All guides {ic("arrow")}</a>
      </aside>
    </div>
  </section>
{cta()}"""
    page(f"/learn/{slug}/", f"{title} · Learn Titan117", summary, body)


# ---------- the hand-written homepage ----------

def refresh_home():
    p = ROOT / "index.html"
    s = p.read_text(encoding="utf-8")
    parts = {"icons": SPRITE, "header": header(), "footer": footer()}
    for name, block in parts.items():
        s, n = re.subn(rf"<!-- @{name} -->.*?<!-- /@{name} -->", lambda m: f"<!-- @{name} -->\n{block}\n<!-- /@{name} -->", s, flags=re.S)
        assert n == 1, f"marker @{name} missing in index.html"
    s = re.sub(r"<body[^>]*>", '<body data-page="home" data-root="">', s, count=1)
    p.write_text(relativize(s, 0), encoding="utf-8")


if __name__ == "__main__":
    refresh_home()
    agents_index()
    for a in AGENTS:
        agent_page(a)
    industries_index()
    for i in INDUSTRIES:
        industry_page(i)
    pricing_page()
    faq_page()
    learn_page()
    for k, l in enumerate(LESSONS):
        lesson_page(k, l)
    print("built", 3 + len(AGENTS) + len(INDUSTRIES) + len(LESSONS) + 3, "pages and refreshed index.html")
