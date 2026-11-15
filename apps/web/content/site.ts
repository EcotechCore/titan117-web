/**
 * The website's content: agents, industries, the FAQ and Learn (decisions §18).
 * Generated once from homepage-grid/src/content.py, which it replaces; edit here from now on.
 * Plain text only: every page renders it as text, never as HTML.
 */

export interface Agent {
  slug: string;
  name: string;
  /** null for Titan, who runs every team. */
  team: string | null;
  icon: string;
  color: string;
  tag: string;
  headline: string;
  lead: string;
  demo: {
    title: string;
    prompt: string;
    steps: string[];
    approve?: { title: string; text: string };
    out?: { icon: string; text: string };
  };
  caps: { icon: string; title: string; text: string }[];
  steps: { title: string; text: string }[];
  prompts: string[];
  needs: { label: string; value: string }[];
  pairs: string[];
  industries: string[];
}

export interface Industry {
  id: string;
  tag: string;
  icon: string;
  name: string;
  pitch: string;
  ask: string;
  flow: string[];
  uses: { title: string; text: string; agent: string }[];
  agents: string[];
}

export interface Lesson {
  slug: string;
  track: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  steps: { title: string; text: string }[];
  tips: string[];
}

export const AGENTS: Agent[] = [
  {
    "slug": "titan",
    "name": "Titan",
    "team": null,
    "icon": "sparkles",
    "color": "#ff6347",
    "tag": "General assistant",
    "headline": "the one who runs the team",
    "lead": "Titan is the default agent. It has every tool and the shared memory, does one-off computer tasks itself, and hands big jobs to the specialists.",
    "demo": {
      "title": "Invoice report",
      "prompt": "Make an Excel report from this month's invoices folder, flag anything overdue, and send it to me on Telegram.",
      "steps": [
        "Read 42 invoices in /Invoices/March",
        "Computed totals and due dates",
        "Flagged 3 overdue clients"
      ],
      "approve": {
        "title": "Send the report on Telegram?",
        "text": "invoices-march.xlsx to your linked Telegram. Nothing else leaves the laptop."
      }
    },
    "caps": [
      {
        "icon": "folder",
        "title": "Files and folders",
        "text": "Reads, writes, renames, sorts and searches files, only inside the folders you allow."
      },
      {
        "icon": "terminal",
        "title": "Sandboxed shell",
        "text": "Runs commands and scripts, converts files and uses git. Risky commands wait for your OK."
      },
      {
        "icon": "globe",
        "title": "Browser",
        "text": "Researches, fills forms, downloads and checks sites, with web content treated as data."
      },
      {
        "icon": "code",
        "title": "Small scripts",
        "text": "Writes and runs a script for a one-off job: clean data, build a spreadsheet, edit PDFs."
      },
      {
        "icon": "brain",
        "title": "Shared memory",
        "text": "Remembers your company, preferences and how you work. You can see, edit and delete it."
      },
      {
        "icon": "team",
        "title": "Hands off to specialists",
        "text": "Splits a big job and gives each part to the agent that does it best."
      }
    ],
    "steps": [
      {
        "title": "You ask",
        "text": "Type a task in the app, or message Titan on Telegram or WhatsApp."
      },
      {
        "title": "Titan plans",
        "text": "It picks the tools, the agents and the model, and shows the cost before it starts."
      },
      {
        "title": "The work runs locally",
        "text": "Files, scripts and the browser run on your laptop, step by step."
      },
      {
        "title": "You approve",
        "text": "Anything that sends, publishes or deletes waits for you, then you get the result."
      }
    ],
    "prompts": [
      "Sort my Downloads folder into sensible folders and delete duplicates.",
      "Convert the videos in /Shoot to MP4 and put them in one folder.",
      "Find 20 local restaurants without a website and list them in a spreadsheet.",
      "Every Friday, summarise what the agents did this week."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your Windows or Mac laptop"
      },
      {
        "label": "Models",
        "value": "Local for simple tasks; a stronger OpenRouter model suggested for long, multi-step work"
      },
      {
        "label": "Cost",
        "value": "Free on a local model; cloud models use credits, shown before the task runs"
      },
      {
        "label": "Asks first",
        "value": "Sending, publishing, deleting and risky commands"
      }
    ],
    "pairs": [
      "folder-agent",
      "recorder",
      "app-builder",
      "marketing"
    ],
    "industries": [
      "trades",
      "wholesale",
      "accounting"
    ]
  },
  {
    "slug": "folder-agent",
    "name": "Folder agent",
    "team": "operations",
    "icon": "folder",
    "color": "#2f6fed",
    "tag": "Your documents",
    "headline": "answers from your own documents",
    "lead": "Point it at a folder and ask questions. It reads PDFs, Word, Excel, PowerPoint and email, and every answer cites the file, page and passage.",
    "demo": {
      "title": "Contracts",
      "prompt": "Which supplier contracts renew automatically before March, and what is the notice period?",
      "steps": [
        "Indexed /Contracts · 214 files",
        "OCR on 31 scanned PDFs",
        "Found 7 matching clauses"
      ],
      "out": {
        "icon": "file",
        "text": "Nord_supply_2024.pdf · p. 4, §9.2"
      }
    },
    "caps": [
      {
        "icon": "folder",
        "title": "Watched folders",
        "text": "New and changed files are picked up on their own, one or more folders per company."
      },
      {
        "icon": "file",
        "title": "Reads every format",
        "text": "PDF, Word, Excel, PowerPoint and email, with OCR for scans."
      },
      {
        "icon": "search",
        "title": "Local search",
        "text": "Finds by meaning and by keyword, in Romanian and English."
      },
      {
        "icon": "check",
        "title": "Cited answers",
        "text": "Every answer shows the file, page and passage it came from."
      },
      {
        "icon": "calc",
        "title": "Real calculations",
        "text": "Numbers in spreadsheets are computed, not guessed."
      },
      {
        "icon": "lock",
        "title": "Local models only",
        "text": "Mark a folder confidential and nothing in it ever reaches a cloud model."
      }
    ],
    "steps": [
      {
        "title": "Pick a folder",
        "text": "Choose the folders it may read. It is read-only by default."
      },
      {
        "title": "It indexes",
        "text": "Text is extracted, scans are read with OCR, and a local search index is built."
      },
      {
        "title": "You ask",
        "text": "Ask in plain words, in the app or from your phone."
      },
      {
        "title": "You check",
        "text": "Open the cited page to see the passage the answer came from."
      }
    ],
    "prompts": [
      "Which contracts renew automatically before March?",
      "What did we agree with Delta Parts about late delivery penalties?",
      "Total the invoices from Q1 per client.",
      "Find every document that mentions the old warehouse address."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop; the index stays on it"
      },
      {
        "label": "Models",
        "value": "A small local model for search; local or cloud for answers"
      },
      {
        "label": "Cost",
        "value": "Free on local models"
      },
      {
        "label": "Asks first",
        "value": "Never needs to: it only reads"
      }
    ],
    "pairs": [
      "titan",
      "web-watcher",
      "recorder"
    ],
    "industries": [
      "legal",
      "accounting",
      "realestate"
    ]
  },
  {
    "slug": "recorder",
    "name": "Recorder",
    "team": "operations",
    "icon": "record",
    "color": "#14a37f",
    "tag": "Repeat it for me",
    "headline": "do it once, it repeats it",
    "lead": "Record the browser steps of a chore once. The recorder replays them on a schedule, logs in from your keychain and pauses for your two-factor code.",
    "demo": {
      "title": "Weekly stock export",
      "prompt": "Every Monday at 8:00, log in to the supplier portal, export stock levels and update the inventory sheet.",
      "steps": [
        "Recorded 9 browser steps",
        "Login from OS keychain",
        "Paused for your 2FA code"
      ],
      "out": {
        "icon": "calendar",
        "text": "Next run · Monday 08:00"
      }
    },
    "caps": [
      {
        "icon": "record",
        "title": "Record in the browser",
        "text": "Click through the task once; every step is captured."
      },
      {
        "icon": "note",
        "title": "Edit the steps",
        "text": "Rename, reorder and add variables like a date or a client name."
      },
      {
        "icon": "clock",
        "title": "Run on a schedule",
        "text": "Runs while the app is open and catches up on the next launch."
      },
      {
        "icon": "key",
        "title": "Logins from the keychain",
        "text": "Passwords are never stored in the recording. It waits for 2FA."
      },
      {
        "icon": "sparkles",
        "title": "Fixes broken steps",
        "text": "When a site changes, AI proposes a fix and asks before saving it."
      },
      {
        "icon": "cpu",
        "title": "Computer use",
        "text": "For desktop apps, it works inside a virtual machine or with your permission on your desktop."
      }
    ],
    "steps": [
      {
        "title": "Record",
        "text": "Start recording and do the task in the browser as usual."
      },
      {
        "title": "Review",
        "text": "Check the steps, name the variables, choose a schedule."
      },
      {
        "title": "It runs",
        "text": "It replays the steps on time and saves the result where you said."
      },
      {
        "title": "You hear back",
        "text": "You get a notification when it is done, or if a step needs you."
      }
    ],
    "prompts": [
      "Export stock levels from the supplier portal every Monday.",
      "Download last month's invoices from the utility portal on the 2nd.",
      "Upload this week's listings to the property portal.",
      "Check the courier site for undelivered parcels every morning."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop, while the app is open"
      },
      {
        "label": "Models",
        "value": "None to replay; a model only to fix a broken step"
      },
      {
        "label": "Cost",
        "value": "Replays are free"
      },
      {
        "label": "Asks first",
        "value": "Saving a fixed step, and any step that sends or submits"
      }
    ],
    "pairs": [
      "titan",
      "web-watcher",
      "folder-agent"
    ],
    "industries": [
      "wholesale",
      "realestate",
      "retail"
    ]
  },
  {
    "slug": "web-watcher",
    "name": "Web watcher",
    "team": "operations",
    "icon": "eye",
    "color": "#8b5cf6",
    "tag": "Changes that matter",
    "headline": "tells you what changed",
    "lead": "Give it the sources that matter to your company. It checks them on a schedule, finds what changed and explains why it matters to you.",
    "demo": {
      "title": "Law watch",
      "prompt": "Watch the environmental law updates every day and tell me what changes for a small manufacturer.",
      "steps": [
        "Checked 6 sources",
        "Found 2 changes since yesterday",
        "Matched them to your company profile"
      ],
      "out": {
        "icon": "file",
        "text": "2 changes · summary with sources"
      }
    },
    "caps": [
      {
        "icon": "globe",
        "title": "Any public source",
        "text": "Official journals, regulators, competitors' pages, price lists."
      },
      {
        "icon": "clock",
        "title": "On a schedule",
        "text": "Daily, weekly or every few hours, while the app is open."
      },
      {
        "icon": "search",
        "title": "Finds the difference",
        "text": "Compares with the last version and keeps only real changes."
      },
      {
        "icon": "brain",
        "title": "Knows your company",
        "text": "Uses your company profile to judge what matters."
      },
      {
        "icon": "send",
        "title": "Tells you where you are",
        "text": "In the app, or on Telegram and WhatsApp."
      },
      {
        "icon": "shield",
        "title": "Sourced",
        "text": "Every summary links to the page it came from, for expert review."
      }
    ],
    "steps": [
      {
        "title": "Add sources",
        "text": "Paste the pages or feeds to watch."
      },
      {
        "title": "Say what matters",
        "text": "Describe your company and what you care about."
      },
      {
        "title": "It checks",
        "text": "On schedule it reads the sources and compares them."
      },
      {
        "title": "You get a summary",
        "text": "Only the changes that matter, with links."
      }
    ],
    "prompts": [
      "Watch the official journal for changes to environmental law.",
      "Tell me when a competitor changes their prices.",
      "Check the tax authority's news page every morning.",
      "Alert me when the building regulations page changes."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop, while the app is open"
      },
      {
        "label": "Models",
        "value": "Local or cloud for the summary"
      },
      {
        "label": "Cost",
        "value": "Free on a local model"
      },
      {
        "label": "Asks first",
        "value": "Nothing to approve: it only reads and reports"
      }
    ],
    "pairs": [
      "folder-agent",
      "titan",
      "marketing"
    ],
    "industries": [
      "legal",
      "accounting",
      "trades"
    ]
  },
  {
    "slug": "app-builder",
    "name": "App builder",
    "team": "build",
    "icon": "code",
    "color": "#f6a825",
    "tag": "Web, mobile, desktop",
    "headline": "from a prompt to a working app",
    "lead": "Describe the app. It plans it with you, builds it, tests it in real browsers and emulators on your laptop, and publishes it when you say so.",
    "demo": {
      "title": "Booking app",
      "prompt": "Build a booking web app for my salon: services, staff, time slots and a reminder email.",
      "steps": [
        "Plan approved · 6 pages, 4 tables",
        "Coder wrote 38 files",
        "QA: tests pass in 3 browsers"
      ],
      "approve": {
        "title": "Publish the web app?",
        "text": "Version 3 is ready, SEO built in. Hosting costs about 40 credits a month."
      }
    },
    "caps": [
      {
        "icon": "globe",
        "title": "Web apps",
        "text": "React, TypeScript and Tailwind, with a backend, previewed on your laptop."
      },
      {
        "icon": "phone",
        "title": "Mobile apps",
        "text": "iOS and Android with Expo: preview on your phone by QR code or in an emulator."
      },
      {
        "icon": "layers",
        "title": "Desktop apps",
        "text": "Windows and macOS apps with signed installers and auto-update."
      },
      {
        "icon": "palette",
        "title": "Visual edit",
        "text": "Click an element in the preview and describe the change."
      },
      {
        "icon": "clock",
        "title": "Versions",
        "text": "Every change is a version; roll back in one click."
      },
      {
        "icon": "git",
        "title": "Yours to keep",
        "text": "Export the code to GitHub. No lock-in."
      }
    ],
    "steps": [
      {
        "title": "Plan",
        "text": "A strong model turns your prompt into pages, data and tasks. You approve the plan."
      },
      {
        "title": "Build",
        "text": "Sub-agents write the code; cheaper models take the simple parts."
      },
      {
        "title": "Check",
        "text": "Typecheck, build, tests, and the QA agent clicking through the app."
      },
      {
        "title": "Publish",
        "text": "One click to deploy the web app, or build store and installer packages."
      }
    ],
    "prompts": [
      "Build a booking app for my salon with reminders.",
      "Make a simple CRM for my clients and add it to the sidebar.",
      "Create an inventory app my staff can use on their phones.",
      "Turn my price list into a small ordering site."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop; previews and tests are free"
      },
      {
        "label": "Models",
        "value": "A strong planner, a cheap coder, a vision checker; all can be changed"
      },
      {
        "label": "Cost",
        "value": "Credits for cloud models while building; web hosting uses credits"
      },
      {
        "label": "Needs",
        "value": "Apple and Google developer accounts to publish to the stores"
      }
    ],
    "pairs": [
      "qa",
      "code-builder",
      "seo"
    ],
    "industries": [
      "hospitality",
      "agencies",
      "trades"
    ]
  },
  {
    "slug": "code-builder",
    "name": "Code builder",
    "team": "build",
    "icon": "terminal",
    "color": "#0db5ed",
    "tag": "For developers",
    "headline": "a coding agent in any repo",
    "lead": "Works in any repository on your laptop: plans before it edits, shows diffs you accept or reject, runs your tests, commits and opens pull requests.",
    "demo": {
      "title": "Checkout fix",
      "prompt": "Fix the wrong total on the checkout page, add a test for it, and open a pull request.",
      "steps": [
        "Read the repo · 214 files",
        "Plan: 3 files to change",
        "QA: 48 of 48 tests pass"
      ],
      "approve": {
        "title": "Open a pull request?",
        "text": "fix/checkout-total into main · 3 files, +46 −12. The QA agent added 2 tests."
      }
    },
    "caps": [
      {
        "icon": "folder",
        "title": "Any local repo",
        "text": "Open a repository or folder that already lives on your laptop."
      },
      {
        "icon": "note",
        "title": "Plan, then act",
        "text": "See the plan and the files it will touch before anything changes."
      },
      {
        "icon": "code",
        "title": "Reviewable diffs",
        "text": "Accept or reject every edit, and ask for a review of any diff or pull request."
      },
      {
        "icon": "terminal",
        "title": "Tests and dev server",
        "text": "Runs commands through the sandboxed shell."
      },
      {
        "icon": "git",
        "title": "Branches and pull requests",
        "text": "Commits and opens pull requests on GitHub."
      },
      {
        "icon": "key",
        "title": "Your own coding tools",
        "text": "Already have Claude Code, Codex or Cursor? Titan117 can run it on your laptop under your own sign-in and plan, inside its approvals."
      }
    ],
    "steps": [
      {
        "title": "Open a repo",
        "text": "Pick the folder; it learns the project's conventions."
      },
      {
        "title": "Plan",
        "text": "It proposes the change and the files it will touch."
      },
      {
        "title": "Edit and test",
        "text": "Diffs land one by one, then the tests run."
      },
      {
        "title": "Ship",
        "text": "Commit and open a pull request when you approve."
      }
    ],
    "prompts": [
      "Fix the failing test in the payments module.",
      "Add dark mode to the settings page.",
      "Review this pull request for bugs.",
      "Upgrade the project to the latest framework version."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop, in the folders you open"
      },
      {
        "label": "Models",
        "value": "Any model, local or on OpenRouter, or a coding tool you already have"
      },
      {
        "label": "Cost",
        "value": "Free on local models; cloud models use credits; your own coding tool stays on your plan"
      },
      {
        "label": "Asks first",
        "value": "Risky commands, pushing and opening pull requests"
      }
    ],
    "pairs": [
      "qa",
      "app-builder",
      "titan"
    ],
    "industries": [
      "agencies"
    ]
  },
  {
    "slug": "qa",
    "name": "QA and tests",
    "team": "build",
    "icon": "bug",
    "color": "#2a9a30",
    "tag": "Websites and apps",
    "headline": "a tester that writes the tests",
    "lead": "Explores your website or app like a person, writes tests that then run without AI, and checks accessibility and speed. It fixes broken tests with your OK.",
    "demo": {
      "title": "Site check",
      "prompt": "Test my shop on phone and desktop sizes and tell me what's broken.",
      "steps": [
        "Explored 24 pages in 3 browsers",
        "Wrote 31 Playwright tests",
        "Found 2 accessibility issues"
      ],
      "out": {
        "icon": "file",
        "text": "QA report · screenshots per device"
      }
    },
    "caps": [
      {
        "icon": "globe",
        "title": "Three browser engines",
        "text": "Chromium, Firefox and WebKit, on Windows too."
      },
      {
        "icon": "phone",
        "title": "Every screen size",
        "text": "Phone, tablet and desktop, slow network, offline, dark mode."
      },
      {
        "icon": "code",
        "title": "Real tests",
        "text": "Writes Playwright tests that run without AI afterwards."
      },
      {
        "icon": "eye",
        "title": "Accessibility",
        "text": "Checks with axe-core and lists issues by severity."
      },
      {
        "icon": "chart",
        "title": "Speed",
        "text": "Lighthouse on every page, shared with the SEO agent."
      },
      {
        "icon": "file",
        "title": "Clear report",
        "text": "Screenshots per device and steps to repeat each failure."
      }
    ],
    "steps": [
      {
        "title": "Give it a site or app",
        "text": "A URL, or an app the app builder made."
      },
      {
        "title": "It explores",
        "text": "It clicks through pages and flows like a visitor."
      },
      {
        "title": "It writes tests",
        "text": "Each flow becomes a test you keep."
      },
      {
        "title": "You get a report",
        "text": "Failures, screenshots and fixes it proposes."
      }
    ],
    "prompts": [
      "Test the checkout on phone and desktop.",
      "Check my website for accessibility problems.",
      "Run the tests every night and tell me what broke.",
      "Find the slowest pages on my site."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop, in local browsers and emulators"
      },
      {
        "label": "Models",
        "value": "Local or cloud for exploring; tests run without AI"
      },
      {
        "label": "Cost",
        "value": "Testing is free; exploring with a cloud model uses credits"
      },
      {
        "label": "Asks first",
        "value": "Changing or fixing tests"
      }
    ],
    "pairs": [
      "app-builder",
      "code-builder",
      "seo"
    ],
    "industries": [
      "agencies",
      "retail"
    ]
  },
  {
    "slug": "marketing",
    "name": "Marketing",
    "team": "growth",
    "icon": "megaphone",
    "color": "#ec4899",
    "tag": "Posts and campaigns",
    "headline": "a month of posts, in your voice",
    "lead": "Learns your brand from your website, then plans and writes social posts, newsletters and campaigns. Posts go out on schedule after you approve them.",
    "demo": {
      "title": "March calendar",
      "prompt": "Plan a month of posts for LinkedIn and Instagram from our brand kit, around the spring launch.",
      "steps": [
        "Read brand kit from memory",
        "Planned 18 posts around 3 dates",
        "Made images and captions"
      ],
      "approve": {
        "title": "Add 18 posting reminders?",
        "text": "LinkedIn × 8, Instagram × 10, ready to post. Each reminder copies the post and opens the platform for you."
      }
    },
    "caps": [
      {
        "icon": "palette",
        "title": "Brand kit",
        "text": "Logo, colours, fonts, tone of voice and products, read from your site and edited by you."
      },
      {
        "icon": "megaphone",
        "title": "Social posts",
        "text": "Text, images and video sized for LinkedIn, Facebook, Instagram, TikTok and X."
      },
      {
        "icon": "calendar",
        "title": "Content calendar",
        "text": "A month planned from your goals, launches and holidays."
      },
      {
        "icon": "send",
        "title": "Ready to post",
        "text": "Copy and open, or one tap on your phone at the planned time. No platform approvals to wait for."
      },
      {
        "icon": "mail",
        "title": "Newsletters",
        "text": "Drafts in your voice, ready to review."
      },
      {
        "icon": "video",
        "title": "Video with the promo agent",
        "text": "Short cuts from your website for posts and ads."
      }
    ],
    "steps": [
      {
        "title": "Brand kit",
        "text": "It reads your website and builds the brand kit; you correct it."
      },
      {
        "title": "Plan",
        "text": "It proposes a calendar around your dates."
      },
      {
        "title": "Write",
        "text": "Posts, images and captions, one by one."
      },
      {
        "title": "Approve and schedule",
        "text": "Nothing is posted until you say so."
      }
    ],
    "prompts": [
      "Plan a month of LinkedIn posts around our spring launch.",
      "Write this week's newsletter from our new products.",
      "Turn our latest blog post into five social posts.",
      "Make a post for each of our three new menu items."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop; reminders on your laptop and phone"
      },
      {
        "label": "Models",
        "value": "Local or cloud; images through a cloud provider"
      },
      {
        "label": "Cost",
        "value": "Credits for cloud text and images"
      },
      {
        "label": "Needs",
        "value": "Your social accounts; X on your own developer access"
      }
    ],
    "pairs": [
      "promo-video",
      "seo",
      "titan"
    ],
    "industries": [
      "retail",
      "hospitality",
      "realestate"
    ]
  },
  {
    "slug": "seo",
    "name": "SEO agent",
    "team": "growth",
    "icon": "chart",
    "color": "#7c3aed",
    "tag": "Search visibility",
    "headline": "audits, then fixes",
    "lead": "Audits your site, fixes what it can, tracks your rankings with Search Console data and writes content you approve. Sites built by Titan117 come with SEO built in.",
    "demo": {
      "title": "Site audit",
      "prompt": "Audit my website, fix what you can, and tell me which pages to improve first.",
      "steps": [
        "Crawled 86 pages",
        "Found 14 issues by severity",
        "Fixed 9 on our build"
      ],
      "out": {
        "icon": "chart",
        "text": "Audit report · weekly re-check on"
      }
    },
    "caps": [
      {
        "icon": "search",
        "title": "Site audit",
        "text": "Broken links, redirects, missing meta tags, headings, thin pages, alt text."
      },
      {
        "icon": "chart",
        "title": "Speed for every page",
        "text": "Core Web Vitals across the whole site."
      },
      {
        "icon": "code",
        "title": "Fix it for me",
        "text": "On sites it built, it makes the fix; elsewhere it opens a pull request."
      },
      {
        "icon": "globe",
        "title": "Search Console",
        "text": "Real queries, clicks and indexing problems from Google."
      },
      {
        "icon": "note",
        "title": "Content",
        "text": "Pages and posts from your keywords and brand kit, after your OK."
      },
      {
        "icon": "eye",
        "title": "AI search visibility",
        "text": "Whether AI answers mention your company, plus llms.txt."
      }
    ],
    "steps": [
      {
        "title": "Connect",
        "text": "Add your site and, if you like, Search Console."
      },
      {
        "title": "Audit",
        "text": "It crawls the site and ranks the issues."
      },
      {
        "title": "Fix",
        "text": "It fixes what it can and asks before publishing."
      },
      {
        "title": "Re-check",
        "text": "A weekly re-audit with a short report."
      }
    ],
    "prompts": [
      "Audit my website and fix the broken links.",
      "Which pages lost the most clicks this month?",
      "Write a page for each of our services in Romanian and English.",
      "Check our Google Business Profile and reviews."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop"
      },
      {
        "label": "Models",
        "value": "Local or cloud"
      },
      {
        "label": "Cost",
        "value": "Audits are free on local models; keyword data comes from a paid provider through credits"
      },
      {
        "label": "Asks first",
        "value": "Publishing content and pushing fixes"
      }
    ],
    "pairs": [
      "app-builder",
      "marketing",
      "qa"
    ],
    "industries": [
      "agencies",
      "hospitality",
      "retail"
    ]
  },
  {
    "slug": "promo-video",
    "name": "Promo video",
    "team": "growth",
    "icon": "video",
    "color": "#e24b4a",
    "tag": "Website to video",
    "headline": "your website, as a video",
    "lead": "Reads your website, writes a script, adds a voiceover and assembles a promo video in your colours, with open-source video tools on your laptop.",
    "demo": {
      "title": "30-second promo",
      "prompt": "Make a 30-second promo video from our website for Instagram.",
      "steps": [
        "Read the site: text, logo, colours",
        "Wrote a 30s script",
        "Added a voiceover"
      ],
      "out": {
        "icon": "video",
        "text": "promo-30s.mp4 · vertical"
      }
    },
    "caps": [
      {
        "icon": "globe",
        "title": "Reads your site",
        "text": "Text, logo, colours, screenshots and a screen recording."
      },
      {
        "icon": "note",
        "title": "Writes the script",
        "text": "A script for the length and platform you choose."
      },
      {
        "icon": "chat",
        "title": "Voiceover",
        "text": "A local or cloud voice."
      },
      {
        "icon": "video",
        "title": "Assembles the video",
        "text": "Open-source video tools and FFmpeg, on your laptop."
      },
      {
        "icon": "sparkles",
        "title": "AI clips, optional",
        "text": "Generated clips on a local GPU or in the cloud through credits."
      },
      {
        "icon": "palette",
        "title": "Your brand",
        "text": "Your colours and fonts from the brand kit."
      }
    ],
    "steps": [
      {
        "title": "Give it a URL",
        "text": "Your website, or a page of it."
      },
      {
        "title": "Script",
        "text": "It writes the script; you edit it."
      },
      {
        "title": "Assemble",
        "text": "Screens, voice, music and titles come together."
      },
      {
        "title": "Export",
        "text": "Vertical or wide, ready to post."
      }
    ],
    "prompts": [
      "Make a 30-second promo from our website.",
      "Make a vertical video tour of this listing.",
      "Cut a 15-second ad for the spring sale.",
      "Make a short video for each new product."
    ],
    "needs": [
      {
        "label": "Runs on",
        "value": "Your laptop"
      },
      {
        "label": "Models",
        "value": "Local or cloud for the script and voice"
      },
      {
        "label": "Cost",
        "value": "Free with local tools; AI clips use credits"
      },
      {
        "label": "Asks first",
        "value": "Posting the video anywhere"
      }
    ],
    "pairs": [
      "marketing",
      "seo",
      "titan"
    ],
    "industries": [
      "realestate",
      "retail",
      "hospitality"
    ]
  }
];

export const INDUSTRIES: Industry[] = [
  {
    "id": "retail",
    "tag": "Listings, stock and campaigns",
    "icon": "store",
    "name": "Retail and e-commerce",
    "pitch": "Run the shop, the listings and the marketing without hiring a team.",
    "ask": "Write product descriptions for the 60 new items, update the shop, and plan the posts for the spring sale.",
    "flow": [
      "Reads the supplier price list",
      "Writes descriptions and photo alt text",
      "Updates the shop after your OK"
    ],
    "uses": [
      {
        "title": "Product descriptions and SEO",
        "text": "Descriptions and alt text for every new item, written for search.",
        "agent": "seo"
      },
      {
        "title": "Stock and order reports",
        "text": "A spreadsheet from your orders and stock, every week.",
        "agent": "titan"
      },
      {
        "title": "A month of social posts",
        "text": "A calendar around your sales, from your brand kit.",
        "agent": "marketing"
      },
      {
        "title": "Promo video from your site",
        "text": "A short video for each campaign.",
        "agent": "promo-video"
      }
    ],
    "agents": [
      "titan",
      "marketing",
      "seo",
      "promo-video"
    ]
  },
  {
    "id": "hospitality",
    "tag": "Menus, bookings and reviews",
    "icon": "cup",
    "name": "Restaurants and cafés",
    "pitch": "Menus, bookings and reviews handled between services.",
    "ask": "Update the menu on the website, post the weekend special, and reply to this week's reviews.",
    "flow": [
      "Reads the new menu photo",
      "Updates the site and Google profile",
      "Drafts review replies for approval"
    ],
    "uses": [
      {
        "title": "Booking app for your site",
        "text": "Tables, times and reminders, built for you.",
        "agent": "app-builder"
      },
      {
        "title": "Review replies in your voice",
        "text": "Drafts for every review, sent after your OK.",
        "agent": "marketing"
      },
      {
        "title": "Supplier orders and costs",
        "text": "Costs per dish from your supplier invoices.",
        "agent": "titan"
      },
      {
        "title": "Local SEO and Google profile",
        "text": "Your opening hours, menu and reviews kept right.",
        "agent": "seo"
      }
    ],
    "agents": [
      "app-builder",
      "marketing",
      "seo",
      "titan"
    ]
  },
  {
    "id": "accounting",
    "tag": "Reconciliations and client files",
    "icon": "calc",
    "name": "Accounting and bookkeeping",
    "pitch": "Real calculations on your spreadsheets, never guesses, and client files that never leave the office.",
    "ask": "Match this month's bank statement to the invoices folder and list what's missing per client.",
    "flow": [
      "Reads statements and invoices locally",
      "Computes matches in the spreadsheet",
      "Lists gaps per client with sources"
    ],
    "uses": [
      {
        "title": "Reconcile statements",
        "text": "Bank lines matched to invoices, with the gaps listed.",
        "agent": "folder-agent"
      },
      {
        "title": "Client document requests",
        "text": "A list of what each client still owes you, drafted to send.",
        "agent": "titan"
      },
      {
        "title": "Tax law change alerts",
        "text": "What changed, and which clients it affects.",
        "agent": "web-watcher"
      },
      {
        "title": "Excel reports from PDFs",
        "text": "Folders of PDFs turned into a clean spreadsheet.",
        "agent": "titan"
      }
    ],
    "agents": [
      "folder-agent",
      "web-watcher",
      "titan"
    ]
  },
  {
    "id": "legal",
    "tag": "Contracts with cited answers",
    "icon": "scale",
    "name": "Law firms",
    "pitch": "Search every contract and file with answers that cite the page, on local models for confidential folders.",
    "ask": "Which of our supplier contracts renew automatically before March, and what's the notice period?",
    "flow": [
      "Indexes the matter folder with OCR",
      "Finds clauses across documents",
      "Answers with file, page and passage"
    ],
    "uses": [
      {
        "title": "Clause search across contracts",
        "text": "Ask across hundreds of documents, with citations.",
        "agent": "folder-agent"
      },
      {
        "title": "New legislation summaries",
        "text": "Daily changes from official sources, summarised.",
        "agent": "web-watcher"
      },
      {
        "title": "First drafts from templates",
        "text": "A draft from your own templates and notes.",
        "agent": "titan"
      },
      {
        "title": "Deadline tracking",
        "text": "Dates pulled from documents into one list.",
        "agent": "folder-agent"
      }
    ],
    "agents": [
      "folder-agent",
      "web-watcher",
      "titan"
    ]
  },
  {
    "id": "realestate",
    "tag": "Listings, videos and follow-ups",
    "icon": "home",
    "name": "Real estate agencies",
    "pitch": "Listings, videos and follow-ups out the door the same day.",
    "ask": "Turn these 12 listing photos and notes into listings, a video tour and posts for this week.",
    "flow": [
      "Reads photos and agent notes",
      "Writes listings and a short video",
      "Gets posts ready, with reminders"
    ],
    "uses": [
      {
        "title": "Listing descriptions",
        "text": "Listings from photos and notes, in your style.",
        "agent": "titan"
      },
      {
        "title": "Property promo videos",
        "text": "A vertical tour for each property.",
        "agent": "promo-video"
      },
      {
        "title": "Lead follow-up",
        "text": "Follow-up drafts for every new enquiry.",
        "agent": "marketing"
      },
      {
        "title": "Portal uploads, recorded once",
        "text": "The same listing on every portal, on repeat.",
        "agent": "recorder"
      }
    ],
    "agents": [
      "promo-video",
      "marketing",
      "recorder",
      "titan"
    ]
  },
  {
    "id": "agencies",
    "tag": "Build, test, rank and report",
    "icon": "palette",
    "name": "Agencies and studios",
    "pitch": "More client work with the same people: build, test, rank and report.",
    "ask": "Audit the client's site, fix the SEO issues on our build, and send me the report for Monday.",
    "flow": [
      "Crawls the client site",
      "Fixes issues through the code builder",
      "Writes a client-ready report"
    ],
    "uses": [
      {
        "title": "Client sites and apps",
        "text": "Web and mobile apps from a brief.",
        "agent": "app-builder"
      },
      {
        "title": "SEO audits and fixes",
        "text": "Audits, fixes and weekly re-checks.",
        "agent": "seo"
      },
      {
        "title": "QA reports and tests",
        "text": "Every release tested on every screen size.",
        "agent": "qa"
      },
      {
        "title": "Campaign content",
        "text": "Posts and newsletters in each client's voice.",
        "agent": "marketing"
      }
    ],
    "agents": [
      "app-builder",
      "code-builder",
      "seo",
      "qa"
    ]
  },
  {
    "id": "trades",
    "tag": "Quotes and jobs from your phone",
    "icon": "hammer",
    "name": "Trades and construction",
    "pitch": "Quotes, schedules and paperwork done from your phone, between jobs.",
    "ask": "Make a quote from these site notes and photos, and remind the client on Friday if they haven't replied.",
    "flow": [
      "Reads notes and photos from chat",
      "Builds the quote from your price list",
      "Sends after your OK, then follows up"
    ],
    "uses": [
      {
        "title": "Quotes from site notes",
        "text": "Notes and photos from Telegram turned into a quote.",
        "agent": "titan"
      },
      {
        "title": "Job scheduling",
        "text": "A simple jobs app for your team.",
        "agent": "app-builder"
      },
      {
        "title": "Permit and regulation alerts",
        "text": "Changes to building rules, as they happen.",
        "agent": "web-watcher"
      },
      {
        "title": "Supplier price checks",
        "text": "Prices pulled from supplier portals on repeat.",
        "agent": "recorder"
      }
    ],
    "agents": [
      "titan",
      "app-builder",
      "web-watcher",
      "recorder"
    ]
  },
  {
    "id": "wholesale",
    "tag": "Stock, orders and supplier portals",
    "icon": "box",
    "name": "Wholesale and manufacturing",
    "pitch": "Stock, orders and supplier portals on autopilot, with you approving what matters.",
    "ask": "Every Monday, export stock from the supplier portal and flag anything below two weeks of cover.",
    "flow": [
      "Logs in with keychain credentials",
      "Exports and merges stock data",
      "Flags low stock and drafts orders"
    ],
    "uses": [
      {
        "title": "Supplier portal exports",
        "text": "Recorded once, run every week.",
        "agent": "recorder"
      },
      {
        "title": "Inventory and CRM apps",
        "text": "Apps that share data in your sidebar.",
        "agent": "app-builder"
      },
      {
        "title": "Order confirmations",
        "text": "Drafted from your orders, sent after your OK.",
        "agent": "titan"
      },
      {
        "title": "Regulation changes",
        "text": "Environmental and trade rules, watched daily.",
        "agent": "web-watcher"
      }
    ],
    "agents": [
      "recorder",
      "app-builder",
      "titan",
      "web-watcher"
    ]
  }
];

export const TEAMS: { id: string; name: string; lead: string }[] = [
  {
    "id": "operations",
    "name": "Operations",
    "lead": "Documents, repeat work and the web, handled in the background."
  },
  {
    "id": "build",
    "name": "Build",
    "lead": "Apps, code and tests, made and checked on your laptop."
  },
  {
    "id": "growth",
    "name": "Growth",
    "lead": "Marketing, search and video, from your brand kit."
  }
];

export const FAQ_GROUPS: { id: string; name: string; items: { q: string; a: string }[] }[] = [
  {
    "id": "general",
    "name": "General",
    "items": [
      {
        "q": "What is Titan117?",
        "a": "A desktop app for small companies: Titan, a general assistant, and nine specialist agents that build apps, read your documents, test your site, market your business and watch the web. They run on your own laptop."
      },
      {
        "q": "Which industries is it for?",
        "a": "Any small company, with ready-made workflows for retail and e-commerce, restaurants and cafés, accounting, law firms, real estate, agencies and studios, trades and construction, and wholesale and manufacturing."
      },
      {
        "q": "Does it run on my own computer?",
        "a": "Yes. The agents run in the desktop app on your Windows or Mac laptop. Our cloud only handles your account, plan, credits and the relay for remote control."
      },
      {
        "q": "What happens when my laptop is off?",
        "a": "Agents stop. Scheduled work runs while the app is open, and catches up on the next launch. Posting reminders also reach your phone."
      }
    ]
  },
  {
    "id": "privacy",
    "name": "Privacy and safety",
    "items": [
      {
        "q": "Does my data leave my laptop?",
        "a": "Only when you choose: when you send a task to a cloud model you picked, or share something. Files, memory and app data stay in a local database."
      },
      {
        "q": "Can an agent act without asking me?",
        "a": "Not for anything external. Sending, publishing, posting and deleting always need your approval, from the app, the web, your phone or a linked chat channel."
      },
      {
        "q": "Where are my passwords and keys kept?",
        "a": "In your operating system's keychain. Never in files, recordings or memory."
      },
      {
        "q": "Can I see and delete what it remembers?",
        "a": "Yes. Memory is listed in the app; you can edit or forget anything, and skills are plain files you can delete."
      }
    ]
  },
  {
    "id": "models",
    "name": "Models and credits",
    "items": [
      {
        "q": "Which models can I use?",
        "a": "Local models built in with llama.cpp, any model on OpenRouter, or your own Anthropic, OpenAI or Google key. You pick per agent and can override per step."
      },
      {
        "q": "What is a credit?",
        "a": "One credit is €0.01 of cloud model usage at our price. Every task shows its estimate first and can be capped."
      },
      {
        "q": "What is free?",
        "a": "Local models, previews, tests, documents, and anything run with your own API key."
      },
      {
        "q": "Do credits expire?",
        "a": "Monthly credits roll over for one month. Top-up credits last 12 months while a paid plan is active."
      },
      {
        "q": "Can I use Claude Code, Codex or Cursor that I already pay for?",
        "a": "Yes, for coding work. If one of them is installed and signed in on your laptop, the code builder and app builder can hand it the task. Titan117 runs the vendor's own program, you sign in through the vendor's own screen, and the usage stays on your plan: no credits, and we never see your login. Each tool's terms are checked before launch."
      }
    ]
  },
  {
    "id": "pricing",
    "name": "Plans and billing",
    "items": [
      {
        "q": "Is there a free plan or trial?",
        "a": "No. Titan117 works with a subscription from €15 a month. Local models are unlimited on every plan."
      },
      {
        "q": "Which plan should I pick?",
        "a": "Starter to begin, Pro for one person running a company, Max for heavy daily use of cloud models, Custom for teams and agencies."
      },
      {
        "q": "What happens if I cancel?",
        "a": "Your plan runs to the end of the paid period, then the app locks. Top-ups wait up to 12 months for a new subscription, and you can always export your data."
      },
      {
        "q": "Which currencies do you charge in?",
        "a": "Euro and US dollar, at the same numbers. Prices are before VAT."
      }
    ]
  },
  {
    "id": "setup",
    "name": "Install and requirements",
    "items": [
      {
        "q": "What do I need to install first?",
        "a": "Nothing. One signed installer has everything the core needs. Heavier parts download when a feature needs them, with their size shown first."
      },
      {
        "q": "Does it work offline?",
        "a": "Yes, with local models, tools and data. Online-only features show a \"Needs internet\" card. The licence works offline for 14 days."
      },
      {
        "q": "Can I test iOS apps on Windows?",
        "a": "The iOS Simulator needs a Mac. On Windows you test on your iPhone through Expo Go, or on cloud devices through credits."
      },
      {
        "q": "How many devices can I use?",
        "a": "Two on Starter, three on Pro, five on Max, and as many as you need on Custom."
      }
    ]
  },
  {
    "id": "remote",
    "name": "Remote control and channels",
    "items": [
      {
        "q": "Can I use it from my phone?",
        "a": "Yes. Start, watch and approve tasks from the web app or the phone app, which can do everything, or from Telegram and WhatsApp. The laptop does the work while it is on."
      },
      {
        "q": "Is remote control secure?",
        "a": "It is off until you switch it on in the desktop app, which asks for two-factor once (a passkey is the quickest). New devices are confirmed on your laptop's screen, and the riskiest actions (deleting, payments, sending files out, installing add-ons) are approved on the laptop. Commands and results are end-to-end encrypted, so our servers pass along what they can't read. You get an alert when a remote task starts, and can revoke all devices in one click."
      },
      {
        "q": "Can I do everything from the web app, or only from Telegram?",
        "a": "Everything. The web and phone apps can start, watch, approve and cancel tasks, show results and take a file. Telegram and WhatsApp are a convenience for private chats; group chats are not supported."
      },
      {
        "q": "Do I need a WhatsApp Business account?",
        "a": "Yes, for WhatsApp: you connect your own account on the official WhatsApp Business Platform, and Meta bills you directly. Telegram is free."
      }
    ]
  }
];

export const LEARN_TRACKS: { id: string; name: string }[] = [
  {
    "id": "start",
    "name": "Get started"
  },
  {
    "id": "everyday",
    "name": "Everyday work"
  },
  {
    "id": "agents",
    "name": "Agents"
  },
  {
    "id": "automate",
    "name": "Automate"
  },
  {
    "id": "models",
    "name": "Models and credits"
  },
  {
    "id": "remote",
    "name": "Anywhere"
  }
];

export const LESSONS: Lesson[] = [
  {
    "slug": "install",
    "track": "start",
    "title": "Install and sign in",
    "summary": "Download Titan117, sign in, and let the setup wizard check your laptop.",
    "minutes": 4,
    "level": "Beginner",
    "steps": [
      {
        "title": "Download the installer",
        "text": "One signed installer for Windows or macOS. Nothing else to install first."
      },
      {
        "title": "Sign in",
        "text": "Use your Titan117 account. The first sign-in needs internet; after that the session is kept in your OS keychain."
      },
      {
        "title": "Let it check your laptop",
        "text": "The hardware check looks at RAM and GPU and suggests the local models your laptop can run."
      },
      {
        "title": "Say what you want to do",
        "text": "Pick chat, apps, documents or marketing. Titan117 downloads only what those need, with sizes shown first."
      }
    ],
    "tips": [
      "Heavy parts like an Android emulator download only when a feature needs them.",
      "The setup checklist shows what is ready and what is missing."
    ]
  },
  {
    "slug": "models",
    "track": "models",
    "title": "Pick your models",
    "summary": "Choose local models, OpenRouter models or your own keys, per agent.",
    "minutes": 5,
    "level": "Beginner",
    "steps": [
      {
        "title": "Start with a local model",
        "text": "Free, private and offline. Good for simple tasks and documents."
      },
      {
        "title": "Add OpenRouter",
        "text": "Pick any model on OpenRouter for long or hard tasks, paid with credits."
      },
      {
        "title": "Or use your own key",
        "text": "Paste an OpenRouter, Anthropic, OpenAI or Google key. It is kept in your OS keychain."
      },
      {
        "title": "Set a model per agent",
        "text": "Each agent has a default; you can override it for a single step."
      }
    ],
    "tips": [
      "Every task shows its estimated cost before it runs.",
      "If a model is too heavy for your laptop, Titan117 suggests a cloud one and its cost."
    ]
  },
  {
    "slug": "first-task",
    "track": "start",
    "title": "Your first task with Titan",
    "summary": "Ask Titan for something real and watch it plan, work and ask.",
    "minutes": 6,
    "level": "Beginner",
    "steps": [
      {
        "title": "Type the task",
        "text": "For example: sort my Downloads folder and delete duplicates."
      },
      {
        "title": "Read the plan",
        "text": "Titan shows the steps, the tools and the cost."
      },
      {
        "title": "Watch the steps",
        "text": "The activity timeline shows what it does, with which model."
      },
      {
        "title": "Approve or deny",
        "text": "Anything that sends, publishes or deletes waits for you."
      }
    ],
    "tips": [
      "Allow only the folders you want Titan to touch.",
      "You can stop a task at any step."
    ]
  },
  {
    "slug": "approvals",
    "track": "everyday",
    "title": "Approvals and safety",
    "summary": "How approvals, allowed folders and budgets keep you in charge.",
    "minutes": 5,
    "level": "Beginner",
    "steps": [
      {
        "title": "What always asks",
        "text": "Sending, publishing, posting, deleting and risky shell commands."
      },
      {
        "title": "Allowed folders",
        "text": "Agents read and write only inside the folders you allow."
      },
      {
        "title": "Budgets",
        "text": "Set a credit cap per task and step limits; loops are stopped."
      },
      {
        "title": "Approve from anywhere",
        "text": "Approvals reach the web app and your linked chat channels."
      }
    ],
    "tips": [
      "Web pages are treated as data, never as instructions.",
      "Mark confidential folders as local models only."
    ]
  },
  {
    "slug": "memory",
    "track": "everyday",
    "title": "Memory and skills",
    "summary": "Teach Titan your company once, and let it save how it does things.",
    "minutes": 6,
    "level": "Intermediate",
    "steps": [
      {
        "title": "Your company profile",
        "text": "Add your products, clients and preferences."
      },
      {
        "title": "See and edit memory",
        "text": "Everything remembered is listed. Edit or forget any of it."
      },
      {
        "title": "Scopes",
        "text": "Memory is kept per company and per agent; the QA agent can't read finance notes."
      },
      {
        "title": "Skills",
        "text": "After a task, Titan saves how it did it as a skill file you can read and edit."
      }
    ],
    "tips": [
      "Skills are plain files: you can delete them at any time."
    ]
  },
  {
    "slug": "documents",
    "track": "agents",
    "title": "Ask your documents",
    "summary": "Set up the folder agent and get answers with citations.",
    "minutes": 7,
    "level": "Beginner",
    "steps": [
      {
        "title": "Add a folder",
        "text": "Choose the folder to watch. It is read-only by default."
      },
      {
        "title": "Wait for the index",
        "text": "Text is extracted and scans are read with OCR."
      },
      {
        "title": "Ask a question",
        "text": "Ask in plain words."
      },
      {
        "title": "Check the source",
        "text": "Open the cited file and page."
      }
    ],
    "tips": [
      "Spreadsheet numbers are computed, not guessed.",
      "Confidential folders can stay on local models only."
    ]
  },
  {
    "slug": "build-app",
    "track": "agents",
    "title": "Build your first app",
    "summary": "From a prompt to a working web app, previewed on your laptop.",
    "minutes": 12,
    "level": "Intermediate",
    "steps": [
      {
        "title": "Choose a target",
        "text": "Web, mobile or desktop. Start with web."
      },
      {
        "title": "Approve the plan",
        "text": "Pages, data and tasks, before any code is written."
      },
      {
        "title": "Preview and edit",
        "text": "Click an element in the preview and describe the change."
      },
      {
        "title": "Publish",
        "text": "One click for the web; versions let you roll back."
      }
    ],
    "tips": [
      "Previews and tests on your laptop cost nothing.",
      "Export the code to GitHub whenever you like."
    ]
  },
  {
    "slug": "record",
    "track": "automate",
    "title": "Record an automation",
    "summary": "Record a browser chore once and run it on a schedule.",
    "minutes": 8,
    "level": "Intermediate",
    "steps": [
      {
        "title": "Start recording",
        "text": "Do the task in the browser as usual."
      },
      {
        "title": "Edit the steps",
        "text": "Name variables like the date or a client."
      },
      {
        "title": "Add logins",
        "text": "Logins come from your OS keychain; it pauses for 2FA."
      },
      {
        "title": "Schedule it",
        "text": "Runs while the app is open and catches up on launch."
      }
    ],
    "tips": [
      "If a site changes, AI proposes a fix and asks before saving it."
    ]
  },
  {
    "slug": "watch",
    "track": "automate",
    "title": "Watch the web",
    "summary": "Set up the web watcher for laws, prices or competitors.",
    "minutes": 5,
    "level": "Beginner",
    "steps": [
      {
        "title": "Add sources",
        "text": "Paste the pages to watch."
      },
      {
        "title": "Describe what matters",
        "text": "Your company profile helps it judge."
      },
      {
        "title": "Pick a schedule",
        "text": "Daily, weekly or every few hours."
      },
      {
        "title": "Read the summary",
        "text": "Only real changes, with links."
      }
    ],
    "tips": [
      "Summaries are for your review; check the source for anything important."
    ]
  },
  {
    "slug": "marketing",
    "track": "agents",
    "title": "Brand kit and posts",
    "summary": "Build your brand kit and plan a month of posts.",
    "minutes": 9,
    "level": "Intermediate",
    "steps": [
      {
        "title": "Create the brand kit",
        "text": "It reads your website; you correct colours, fonts and tone."
      },
      {
        "title": "Pick your platforms",
        "text": "LinkedIn, Facebook, Instagram, TikTok, X: each post is sized and written for where it goes."
      },
      {
        "title": "Plan the month",
        "text": "A calendar around your dates."
      },
      {
        "title": "Post in a click",
        "text": "At the planned time you get a reminder: copy and open on the laptop, or one tap to share from your phone."
      }
    ],
    "tips": [
      "Nothing is posted without your approval."
    ]
  },
  {
    "slug": "phone",
    "track": "remote",
    "title": "Control it from your phone",
    "summary": "Pair your phone, link Telegram, and approve tasks on the go.",
    "minutes": 6,
    "level": "Beginner",
    "steps": [
      {
        "title": "Switch on remote control",
        "text": "In the desktop app, turn on remote control and add a passkey or authenticator once. Then scan the code to pair the web app or phone, and confirm on the laptop."
      },
      {
        "title": "Link Telegram",
        "text": "Message Titan; the laptop does the work while it is on."
      },
      {
        "title": "Approve from chat",
        "text": "Approval requests arrive where you are."
      },
      {
        "title": "WhatsApp, if you want",
        "text": "Bring your own WhatsApp Business account on the official API."
      }
    ],
    "tips": [
      "Commands and results are end-to-end encrypted.",
      "Deleting, payments and sending files out are approved on the laptop.",
      "Revoke all devices in one click if a phone is lost."
    ]
  },
  {
    "slug": "credits",
    "track": "models",
    "title": "Credits and your own keys",
    "summary": "What a credit is, what is free, and how to cap spending.",
    "minutes": 4,
    "level": "Beginner",
    "steps": [
      {
        "title": "What a credit is",
        "text": "1 credit = €0.01 of cloud usage at our price."
      },
      {
        "title": "What is free",
        "text": "Local models, previews, tests, documents and anything on your own key."
      },
      {
        "title": "Caps",
        "text": "Set a credit cap per task; every task shows its estimate first."
      },
      {
        "title": "Top-ups",
        "text": "Monthly credits roll over for one month; top-ups last 12 months."
      }
    ],
    "tips": [
      "Smart routing uses a strong model to plan and cheaper ones for bulk work."
    ]
  }
];

export const agentBySlug = (slug: string) => AGENTS.find((a) => a.slug === slug);
export const industryById = (id: string) => INDUSTRIES.find((i) => i.id === id);
export const trackName = (id: string) => LEARN_TRACKS.find((t) => t.id === id)?.name ?? id;
