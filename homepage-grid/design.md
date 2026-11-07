# design.md · Titan117 website

Version 1.0 · 7 Nov 2026

The design system of the Titan117 website, written from the finished site in `homepage-grid/` (decisions §18). Every new page follows it. The desktop app keeps its own rules in [`docs/notes/design.md`](../docs/notes/design.md) §8; the app *window* shown on the website follows §7 below.

**Origin.** The layout follows the structure of the Atomist Next.js/shadcn template (framed grid, gradient headlines, tabbed product stage, bordered tile grids). Code, copy and assets are our own.

---

## 1. Principles

1. **One frame.** Every page sits in a 1200px column with hairline borders left and right. Sections are stacked bands separated by a hairline. Inside a band, grids are divided by hairlines, not gaps.
2. **White, gray, black, and one tomato.** Neutrals do the work. Tomato marks what's alive or important: the second half of a headline, a running step, the one primary action, a status.
3. **Show the product.** Every claim gets a picture of the app doing it: the app window, a task, an approval. No stock photos, no invented customers, logos, testimonials or metrics.
4. **Honest content.** Only features in the feature map and integrations the roadmap and decisions commit to (§10).
5. **Calm motion.** Things fade in once, eyes look around, one light runs round the download button. Everything stops under reduced motion.

## 2. Colour

Tokens live on `:root` in `styles.css`; dark mode redefines them under `:root[data-theme="dark"]`. The theme follows the system until the visitor toggles it (saved as `t117-theme`).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0b0b0b` | Page |
| `--fg` | `#0a0a0a` | `#f4f4f4` | Text, headings |
| `--muted` | `#f5f5f5` | `#151515` | Selected rows, intro tiles |
| `--muted-fg` | `#6b6b6b` | `#9a9a9a` | Secondary text |
| `--border` | `#e6e6e6` | `#262626` | Every hairline |
| `--tile` | `#f4f4f5` | `#161618` | Hover panels, icon tiles, cards on hover (the app sidebar's gray) |
| `--tile-dots` | `#d4d4d8` | `#34343a` | Dot grids inside tiles |
| `--dots` | `#c4c4c4` | `#3d3d3d` | Hero and closing dot grids |
| `--accent` | `#ff6347` | same | Tomato: the brand colour. Change it here to rebrand the whole site |
| `--accent-deep` | `#c2361f` | — | Tomato text on white (labels, numbers) |
| `--accent-soft` | `#ffece8` | `#2e1310` | Tomato tints (tips, icon tiles) |

**Agent colours** (eyes, dots, dropdown icons): Titan `#ff6347`, Folder agent `#2f6fed`, Recorder `#14a37f`, Web watcher `#8b5cf6`, App builder `#f6a825`, Code builder `#0db5ed`, QA `#2a9a30`, Marketing `#ec4899`, SEO `#7c3aed`, Promo video `#e24b4a`. Used only for an agent's own eyes, dot or icon, never for text blocks.

**Gradient headline** (`.grad`): `linear-gradient(90deg, var(--fg) -20%, var(--accent) 85%, #f6c79d 105%)` clipped to text. Use it on the second half of every section heading.

**Warm bands**: the tomato blur (three radial gradients over `#1a0f0d`, blurred 40px, drifting 14s) with a white dot overlay (18px). Used for the video band and "Meet the agents". The light version (pale tomato radial gradients over `#f6e5e1`) sits behind the app window.

## 3. Typography

| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Wordmark `TITAN117` | Unbounded | 14px | 600 | .04em, uppercase |
| Hero `.h1` | Figtree | clamp(40px, 6.4vw, 72px) / 1.06 | 500 | -.03em |
| Section `.h2` | Figtree | clamp(32px, 4.4vw, 52px) / 1.1 | 500 | -.025em |
| Card title | Figtree | 18–22px | 500 | -.01em |
| Lead | Figtree | 17px / 1.55 | 400 | 0, `--muted-fg`, max 560px |
| Body | Figtree | 15–16px | 400 | 0 |
| Eyebrow, labels, numbers | system mono | 11–13px | 400–500 | small caps tracking where uppercase |

Fonts load from Google Fonts: `Figtree:wght@400;500;600` and `Unbounded:wght@600`.

## 4. Layout

- **Frame**: `.frame` 1200px max, hairline left and right. Sections are `.section` (hairline at the bottom). Content padding `.pad`: 96px × 40px (64px × 16px on phones).
- **Section head**: a `.h2` with a gradient tail and a lead under it, left-aligned, 48–56px above the content.
- **Grids** are bordered: cells share hairlines, the last column and row drop theirs. Columns: 5 tiles (day one), 3 (features, agents, lessons), 4 (steps, industries), 2 (uses, prompts).
- **Breakpoints**: 1000px (nav collapses into the menu, grids go to 2 columns, side-by-side blocks stack) and 720px (one column, 16px gutters, app sidebar hidden).
- **No sideways scroll** at 375px on any page (checked).

## 5. Components

**Header.** Sticky, translucent white with blur, 68px. Logo left, nav centre, theme toggle and Download now right. Nav: Product, Agents ▾, Industries ▾, Pricing, Learn, FAQ. The current page is tomato.

**Dropdowns.** Open on hover or keyboard focus, close on Escape; the trigger itself links to the overview page. A white card (16px radius, hairline, soft shadow) centred under the header. Items: a 34px icon tile tinted with the agent's colour, name, one-line tag. Agents has a Titan feature tile (gray, dots, eyes) on the left; both end with a footer strip and an "All …" link. On small screens the triggers are plain links in the menu.

**Buttons.** 44px, 10px radius. Outline (white, hairline) with a tomato glint under it; dark (`--fg` fill). **Download now** is the primary action everywhere: outline with a download icon, a tomato light running round its border without end (conic gradient on `--spin`, 3s) and a glint drifting under it. It links to `/pricing/` until there's an installer.

**Pill.** Rounded, hairline, 13px, with a tomato part and an arrow chip. Sits above heroes.

**Hero.** Centred, a dot grid (`--dots`, 22px) masked into an ellipse, pill, `.h1` with a gradient second line, lead, two buttons, a small note. Sub-pages use the same hero with a breadcrumb and, on agent and industry pages, the agent's eyes or the industry icon above it.

**Tabs + stage.** A row of equal tabs with a black line that fills over 6s (auto-rotation); clicking stops it. Below, the light tomato stage with the app window (§7).

**Tile grid with hover panel** ("What Titan does on day one"). Icon + label tiles; on hover a `--tile` panel slides up with a drifting dot grid, a soft tomato glow and two lines: the agent in tomato mono caps, then one sentence.

**Feature list.** Left an app window on a pale tomato card, right an accordion; the open item has a black line on top.

**Agent cards.** Dark version on the warm band (home); light version (`.agent-card`) with the agent's eyes in a dotted gray tile, tag, name, one paragraph and "Meet …".

**Capability grid** (`.cap-grid`), **step row** (`.step-row`, tomato mono numbers), **prompt bubbles** (gray, chat icon), **spec list** (label/value rows) with **chip links** (pills with an agent dot or industry icon).

**Industry slider / block.** Left a white workflow card on a pale tomato wash (steps light up in order, the last in tomato), right the request as a large quote, uses with tomato checks, agents and arrows.

**Pricing.** Plan rows on the left (black icon tile, name, who it's for, price; the selected row gets a tomato bar), "Includes" on the right with tomato checks and a credit note. Monthly/yearly toggle. Tables: hairline, rounded, gray header row.

**Cards carousel** ("Safe by default"): warm gradient visuals with dots and a line icon, `//Label` in tomato mono, title, text; arrow buttons.

**FAQ.** Rounded bordered list of `<details>`; the open one turns `--muted`; plus rotates to ×. The FAQ page adds a search field and topic chips (`[data-filter-scope]`).

**Video band.** 16:7 (16:9 in lessons). Poster: the warm band with a frosted play button and a pulsing ring. Playing: the video fills the band with controls and a black × top right. The file loads only on play; if it's missing the band says the video is coming soon.

**Learn.** Lesson cards with a warm 16:9 thumbnail (play button, duration), track eyebrow, title, summary and meta (Video · steps · level). Lesson pages: breadcrumb, title, meta, video band, numbered steps, a tomato "Good to know" box, previous/next, and the track's lessons in a side list.

**Closing call to action.** Centred, the hero's dot grid, a tomato glow from below, Download now + a dark button.

**Footer.** Logo and one line, three link columns, a giant faded `Titan117` wordmark, copyright row.

## 6. Logo and Titan's eyes

- The logo is Titan's angry eyes (`assets/bot.js`, the bloub engine, MIT) at 40px, a 5px gap, then **TITAN117** in Unbounded. Ink at rest (black, or light in dark mode), the eyes look around on their own, tomato on hover.
- Agents get the same eyes in their own colour: in the app sidebar (gray at rest, coloured and animated while working, "notify" when they need you), on agent cards, and large on agent pages, where they follow the cursor.
- The restyle and trademark check in decisions §9 still apply before beta.

## 7. The app window (on the website)

A light desktop app, after Cursor, Antigravity and Claude's desktop app:

- Title bar `#f4f4f5` with three gray window dots, a white task tab, and icon buttons (memory, approvals with a tomato count, apps).
- Sidebar `#f4f4f5`: workspace switcher on top (black initials tile, name, plan), search with `Ctrl K`, Titan, the agents grouped by team (Operations, Build, Growth) with their eyes and a "Working" shimmer or a tomato "Needs you" pill, then Automations with their next run.
- Workspace white: title and subtitle (who's helping), a Local/Cloud switch, the request in a gray bubble on the right, the agent's steps (black done marks, the running one tomato), an approval card in a tomato tint with a tomato Approve, the inspector (`#fafafa`) with the result, a black bar, stats, feature chips, and **one black surface**: the activity log in mono. A message box at the bottom with the model and a tomato send button.
- No black buttons or selections (selected items are white with a hairline). One fixed height for every tab (660px; 920px on phones).

## 8. Motion

| What | How |
|---|---|
| Reveal on scroll (`.rv`) | fade + 18px rise, .7s, once |
| Statement | words light up with scroll |
| Numbers | count up once, 1.2s |
| Tabs | rotate every 6s, progress line fills |
| Industry slider | rotates every 8s |
| Download button | border light 3s loop, glint drift |
| Warm bands | blur drifts 14s, alternate |
| Hover panels | slide .4s, text fades in .15s later, dots drift |
| Dropdowns | fade + 6px drop, .25s |
| Eyes | idle wander; working = "thinking", needs you = "notify" |

Easing `cubic-bezier(.2, .7, .2, 1)`. `prefers-reduced-motion` turns animations and transitions off, shows everything, and keeps the eyes still.

## 9. Accessibility

- Text contrast: body on white is `#0a0a0a`; secondary `#6b6b6b`. Tomato is never body text on white; tomato labels use `--accent-deep`.
- Tabs are a `tablist` with arrow keys; FAQ uses native `<details>`; dropdowns open on focus and close on Escape; the video band has labelled play and close buttons and a status line.
- Focus ring: 2px tomato outline, 2px offset.

## 10. Content rules

- Integrations we name: local models (llama.cpp), OpenRouter, your own Anthropic, OpenAI or Google keys, Telegram, WhatsApp (bring your own, official Cloud API), GitHub, Google Search Console, LinkedIn, Facebook, Instagram, TikTok, X (bring your own). Nothing else by name.
- Prices from `docs/notes/pricing.md`: Starter €15, Pro €25, Max €50, Custom; 1 credit = €0.01; no free plan.
- Example companies and file names are illustrative ("Atelier Nord", "Ionescu SRL"); never real customers.

## 11. Pages and how to build them

| Route | Source |
|---|---|
| `/` | `index.html` (hand-written) + `assets/home.js` |
| `/agents/`, `/agents/<slug>/` | generated |
| `/industries/`, `/industries/<id>/` | generated |
| `/pricing/`, `/faq/`, `/learn/`, `/learn/<lesson>/` | generated |

- Content: `src/content.py`. Templates and shared header, footer and icons: `src/build.py` (+ `src/partials/icons.svg`). Run `python homepage-grid/src/build.py` after any change; it also refreshes the header, footer and icons inside `index.html` between the `<!-- @… -->` markers.
- Behaviour shared by every page: `assets/site.js` (theme, menu, dropdowns, eyes, pricing, video bands, filters, reveals).
- Paths: templates write site paths (`/styles.css`, `/agents/titan/`); the build rewrites them relative to each page (`../../styles.css`, `../titan/index.html`) and sets `<body data-page data-root>`, so the site works from any server root, a subfolder, or the file system. Links made in JavaScript use `link()` from `site.js`. Never hand-write a root-absolute path.
- Videos: `/assets/titan-demo.mp4` (home), `/assets/learn/tour.mp4`, `/assets/learn/<lesson>.mp4`.
