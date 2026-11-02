# TITAN117 new mockups

The website and the desktop app in the style of the new home page (1 Nov 2026): Inter and Geist Mono, square surfaces with the cut corner at the top right, and LED dot-matrix panels.

Open through a local server (the panels read canvases back, which some browsers block on `file://`):

    python -m http.server 4179 --directory new-mockups

## Pages

- `index.html`: the home page
- `agents.html`: Titan and the nine specialists, each with a live demo
- `pricing.html`: plans with a monthly or yearly switch, a credit estimator, the full comparison, top-ups and rollover
- `security.html`: where data lives, the approval layer (try it), the safeguards
- `industries/*.html`: one page per industry (8), each with four tasks you can run
- `desktop.html`: the desktop app, clickable, light and dark themes (Ctrl+Shift+L switches, Ctrl+K opens the command palette)

Every page works from 375px up; below 980px the nav becomes a menu.

## Files

- `src/content.py`: all copy and demo data (copied from `mockup/src/content.py`, plus the agents page demos, the security lists and the LED icons)
- `src/build.py`: writes every page and `assets/data.js`. After a change to `content.py`, `home-main.html` or `build.py`:

      cd new-mockups/src
      python build.py

- `assets/site.css`, `assets/site.js`: the website (every page loads both; each script module checks for its own markup)
- `assets/led.js`: shared helpers and the LED engine, used by the website and the app
- `assets/desktop.css`, `assets/desktop.js`: the app, carried over from `mockup/src/desktop` with a new skin at the end of the CSS
- `assets/bot.js`: Titan's eyes for the logos (bloub engine, MIT)

Everything is a mockup with fictional example data: no real customers, quotes or statistics.
