# Titan117 — framed-grid homepage

A homepage following the layout and look of the Atomist Next.js/shadcn template (https://atomist-nextjs-shadcn.vercel.app/), filled with Titan117's own product content. This is the one website design we keep; the earlier mockups were removed on 7 Nov 2026 (they stay in git history). Original code and copy; no template assets copied.

Static HTML, CSS and JavaScript, no build. Run from the repository root:

```powershell
python -m http.server 4180 --directory homepage-grid
```

Then open http://localhost:4180 (or start `homepage-grid` from `.claude/launch.json`).

- Content comes from `docs/notes/brainstorming-feature-map.md` (agents, features) and `docs/notes/pricing.md` (plans). Industries are the eight we cover.
- The accent colour is `--accent` in `styles.css`; change it there to rebrand the whole page.
- The logo is Titan's angry eyes (`assets/bot.js`, the bloub engine, MIT) and "TITAN117" in Unbounded 600.
- Light and dark themes (toggle in the header, follows the system by default); reduced motion respected.
