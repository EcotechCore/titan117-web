# Titan117 website

The Titan117 website: home, agents, industries, pricing, FAQ and Learn. The layout follows the Atomist Next.js/shadcn template (https://atomist-nextjs-shadcn.vercel.app/), filled with Titan117's own product content. This is the one website design we keep (decisions §18); the earlier mockups were removed on 7 Nov 2026 and stay in git history. Original code and copy; no template assets copied.

**Design rules:** [design.md](design.md). Read it before adding or changing a page.

## Run it

Static HTML, CSS and JavaScript. Every path is relative, so it works from any server or folder (or opened from disk). The usual way:

```powershell
python -m http.server 4180 --directory homepage-grid
```

Then open http://localhost:4180 (or start `homepage-grid` from `.claude/launch.json`).

## Build the pages

```powershell
python homepage-grid/src/build.py
```

- `src/content.py`: agents, industries, Learn lessons and FAQ (from the feature map, pricing notes and decisions).
- `src/build.py`: page templates, the shared header (with the Agents and Industries dropdowns), footer and call to action; writes `<route>/index.html` for every page and refreshes the header, footer and icons inside `index.html` between its `<!-- @… -->` markers.
- `src/partials/icons.svg`: the icon sprite every page inlines.
- `index.html` (home) is hand-written; its own behaviour is in `assets/home.js`.
- `assets/site.js`: what every page shares (theme, menu, dropdowns, Titan's eyes, pricing, video bands, search and filters, reveals).
- `assets/bot.js`: Titan's eyes (the bloub engine, MIT).
- `styles.css`: all styles; `--accent` rebrands the whole site.

## Videos

Drop the files in and they play; until then each video band says the video is coming soon.

- `assets/titan-demo.mp4`: home, "See Titan at work" (16:7 band).
- `assets/learn/tour.mp4`: Learn, the tour.
- `assets/learn/<lesson>.mp4`: one per lesson (`install`, `models`, `first-task`, `approvals`, `memory`, `documents`, `build-app`, `record`, `watch`, `marketing`, `phone`, `credits`).

MP4/H.264, 16:9, with the important part centred.
