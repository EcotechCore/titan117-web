# Builds the new TITAN117 mockups (1 Nov 2026) from content.py into the parent folder:
# index, agents, pricing, security, industries/*.html and assets/data.js. The desktop app is desktop.html.
#
#     cd new-mockups/src
#     python build.py
import json, os, html, re
from content import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
E = html.escape
AG = {a['id']: a for a in AGENTS}
IND = {d['id']: d for d in INDUSTRIES}
def n2(i): return '%02d' % i

# ───────── small pieces ─────────
ICON20 = {
  'laptop':'<rect x="3" y="4" width="14" height="9" rx="1"/><path d="M1.5 16h17"/>',
  'shield':'<path d="M10 2 3.5 4.5v5c0 4 2.8 7 6.5 8.5 3.7-1.5 6.5-4.5 6.5-8.5v-5z"/><path d="m7 10 2 2 4-4"/>',
  'coin':'<circle cx="10" cy="10" r="7.5"/><path d="M12.5 7.2a3 3 0 1 0 0 5.6M6 9h5M6 11h5"/>',
  'offline':'<path d="M3 7.5a10 10 0 0 1 14 0M5.5 10.3a6.3 6.3 0 0 1 9 0M8.2 13a2.6 2.6 0 0 1 3.6 0"/><path d="M3 3l14 14"/>',
  'screen':'<rect x="2.5" y="3" width="15" height="11" rx="1.5"/><path d="M7 17h6M10 14v3"/>',
}
WIN = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 2.6 6.6 1.8v5.4H1zm6.4-.9L15 .6v6.6H7.4zM1 8h5.6v5.4L1 12.6zm6.4 0H15v6.6l-7.6-1.1z"/></svg>'
MAC = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M11.2 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6C4.4 4.8 3.3 5.5 2.7 6.6c-1.2 2.1-.3 5.2.9 6.9.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5c.9 0 1.5-.8 2-1.7.7-.9.9-1.8.9-1.9 0 0-1.8-.7-1.8-3.1ZM9.6 3.6c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.5-.4 2-1Z"/></svg>'
ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4 12.5 8l-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHEV = '<svg class="chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 3.75 5 6.25l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
def svg20(k): return '<svg viewBox="0 0 20 20">%s</svg>' % ICON20[k]
def ind_svg(i): return '<svg class="lic" viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % IND_ICON[i]

def head(title, desc, r):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Unbounded:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{r}assets/site.css">
</head>
<body>
'''

def nav(r, active=''):
    def a(href, label, key):
        cur = ' aria-current="page"' if key == active else ''
        return f'<a href="{r}{href}"{cur}>{label}</a>'
    menu = ''.join(f'<a href="{r}industries/{d["id"]}.html">{ind_svg(d["id"])}<span><b>{E(d["name"])}</b><small>{E(d["d"])}</small></span></a>' for d in INDUSTRIES)
    sheet_ind = ''.join(f'<a href="{r}industries/{d["id"]}.html">{E(d["name"])}</a>' for d in INDUSTRIES)
    ind_cur = ' aria-current="page"' if active == 'industries' else ''
    return f'''<header class="nav" id="nav">
  <div class="nav__in">
    <a class="brand" href="{r}index.html" aria-label="TITAN117 home"><svg class="bot" data-bot="nav" aria-hidden="true"></svg>TITAN117</a>
    <nav class="nav__links" aria-label="Main">
      {a('index.html#how', 'How it works', 'how')}
      {a('agents.html', 'Agents', 'agents')}
      <div class="dd"><button class="dd__btn" type="button" aria-expanded="false" aria-haspopup="true"{ind_cur}>Industries{CHEV}</button>
        <div class="dd__menu">{menu}</div></div>
      {a('security.html', 'Security', 'security')}
      {a('pricing.html', 'Pricing', 'pricing')}
      {a('desktop.html', 'Desktop app', 'desktop')}
    </nav>
    <div class="nav__end">
      <a class="btn btn--ink" href="{r}pricing.html">Download</a>
      <button class="burger" type="button" aria-label="Open the menu" aria-expanded="false" aria-controls="sheet"><span></span><span></span></button>
    </div>
  </div>
  <div class="sheet" id="sheet">
    <div class="sheet__in">
      <a href="{r}index.html#how">How it works</a><a href="{r}agents.html">Agents</a><a href="{r}security.html">Security</a><a href="{r}pricing.html">Pricing</a><a href="{r}desktop.html">Desktop app</a>
      <span class="sheet__label">Industries</span>
      <div class="sheet__ind">{sheet_ind}</div>
      <a class="btn btn--ink btn--lg" href="{r}pricing.html">{WIN}Download for Windows</a>
    </div>
  </div>
</header>
'''

def foot(r):
    inds = ''.join(f'<a href="{r}industries/{d["id"]}.html">{E(d["name"])}</a>' for d in INDUSTRIES)
    return f'''<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="{r}index.html"><svg class="bot" data-bot="foot" data-ink="#ffffff" aria-hidden="true"></svg>TITAN117</a>
        <p style="margin-top:14px;max-width:300px">AI teammates for small companies, on your own laptop.</p>
      </div>
      <div><h4>Product</h4><a href="{r}index.html#how">How it works</a><a href="{r}agents.html">Agents</a><a href="{r}desktop.html">Desktop app</a><a href="{r}security.html">Security</a><a href="{r}pricing.html">Pricing</a></div>
      <div><h4>Industries</h4>{inds}</div>
      <div><h4>Company</h4><a href="{r}index.html">About</a><a href="{r}index.html">Privacy</a><a href="{r}index.html">Terms</a><a href="{r}index.html">Contact</a></div>
    </div>
    <div class="foot__base"><span>© 2026 TITAN117 · mockup with fictional example data</span><span class="mono">Windows · macOS</span></div>
  </div>
</footer>
'''

def scripts(r, page):
    return f'''<script>window.ROOT = "{r}"; window.PAGE = "{page}";</script>
<script src="{r}assets/bot.js"></script>
<script src="{r}assets/data.js"></script>
<script src="{r}assets/led.js"></script>
<script src="{r}assets/site.js"></script>
</body>
</html>
'''

def end_band(r, h='Give Titan the first task.', p='Install it, point it at a folder and ask. You approve every step.'):
    return f'''<section class="end">
  <div class="end__stage">
    <canvas data-endled aria-hidden="true"></canvas>
    <div class="end__copy" data-equiet>
      <h2 class="h2">{E(h)}</h2>
      <p>{E(p)}</p>
      <div class="end__actions"><span class="cta"><a class="btn btn--ink btn--lg" href="{r}pricing.html">{WIN}Download for Windows</a></span><a class="btn btn--gray btn--lg" href="{r}pricing.html">{MAC}macOS</a></div>
    </div>
  </div>
</section>
'''

def sec_head(label, g, h, p='', dark=False):
    pp = f'<p>{E(p)}</p>' if p else ''
    return f'''<div class="head rv">
      <span class="label" data-scramble>{E(label)}</span>
      <div><h2><span class="g">{E(g)}</span> {E(h)}</h2>{pp}</div>
    </div>'''

def phead(label, g, h, p, actions, scene, corner):
    """A page head: copy on the left, a square LED panel on the right that cycles through `scene` (icon ids)."""
    return f'''<section class="phead">
  <div class="wrap phead__in">
    <div class="phead__copy">
      <span class="label" data-scramble>{E(label)}</span>
      <h1><span class="g">{E(g)}</span> {E(h)}</h1>
      <p>{E(p)}</p>
      <div class="phead__actions">{actions}</div>
    </div>
    <div class="phead__panel">
      <canvas data-ledscene="{','.join(scene)}" aria-hidden="true"></canvas>
      <span class="corner" data-scene-n>01 / {n2(len(scene))}</span><span class="corner2" data-scene-name>{E(corner)}</span>
    </div>
  </div>
</section>
'''

def faq(items, open_first=True):
    return '<div class="faq">' + ''.join(f'<details{" open" if (i == 0 and open_first) else ""}><summary>{E(q)}</summary><p>{E(a)}</p></details>' for i, (q, a) in enumerate(items)) + '</div>'

def faq_band(label, items, bg=True):
    return f'''<section class="band{' band--bg' if bg else ''}" id="faq">
  <div class="wrap">
    <div class="head rv">
      <span class="label" data-scramble>{E(label)}</span>
      {faq(items)}
    </div>
  </div>
</section>
'''

def plans_html(r, toggle=False):
    out = []
    for i, x in enumerate(PLANS):
        pop = ' is-pop' if x.get('pop') else ''
        if x['m']:
            price = f'<span data-m="€{x["m"]}" data-y="€{x["y"]}">€{x["m"]}</span><small data-m=" / month" data-y=" / year"> / month</small>'
            li = [f'<b>{x["cr"]:,}</b> credits a month', 'Unlimited local models, previews, tests', 'All agents and the app builder', f'{x["dev"]} devices', x['sup']]
            btn = f'<a class="btn {"btn--neon" if x.get("pop") else "btn--ink"}" href="{r}desktop.html">Choose {x["n"]}</a>'
        else:
            price = '<span style="font-size:32px">Talk to us</span>'
            li = ['Shared credit pool', 'Teams, roles, audit log, SSO', 'Agency and white-label', 'Dedicated support']
            btn = f'<a class="btn btn--ghost" href="{r}pricing.html">Contact sales</a>'
        em = '<em>Most picked</em>' if x.get('pop') else ''
        d = f' rv-d{min(3, i)}' if i else ''
        out.append(f'<div class="plan rv{d}{pop}"><div class="plan__n">{x["n"]}{em}</div><div class="plan__p">{price}</div><div class="plan__b">{E(x["blurb"])}</div><ul>' +
                   ''.join(f'<li><span>{l}</span></li>' for l in li) + f'</ul>{btn}</div>')
    tg = '<div class="billing" role="group" aria-label="Billing period"><button type="button" class="is-on" data-bill="m">Monthly</button><button type="button" data-bill="y">Yearly <em>2 months free</em></button></div>' if toggle else ''
    return tg + '<div class="plans" id="plans">' + ''.join(out) + '</div>'

def agent_card(a, i, r, tag='a'):
    d = f' rv-d{i % 3}' if i % 3 else ''
    bl = ''.join(f'<li>{E(b)}</li>' for b in a['bullets'])
    return (f'<{tag} class="acard rv{d}" style="--c:{a["c"]}" href="{r}agents.html#{a["id"]}"><div class="acard__top"><span class="acard__name"><i></i>{E(a["name"])}</span><span>{n2(i + 1)}</span></div>'
            f'<div class="acard__glyph" data-led="{a["id"]}"><canvas aria-hidden="true"></canvas></div><h3>{E(a["title"])}</h3><ul>{bl}</ul></{tag}>')

def write(path, s):
    full = os.path.join(ROOT, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8', newline='\n').write(s)
    print('wrote', path, len(s))

# ───────── home ─────────
def page_home():
    r = ''
    main = open(os.path.join(os.path.dirname(__file__), 'home-main.html'), encoding='utf-8').read()
    promises = ''.join(f'<span>{svg20(k)}{E(t)}</span>' for k, t in PROMISES)
    cards = ''.join(agent_card(AG[k], i, r) for i, k in enumerate(GRID_AGENTS))
    trust = ''.join(f'<div class="tcard rv{" rv-d%d" % (i % 3) if i % 3 else ""}"><div class="ico" data-led="{t[2]}"><canvas aria-hidden="true"></canvas></div><h3>{E(t[0])}</h3><p>{E(t[1])}</p></div>' for i, t in enumerate(TRUST))
    main = (main.replace('{{PROMISES}}', promises).replace('{{AGENT_CARDS}}', cards).replace('{{TRUST}}', trust)
                .replace('{{PLANS}}', plans_html(r)).replace('{{FAQ}}', faq(FAQ_HOME)).replace('{{END}}', end_band(r)).replace('{{WIN}}', WIN))
    write('index.html', head('TITAN117 · AI teammates on your laptop', 'A desktop app for small companies. Titan and specialist agents work on your own laptop, and nothing happens until you approve it.', r)
          + nav(r, '') + '<main id="top">\n' + main + '\n</main>\n' + foot(r) + scripts(r, 'home'))

# ───────── agents ─────────
def page_agents():
    r = ''
    order = [a['id'] for a in AGENTS]
    chips = ''.join(f'<a href="#{a["id"]}" style="--c:{a["c"]}"><i></i>{E(a["name"])}</a>' for a in AGENTS)
    secs = []
    for i, a in enumerate(AGENTS):
        bl = ''.join(f'<li>{E(b)}</li>' for b in a['bullets'])
        inds = [d for d in INDUSTRIES if any(u['agent'] == a['id'] for u in d['uses'])]
        used = ('<div class="asec__used"><span class="mono">Used in</span>' + ''.join(f'<a href="{r}industries/{d["id"]}.html">{E(d["name"])}</a>' for d in inds[:4]) + '</div>') if inds else ''
        flip = ' asec--flip' if i % 2 else ''
        bg = ' band--bg' if i % 2 else ''
        secs.append(f'''<section class="asec{flip}{bg}" id="{a['id']}" style="--c:{a['c']}">
  <div class="wrap asec__in">
    <div class="asec__copy rv">
      <span class="label">{n2(i + 1)} / {n2(len(AGENTS))}</span>
      <span class="asec__eyebrow"><i></i>{E(a['eyebrow'])}</span>
      <h2 class="h2">{E(a['title'])}</h2>
      <p>{E(a['text'])}</p>
      <ul class="ticks">{bl}</ul>
      {used}
    </div>
    <div class="asec__demo rv rv-d1">
      <div class="asec__led" data-led="{a['id']}" data-ink="{a['c'] if a['id'] != 'titan' else '#0d0d0d'}"><canvas aria-hidden="true"></canvas></div>
      <div class="demo" data-demo="{a['id']}"></div>
    </div>
  </div>
</section>''')
    acts = f'<span class="cta"><a class="btn btn--ink btn--lg" href="{r}pricing.html">{WIN}Download for Windows</a></span><a class="btn btn--gray btn--lg" href="#titan">Meet the team</a>'
    body = (phead('Agents', 'Ten specialists. One memory.', 'All of them ask first.',
                  'Titan plans the work and hands parts of it to specialist agents. They share what they learn, run on your laptop, and wait for your approval before they act. Every demo below is live: click around.',
                  acts, ['titan'] + [x for x in order if x not in ('titan',)], 'the team')
            + f'<nav class="chips" aria-label="Agents"><div class="wrap chips__in">{chips}</div></nav>\n' + '\n'.join(secs) + end_band(r, 'Hire the whole team.', 'Every agent comes with every plan. Start with Titan and add the rest when the work grows.'))
    write('agents.html', head('Agents · TITAN117', 'Titan and nine specialist agents that share one memory, run on your laptop and ask before they act.', r)
          + nav(r, 'agents') + '<main id="top">\n' + body + '\n</main>\n' + foot(r) + scripts(r, 'agents'))

# ───────── pricing ─────────
def page_pricing():
    r = ''
    acts = f'<span class="cta"><a class="btn btn--ink btn--lg" href="#plans">See the plans</a></span><a class="btn btn--gray btn--lg" href="#credits">How credits work</a>'
    cols = ['Starter', 'Pro', 'Max', 'Custom']
    def cell(v):
        if v == 'y': return '<td><span class="yes" aria-label="Included">✓</span></td>'
        if v == '-': return '<td><span class="no" aria-label="Not included">–</span></td>'
        return f'<td>{E(v)}</td>'
    rows = [['Price a month', '€15', '€25', '€50', 'Talk to us'], ['Price a year', '€150', '€250', '€500', 'Custom']] + COMPARE
    table = ('<div class="tbl-scroll rv"><table class="cmp"><thead><tr><th>Feature</th>' + ''.join(f'<th{" class=pop" if c == "Pro" else ""}>{c}</th>' for c in cols) + '</tr></thead><tbody>' +
             ''.join('<tr><th scope="row">' + E(rw[0]) + '</th>' + ''.join(cell(v) for v in rw[1:]) + '</tr>' for rw in rows) + '</tbody></table></div>')
    est = ''.join(f'<div class="est__row"><span>{E(t)}</span><span class="mono est__cr">{c} cr</span><div class="step-in"><button type="button" data-d="-1" aria-label="Fewer">−</button><output data-cr="{c}">{2 if i < 2 else 1}</output><button type="button" data-d="1" aria-label="More">+</button></div></div>' for i, (t, c) in enumerate(ESTIMATES))
    topups = ''.join(f'<div class="topup rv{" rv-d%d" % i if i else ""}"><b>{a}</b><span class="topup__p">{b}</span><small class="mono">{c}</small></div>' for i, (a, b, c) in enumerate(TOPUPS))
    roll = ''.join(f'<li><b>{E(a)}</b><span>{E(b)}</span></li>' for a, b in ROLLOVER)
    body = (phead('Pricing', 'Every agent', 'on every plan.', 'Choose a plan for the cloud credits you need. Local models, previews, tests and your own API keys never use credits.',
                  acts, ['credits', 't2', 'models', 't4'], 'credits')
            + f'''<section class="band" id="plans-band">
  <div class="wrap">
    {plans_html(r, toggle=True)}
    <p class="note">Prices are before VAT, added at checkout where it applies. EUR and USD, with the same numbers in both. No free plan and no trial.</p>
  </div>
</section>
<section class="band band--dark" id="credits">
  <div class="wrap">
    {sec_head('01 · Credits', 'Know what a month of work costs.', 'Cloud models at the provider’s cost plus 25%.', 'Smart routing, with a strong planner and a cheap coder, makes credits go further. 1 credit is €0.01, and every task shows its estimate first.')}
    <div class="est rv">
      <div class="est__list"><div class="est__hd mono"><span>Typical task</span><span>Credits</span><span>Per week</span></div>{est}</div>
      <div class="est__out">
        <span class="label">Your month</span>
        <div class="est__n"><b id="estN">0</b><small>credits</small></div>
        <div class="est__bar"><i id="estBar"></i></div>
        <p id="estPlan">Starter covers it.</p>
        <small>About 4.3 weeks a month. Local models and your own keys add nothing.</small>
      </div>
    </div>
  </div>
</section>
<section class="band" id="compare">
  <div class="wrap">
    {sec_head('02 · Compare plans', 'Everything', 'in each plan.')}
    {table}
  </div>
</section>
<section class="band band--bg" id="topups">
  <div class="wrap">
    {sec_head('03 · Top-ups and rollover', 'Need more?', 'Top up any time.', 'Top-up credits never expire while a plan is active, for up to 12 months.')}
    <div class="topups">{topups}</div>
    <ul class="roll rv">{roll}</ul>
  </div>
</section>
''' + faq_band('04 · Questions', FAQ_PRICING, bg=False) + end_band(r, 'Put Titan to work.', 'Download, sign in, and give it its first task. Nothing else to install.'))
    write('pricing.html', head('Pricing · TITAN117', 'Every agent on every plan. Credits pay for cloud models at the provider\'s cost plus 25%; local models are free.', r)
          + nav(r, 'pricing') + '<main id="top">\n' + body + '\n</main>\n' + foot(r) + scripts(r, 'pricing'))

# ───────── security ─────────
def page_security():
    r = ''
    acts = f'<span class="cta"><a class="btn btn--ink btn--lg" href="{r}pricing.html">{WIN}Download for Windows</a></span><a class="btn btn--gray btn--lg" href="#faq">Security FAQ</a>'
    where = ''
    for i, w in enumerate(WHERE):
        never = f'<li class="never">{E(w["never"])}</li>' if w.get('never') else ''
        where += (f'<div class="where rv{" rv-d%d" % i if i else ""}"><div class="ico" data-led="{w["icon"]}"><canvas aria-hidden="true"></canvas></div><h3>{E(w["t"])}</h3><ul>' +
                  ''.join(f'<li>{E(x)}</li>' for x in w['items']) + never + '</ul></div>')
    safe = ''.join(f'<div class="tcard rv{" rv-d%d" % (i % 4) if i % 4 else ""}"><div class="ico" data-led="{t[2]}"><canvas aria-hidden="true"></canvas></div><h3>{E(t[0])}</h3><p>{E(t[1])}</p></div>' for i, t in enumerate(SAFEGUARDS))
    body = (phead('Security', 'Your company data', 'stays on your laptop.', 'Titan runs where your files are. Our cloud keeps your account, and nothing happens on your machine until you approve it.',
                  acts, ['t0', 't1', 't3', 't4', 't5'], 'local-first')
            + f'''<section class="band" id="where">
  <div class="wrap">
    {sec_head('01 · Where data lives', 'Know exactly what goes where.', 'Three places your data can be, and what each one holds.')}
    <div class="wheres">{where}</div>
  </div>
</section>
<section class="band band--dark" id="approval">
  <div class="wrap split">
    <div class="split__copy rv">
      <span class="label">02 · Approval layer</span>
      <h2 class="h2"><span class="g">Nothing happens</span> until you say yes.</h2>
      <p>Every file, shell command, website and email goes through one approval layer. Set rules for what is always fine, and give each task a credit budget it can't go past. Try it: allow or deny the actions on the right.</p>
      <ul class="ticks ticks--dark"><li>Approve once, or set a rule for next time</li><li>Emails and sign-ins always ask</li><li>Web pages are read as data, never as instructions</li><li>Budgets cap what any task can spend</li></ul>
    </div>
    <div class="split__demo rv rv-d1"><div class="demo" data-demo="titan"></div></div>
  </div>
</section>
<section class="band band--bg" id="built-in">
  <div class="wrap">
    {sec_head('03 · Built in', 'Safeguards in every part of the app.', 'Not settings to find later: they are on from the first task.')}
    <div class="trust trust--4">{safe}</div>
  </div>
</section>
''' + faq_band('04 · Questions', FAQ_SECURITY, bg=False) + end_band(r, 'Keep your company on your laptop.', 'Install it, mark what stays local, and approve every step.'))
    write('security.html', head('Security · TITAN117', 'Your company data stays on your laptop. One approval layer, local-only folders, keys in your keychain.', r)
          + nav(r, 'security') + '<main id="top">\n' + body + '\n</main>\n' + foot(r) + scripts(r, 'security'))

# ───────── industries ─────────
def page_industry(k, d):
    r = '../'
    acts = f'<span class="cta"><a class="btn btn--ink btn--lg" href="{r}pricing.html">{WIN}Download for Windows</a></span><a class="btn btn--gray btn--lg" href="#uses">See it work</a>'
    scene = [d['id']] + list(dict.fromkeys(u['agent'] for u in d['uses']))
    hl = ''.join(f'<div class="tcard rv{" rv-d%d" % i if i else ""}"><span class="tcard__n mono">{n2(i + 1)}</span><h3>{E(a)}</h3><p>{E(b)}</p></div>' for i, (a, b) in enumerate(d['hl']))
    flow = '<i>──▶</i>'.join(f'<div><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in d['flow'])
    tabs = ''.join(f'<button class="utab{" is-on" if i == 0 else ""}" type="button" role="tab" aria-selected="{"true" if i == 0 else "false"}" data-use="{i}" style="--c:{AG[u["agent"]]["c"]}"><span class="utab__n mono">{n2(i + 1)}</span><span><b>{E(u["t"])}</b><small>{E(u["d"])}</small><em><i></i>{E(AG[u["agent"]]["name"])}</em></span></button>' for i, u in enumerate(d['uses']))
    others = ''.join(f'<a class="ocard" href="{o["id"]}.html">{ind_svg(o["id"])}<b>{E(o["name"])}</b><span>{E(o["d"])}</span></a>' for o in INDUSTRIES if o['id'] != k)
    body = (phead('Industries · ' + d['name'], '', d['h'], d['s'], acts, scene, d['id'])
            + f'''<section class="band" id="highlights">
  <div class="wrap">
    {sec_head('01 · What changes', 'Three things', 'that stop eating your week.')}
    <div class="trust">{hl}</div>
    <div class="flow flow--page rv">{flow}</div>
  </div>
</section>
<section class="band band--bg" id="uses">
  <div class="wrap">
    {sec_head('02 · In practice', 'Four tasks,', 'start to finish. Click one to run it.')}
    <div class="uses2 rv" data-ind="{d['id']}">
      <div class="uses2__tabs" role="tablist" aria-label="Tasks">{tabs}</div>
      <div class="demo" data-demo="ind:{d['id']}:0"></div>
    </div>
  </div>
</section>
<section class="band band--dark" id="local">
  <div class="wrap split split--local">
    <div class="split__copy rv">
      <span class="label">03 · Stays local</span>
      <h2 class="h2"><span class="g">Your data,</span> on your laptop.</h2>
      <p>{E(d['local'])}</p>
      <a class="btn btn--white" href="{r}security.html">How security works{ARROW}</a>
    </div>
    <div class="split__led rv rv-d1"><canvas data-ledscene="t0,t1,t3" data-dark="1" aria-hidden="true"></canvas></div>
  </div>
</section>
''' + faq_band('04 · Questions', d['faq'], bg=False) + f'''<section class="band band--bg" id="more">
  <div class="wrap">
    {sec_head('05 · Other industries', 'Not quite your company?', 'Titan works the same way across all of them.')}
    <div class="others">{others}</div>
  </div>
</section>
''' + end_band(r))
    write(f'industries/{k}.html', head(f'{d["name"]} · TITAN117', d['s'], r) + nav(r, 'industries') + '<main id="top">\n' + body + '\n</main>\n' + foot(r) + scripts(r, 'industry'))

# ───────── desktop app ─────────
def page_desktop():
    write('desktop.html', '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TITAN117 Desktop</title>
<meta name="description" content="The TITAN117 desktop app: a clickable mockup in light and dark themes.">
<script>try{var p=localStorage.getItem('titan.theme')||'system';document.documentElement.dataset.theme=(p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Unbounded:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/desktop.css">
</head>
<body>
<noscript><p style="padding:24px;font-family:system-ui">This mockup needs JavaScript.</p></noscript>
<script src="assets/bot.js"></script>
<script src="assets/data.js"></script>
<script src="assets/led.js"></script>
<script src="assets/desktop.js"></script>
</body>
</html>
''')

# ───────── data for the scripts ─────────
def data_js():
    data = {'AGENTS': AGENTS, 'GRID_AGENTS': GRID_AGENTS, 'INDUSTRIES': INDUSTRIES, 'IND_ICON': IND_ICON, 'LED_ICON': LED_ICON, 'APPROVALS': APPROVALS,
            'MODELS': MODELS, 'AGENT_DEMO': AGENT_DEMO, 'ESTIMATES': ESTIMATES, 'PLANS': PLANS}
    s = '/* generated by src/build.py from src/content.py: do not edit */\n' + ''.join(f'var {k} = {json.dumps(v, ensure_ascii=False)};\n' for k, v in data.items())
    s += 'var AGENT_BY = {}; AGENTS.forEach(function(a){ AGENT_BY[a.id] = a; });\n'
    write('assets/data.js', s)

if __name__ == '__main__':
    data_js()
    page_home(); page_agents(); page_pricing(); page_security(); page_desktop()
    for k, d in IND.items(): page_industry(k, d)
