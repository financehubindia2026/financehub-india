# FinanceHub India 🇮🇳

India's trusted finance hub — **live NIFTY 50, SENSEX, Bank Nifty, India VIX, USD/INR, Gold, Silver, Brent & WTI crude prices**, a **live market news feed**, and a full suite of SIP / EMI / FD / Compound Interest / Retirement / Tax / Goal calculators — all running **100% free** on Vercel's Hobby plan.

The original static design (layout, typography, color palette, animations, dark mode, calculators, quiz) is **fully preserved**. This project only adds: live data, automation, an API layer, SEO, and accessibility improvements.

---

## ✨ What's live vs. static

| Feature | Status |
|---|---|
| NIFTY 50 / SENSEX / Bank Nifty / India VIX | ✅ Live (refreshes every 60s) |
| USD/INR, Gold, Silver, Brent, WTI | ✅ Live (refreshes every 60s) |
| Market news (India, RBI, IPO, Mutual Funds, Global) | ✅ Live (refreshes every 15 min) |
| All dates on the page | ✅ Auto-updates to today |
| SIP / EMI / FD / CI / Retirement / Tax / Goal calculators | ✅ Unchanged, fully functional |
| Layout, CSS, dark mode, animations | ✅ 100% preserved |

---

## 📁 Project structure

```
/
├── api/
│   ├── market.js                 # Live market data (Yahoo Finance + Twelve Data fallback)
│   ├── news.js                   # Live news (GNews → NewsAPI → Finnhub fallback)
│   ├── cron-refresh-market.js    # Once-daily cache warmer for market.js
│   └── cron-refresh-news.js      # Once-daily cache warmer for news.js
├── public/
│   ├── robots.txt
│   ├── sitemap.xml
│   └── site.webmanifest
├── js/
│   ├── app.js                    # Main entry point — theme, nav, calculators, quiz, dates
│   ├── market.js                 # Fetches /api/market, renders cards/ticker/sidebar
│   └── news.js                   # Fetches /api/news, renders the news section
├── css/
│   └── style.css                 # 100% of the original design, unchanged in substance
├── index.html                    # The homepage (same structure, now wired to live data)
├── package.json
├── vercel.json
├── README.md                     # You are here
└── .env.example
```

---

## 🏗️ Architecture overview

**Type:** Static site + serverless API layer (no database, no build step, no server to manage).

```
Browser  ──polls every 60s/15min──►  Vercel Edge / Serverless Functions (/api/*)
                                              │
                                              ├─► Yahoo Finance (market data, no key)
                                              ├─► Twelve Data (market fallback)
                                              ├─► GNews → NewsAPI → Finnhub (news, first success wins)
                                              └─► Vercel KV/edge cache (5–10 min server-side cache)

Articles, calculators, quiz, dark mode  ──►  Pure static HTML/CSS/JS, no server round-trip
```

- **Content** (81 articles + 7 category pages) is hand-authored static HTML — each file is fully self-contained (own `<head>`, nav, footer, JSON-LD). This is simple and fast, but means site-wide changes (e.g. updating the nav) currently require editing every file individually. See the note in "Known limitations" below.
- **Live data** (market prices, news) is the only part with moving pieces — everything else on the page is static.
- **No database.** All content lives in the HTML files themselves; there is no CMS backend.
- **No authentication or user accounts anywhere on the site.**

### Editing the site-wide header or footer

The homepage (`index.html`) is a genuinely different page (single-page nav with `#section` anchors, different links) and is edited directly. But the header/nav and footer repeated across all 81 articles and 7 category pages are now generated from a single source of truth instead of being hand-duplicated:

```
partials/
├── site-header.html      # used by every page in articles/ and category/
├── footer-article.html   # used by every page in articles/
└── footer-category.html  # used by every page in category/
```

To change the nav, footer links, or disclaimer text across the whole site:

1. Edit the relevant file in `partials/`.
2. Run `npm run build:partials` — this injects the updated partial into all 88 article/category pages in place. (`npm run build:partials:check` does a dry run and lists which files would change, without writing anything.)
3. Commit the changed files (the partial + every regenerated page) and deploy as usual.

This keeps the deployed site exactly as it was — plain static HTML with no runtime templating or extra hosting cost — while making site-wide edits a one-file change instead of an 88-file one. (This same build pass also fixed a pre-existing bug where two category pages, Stock Market and Tax Saving, had a stale/malformed footer with broken relative links.)

### Adding a new article

New articles no longer need ~500 lines of hand-written HTML. Instead:

1. Copy `content/articles/_example.json` to `content/articles/your-slug.json` and fill it in — title, description, category, dates, keywords, the article body (same HTML you'd write inside `<article class="article-prose">`), FAQs, related articles, and sidebar links.
2. Run:
   ```bash
   npm run new:article -- content/articles/your-slug.json
   ```
3. This generates `articles/your-slug.html` with everything derived automatically and guaranteed consistent with what's on the page:
   - Meta tags, canonical URL, Open Graph tags
   - All three JSON-LD blocks (`Article`, `FAQPage`, `BreadcrumbList`) — built from the same data that renders visibly, so structured data can't drift out of sync with the page the way hand-authored SEO tags can
   - The table of contents — parsed directly from the `<h2 id="...">` / `<h3 id="...">` headings in your body HTML, so a TOC link pointing at a missing anchor is now structurally impossible
   - Word count and estimated read time
   - The shared header/footer partials (see above)
4. The command won't overwrite an existing article by accident — pass `--force` if you're intentionally regenerating one.
5. Manual steps it deliberately leaves to you: adding the new article to `public/sitemap.xml`, linking to it from a category page or other articles' "Related" sections, and proofreading the prose (the generator checks structure, not content quality).

### Known limitations (for a technical buyer's due diligence)
- No automated test suite yet — API fallback chains and article HTML have been verified manually.
- No hosted admin panel — `npm run new:article` (above) replaces most of the manual-HTML pain of adding content, but it's a local CLI script, not a web UI. A hosted CMS would still need a database and auth layer, which is a meaningfully bigger — and no longer free — undertaking.

---

## 🧠 How the live data works

### Market data (`/api/market`)
- **Primary source:** Yahoo Finance's public quote endpoint (no API key needed) — covers `^NSEI` (Nifty 50), `^BSESN` (Sensex), `^NSEBANK` (Bank Nifty), `^INDIAVIX`, `INR=X` (USD/INR), `GC=F` (Gold futures), `SI=F` (Silver futures), `BZ=F` (Brent), `CL=F` (WTI).
- **Fallback:** [Twelve Data](https://twelvedata.com) free tier (800 requests/day) is used per-field if Yahoo is unreachable for forex/commodities.
- Gold and Silver are converted from USD/troy-oz into **₹ per 10 grams** and **₹ per kilogram** respectively, using the live USD/INR rate.
- Responses are cached **server-side for 5 minutes** and the HTTP response includes `Cache-Control` headers so Vercel's Edge Network can also cache it. This keeps you comfortably within all free-tier rate limits even with real traffic.
- The browser polls this endpoint **every 60 seconds** (per the original spec) — most of those requests are served instantly from cache, only refreshing upstream every 5 minutes.

### News (`/api/news`)
- Tries, in order: **GNews → NewsAPI → Finnhub**. The first provider that returns results wins; if all three fail, the last successful cached response is served instead of an empty/broken UI.
- Search covers Indian stock market news, RBI/monetary policy, IPOs, mutual funds, and global market cues. Use the category pills in the News section to filter.
- Cached server-side for **10 minutes**; the browser polls every **15 minutes**.

### Why both client polling AND a cron job?
Vercel's **Hobby (free) plan only allows cron jobs to run once per day** — any more frequent schedule fails at deploy time. So:
- The **cron jobs** (`/api/cron-refresh-market`, `/api/cron-refresh-news`) just pre-warm the cache once a day, so the very first visitor doesn't hit a cold cache.
- **Actual freshness throughout the day** comes from real visitors' browsers polling the API directly (60s for market, 15min for news) — the server-side cache (5–10 min) absorbs repeat requests so you never come close to any free API's rate limit, even with many simultaneous visitors.

If you later upgrade to Vercel Pro, you can safely tighten the cron schedules in `vercel.json` (e.g. `*/15 * * * *`) for an extra layer of cache-warming — see the comment in that file.

---

## 🔑 Getting free API keys

You need **at least one** news provider key and (optionally) one market-data fallback key. The site works with zero keys configured (Yahoo Finance needs none), but news requires at least GNews or NewsAPI.

| Service | Free tier | Sign up |
|---|---|---|
| GNews (news, primary) | 100 requests/day | https://gnews.io |
| NewsAPI (news, fallback) | 100 requests/day (dev use) | https://newsapi.org/register |
| Finnhub (news, last-resort fallback) | 60 calls/minute | https://finnhub.io/register |
| Twelve Data (market fallback) | 800 requests/day | https://twelvedata.com/pricing |

None of these require a credit card for the free tier.

---

## 🚀 Step-by-step: GitHub + Vercel deployment

### 1. Push the project to GitHub

```bash
cd financehub-india
git init
git add .
git commit -m "Initial commit: FinanceHub India with live data"
git branch -M main
git remote add origin https://github.com/<your-username>/financehub-india.git
git push -u origin main
```

> Make sure `.env` (if you create one locally) is in `.gitignore` — never commit real API keys.

### 2. Import the project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Click **"Import Project"** and select your `financehub-india` repository.
3. Framework Preset: choose **"Other"** (this is a plain static site + serverless functions, no build step needed).
4. Leave **Build Command** and **Output Directory** blank/default — Vercel will serve `index.html` and the `/api` functions automatically.
5. Click **Deploy**. The first deploy will succeed even without API keys (Yahoo Finance needs none, and the news section will gracefully show an error card until you add a news key).

### 3. Configure environment variables

In your Vercel dashboard:

**Project → Settings → Environment Variables**, add each of the following (use the same names as in `.env.example`):

| Key | Value | Required? |
|---|---|---|
| `GNEWS_API_KEY` | your GNews key | Recommended |
| `NEWSAPI_KEY` | your NewsAPI key | Optional (fallback) |
| `FINNHUB_API_KEY` | your Finnhub key | Optional (fallback) |
| `TWELVE_DATA_API_KEY` | your Twelve Data key | Optional (fallback) |
| `CRON_SECRET` | a random 16+ character string (e.g. from `openssl rand -hex 16`) | Recommended |

Set each variable for **Production**, **Preview**, and **Development** environments (Vercel shows checkboxes for each when adding a variable).

After adding variables, go to **Deployments** → click the **"⋯"** menu on the latest deployment → **Redeploy** (environment variables only take effect on a new deployment).

### 4. Verify live data is working

1. Open your deployed site (e.g. `https://financehub-india-yourname.vercel.app`).
2. **Market cards**: within ~1 second you should see the skeleton loaders replaced by real numbers for Nifty 50, Sensex, Bank Nifty, India VIX, USD/INR, Gold, Brent, and WTI. The small green dot next to "Live Data" should be pulsing.
   - To confirm it's truly live, open `https://your-site.vercel.app/api/market` directly in a new tab — you should see a JSON response with an `updatedAt` timestamp and a `market` object.
3. **News section**: scroll to "Latest Financial News" — you should see a featured headline with an image, a 3-item side list, and a grid of more stories, each with a source name, a relative timestamp ("2 hr ago"), and a working "Read More →" link.
   - Confirm directly via `https://your-site.vercel.app/api/news` — look for a `provider` field telling you which API actually served the data (`gnews`, `newsapi`, or `finnhub`).
4. **Auto-refresh**: leave the tab open — market numbers should visibly update within 60 seconds, and news within 15 minutes, with no page reload.
5. **Dark mode, calculators, quiz**: click through these to confirm they behave exactly as before — nothing about their logic changed.

If a card shows "Unavailable" or the news section shows an error card with a "Retry" button, check the **Vercel → Project → Logs** tab for the specific upstream error message (each API route returns a descriptive `message` field on failure).

### 5. (Optional) Add a custom domain

**Project → Settings → Domains** → add your domain and follow the DNS instructions Vercel provides. This step is free on Hobby; only the domain registration itself (if you don't already own one) costs money.

---

## 💻 Local development

```bash
npm install -g vercel   # one-time, if you don't have the Vercel CLI
npm install
vercel link             # links this folder to a Vercel project (creates one if needed)
vercel env pull .env    # pulls your configured env vars into a local .env file
npm run dev              # runs `vercel dev` — serves index.html + /api routes locally
```

Then open `http://localhost:3000`.

To deploy straight from your machine instead of via GitHub pushes:

```bash
vercel --prod
```

---

## 🛡️ Security notes

- API keys are **only** read inside `/api/*.js` server-side functions via `process.env.*` — they are never included in any response sent to the browser, and never appear in `index.html`, `css/`, or `js/`.
- `/api/cron-refresh-market` and `/api/cron-refresh-news` check an optional `CRON_SECRET` so the public can't trigger them directly to drain your free-tier quota.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are set globally in `vercel.json`.

---

## ♿ Accessibility & SEO

- Skip-to-content link, ARIA labels on icon-only buttons, `aria-live` regions on areas that update dynamically (market cards, news), `aria-expanded`/`aria-pressed` state on toggles, and semantic landmarks (`<header>`, `<nav>`, `<footer>`).
- All native `<input type="range">` calculator sliders are keyboard-operable by default and already have associated `<label>` elements.
- Open Graph + Twitter Card meta tags, JSON-LD structured data (`WebSite`, `NewsArticle`, `FinancialService`), `robots.txt`, and `sitemap.xml` are all included — update the placeholder `financehub-india.vercel.app` URLs throughout `index.html`, `public/robots.txt`, and `public/sitemap.xml` once you know your final domain.

---

## 🧩 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| All market cards show "Unavailable" | Yahoo Finance temporarily blocked the request, and no `TWELVE_DATA_API_KEY` is set | Add a free Twelve Data key as a fallback |
| News section shows the error card | No news API key configured, or all three failed | Double-check `GNEWS_API_KEY` is set and the deployment was redeployed after adding it |
| Cron job fails to deploy | Schedule in `vercel.json` is more frequent than once/day | Hobby plan hard limit — keep cron at once/day; rely on client polling for freshness |
| Values look stale for a long time | Server cache (5–10 min) + your browser tab has been open a while | Wait for the next poll interval, or hard-refresh the page |

---

## 🤝 Handover / ownership notes

For anyone acquiring or taking over this project:

**Ongoing costs at present scale:** $0. Hosting (Vercel Hobby), all market-data sources, and all news API tiers used here are free-tier. See "🔑 Getting free API keys" above for each provider's free-tier limit — the site is architected to stay comfortably under all of them via server-side caching, even with real traffic.

**What you're acquiring:**
- Full source: static site, `/api` serverless functions, all 81 articles + 7 category pages, CSS/JS, and this README.
- No third-party accounts transfer automatically — you'll need to create your own free accounts with Vercel and whichever data providers you choose (GNews, NewsAPI, Finnhub, Twelve Data) and add your own keys per the steps above. None of the current provider accounts or keys are part of this transfer.
- The domain `financehub-india.vercel.app` is a free Vercel subdomain, not a registered domain — if a custom domain was purchased separately, confirm its transfer directly with the registrar.

**License:** See `LICENSE`. This is proprietary, not open-source — full rights transfer to the buyer on completion of an agreed sale.

**What has NOT been verified independently by the seller:** actual production traffic/analytics history, AdSense approval status (the codebase has AdSense integration scaffolded but inactive — see the comment in `js/app.js`), and search ranking history. Ask for these separately if they factor into valuation.

---

Built for Indian investors. 🇮🇳

---

## 📝 Content CMS — Markdown-Based Publishing (added Aug 2026)

Articles are now authored in **Markdown**, not hand-written HTML. A build pipeline turns `content/articles/*.md` into the full static site — pages, SEO, category/tag/archive listings, the homepage, sitemap, RSS, and search index — automatically.

### Daily workflow — new article

```bash
npm run new:article -- "Cryptocurrency Basics for Beginners" --category="Cryptocurrency"
# → creates content/articles/cryptocurrency-basics-for-beginners.md

# write the article body in your editor, then:
npm run validate     # optional — checks front matter, slugs, links, images
npm run publish       # builds everything

git add .
git commit -m "Publish article"
git push
```

### Daily workflow — edit an existing article

```bash
# edit content/articles/<slug>.md directly
npm run publish
git add . && git commit -m "Update article" && git push
```

### Front matter fields

```yaml
---
title: Cryptocurrency Basics for Beginners
slug: cryptocurrency-basics-for-beginners     # optional — derived from filename if omitted
description: A short SEO description.
category: Cryptocurrency                      # new categories are auto-created
tags: [Cryptocurrency, Bitcoin, Blockchain]
author: Financehub India            # optional — defaults to this
date: 2026-08-01
updated:                                       # optional — defaults to `date`
featured: false
image:                                         # optional cover image path
coverAlt:
faqs:                                          # optional — renders an FAQ section + FAQPage schema
  - question: Is crypto legal in India?
    answer: Yes, though gains are taxed at a flat 30%.
---
```

### Markdown body support

Headings (`##`/`###` — auto-generate anchor IDs and populate the table of contents), lists, tables (GFM), fenced code blocks, images (auto lazy-loaded), blockquotes, links, footnotes (`[^1]`), emoji shortcodes, raw HTML blocks, and:

- **Admonitions**: `::: note`, `::: tip`, `::: warning`, `::: danger` … `:::`
- **Video embeds**: `::: video https://youtube.com/watch?v=XXXX \n :::`

### What `npm run publish` does automatically

1. Reads every `content/articles/*.md` file
2. Validates front matter, slugs (duplicates, format), dates, and broken image/internal links — **stops the build on errors**
3. Renders each article to `articles/<slug>.html` using the existing header/footer partials and CSS — nothing about the visual design changes
4. Generates full SEO: title, description, canonical, Open Graph, Twitter Card, `Article` + `FAQPage` + `BreadcrumbList` JSON-LD
5. Computes reading time, table of contents, related articles, prev/next, sidebar links — no manual curation needed
6. Updates the homepage's Featured Guides and Latest Articles sections in place
7. Creates/updates `category/<slug>.html` for every category referenced in front matter — brand-new categories are created automatically
8. Creates/updates `tag/<slug>.html` for every tag
9. Creates/updates `archive/<year>.html` + `archive/index.html`
10. Regenerates `search.json`, `rss.xml`, and `sitemap.xml`
11. Verifies `robots.txt` points at the sitemap (never overwrites your custom rules)

Only articles whose Markdown content changed since the last build are re-rendered (incremental build, tracked in `generated/.build-cache.json`); homepage/category/tag/archive/sitemap/RSS/search are cheap enough to always regenerate in full.

### Other commands

| Command | What it does |
|---|---|
| `npm run validate` | Checks all Markdown/SEO without writing any files |
| `npm run migrate` | One-time: converts `articles/*.html` into `content/articles/*.md` (already run — all 81 original articles are migrated) |
| `npm run clean` | Deletes only files the pipeline generated (tracked in `generated/.manifest.json`) — never touches `content/`, `partials/`, `css/`, `js/`, or hand-authored pages |
| `npm run publish:force` | Ignores the incremental-build cache and re-renders every article |

### Notes on the migration

- All 81 original articles were converted from HTML to Markdown, preserving their **exact URLs**, SEO metadata, JSON-LD, dates, tags, and FAQs (pulled straight from the existing `Article` schema in each page, not retyped).
- A few hand-styled components (the "Did You Know" fact callout, checklist boxes, and data tables) don't have a clean Markdown equivalent, so the migration preserves them as raw HTML blocks inside the `.md` files — they render identically.
- The original category pages had hand-curated sub-groupings (e.g. "Tax Saving Basics" / "Investment Options" / "By Situation"). The automated category pages generate a single chronological grid instead, since sub-grouping isn't derivable from front matter alone. If you want that structure back, it can be added as an optional `pillarGroup:` front-matter field — just ask.
- Tag pages are generated for every tag used anywhere, including tags that currently appear on only one article. With 81 articles this produced 408 tag pages, many with just 1–2 entries — worth pruning or consolidating tags over time if thin tag pages are a concern for SEO.

---

## 🗂️ Homepage Right Sidebar (added Aug 2026)

The homepage's right sidebar (in the "Market Movers" section, inside `<aside class="sidebar">` between the `<!-- AUTO:HOME_SIDEBAR_START/END -->` markers in `index.html`) has four config-driven widgets, in this order: **Beginner's Corner**, **Popular Articles**, **Financial Calculators**, **Advertisement** — replacing the old Market Snapshot / Trending Topics / Categories cards. It's rendered by `scripts/lib/sidebar.js` and rebuilt every `npm run publish` — no template edits needed for day-to-day changes. Article pages keep their original, unmodified sidebar (Ad + "More in `<Category>`").

| Widget | Config file | Behavior |
|---|---|---|
| 📚 Beginner's Corner | `content/config/sidebar.json` | Fixed list of article slugs, in order. Unknown/removed slugs are skipped automatically. |
| 🔥 Popular Articles | `content/config/popular.json` | `mode: "auto"` (default) ranks featured articles first, then most recent — excluding whatever's already shown in Featured Guides/Latest Articles above, so it doesn't just repeat them. `mode: "manual"` uses a fixed slug list instead. |
| 🧮 Financial Calculators | `content/config/calculators.json` | Ordered list of `{name, icon, url, available}`. Add an entry to add a calculator to the sidebar — no code change. `available: false` shows a "Soon" badge. URLs are relative to `index.html` (e.g. `#calculators`), since this sidebar only renders on the homepage. |
| 📢 Advertisement | — | Reuses the existing `.ad-placeholder.ad-sidebar` component (already CLS-safe at a fixed 300×250 desktop height). Swap the placeholder markup in `scripts/lib/sidebar.js` → `renderAdvertisement()` for a real ad snippet later — no layout changes needed elsewhere. |

Edit any of the three JSON files and run `npm run publish` to update the homepage.

**Note:** CAGR, Loan, and GST calculators are listed per the config but aren't built yet on the homepage — they currently link to the calculators section with a "Soon" badge rather than a dead link or fake anchor. Once those calculators exist, flip `available` to `true` and point `url` at the specific tool.

**Responsive:** the sidebar sits alongside the "Market Movers" content in a two-column grid on desktop, and stacks below it on tablet/mobile (below 900px) — it no longer disappears at that breakpoint the way the old Market Snapshot/Trending Topics/Categories sidebar did.
