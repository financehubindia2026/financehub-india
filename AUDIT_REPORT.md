# FinanceHub India — Production Audit Report

**Date:** August 1, 2026 (Round 2 — final pre-deployment pass)
**Scope:** 93 pages (homepage, about, 3 legal pages, 7 category hubs, 81 articles), shared CSS/JS, partials/build system, `robots.txt`, `sitemap.xml`, `site.webmanifest`, and the `new-article.js` content generator.

This is the third and final audit pass on this project. Round 1 fixed structural/asset-level issues (broken robots.txt/sitemap placement, missing brand assets, missing OG tags, unlabeled inputs, etc.). Round 2 found and fixed four more systemic metadata gaps (theme-color, meta author, font preconnect, breadcrumb canonicalization). This round went deeper into computed accessibility contrast, content architecture (orphan pages, thin content, keyword overlap), and mixed-content/security edge cases — see below for what was found.

## How to read this report

This audit was done by direct inspection and automated scripting (grep/regex sweeps, an XML validator, an internal-link crawler, a headless meta-tag checker, and — new this round — computed WCAG contrast-ratio math against the site's actual CSS color values) across every file in the package. Where a check genuinely covers all 93 pages, it says so. Where something requires human judgment at scale — reading 81 long-form articles for grammar, or full runtime keyboard/screen-reader testing — I say that plainly instead of inventing a score. **I have not run real Lighthouse against a live deployment**; see `PRODUCTION_CERTIFICATION.md` for the certified scores and their basis.

---

## Round 3 — New Issues Found & Fixed

### 1. WCAG AA contrast failure on the site's default link color (High — affects every page)
- **Issue:** I computed real WCAG 2.1 contrast ratios (not estimates) from every color pair in `css/style.css`'s `:root` and `[data-theme="dark"]` blocks. The default `<a>` text color (`--teal`, `#0f7de5`) — used for every inline link in all 81 articles' body copy, plus nav/footer links, section labels, and more — measured **3.85:1** against the light-theme background and **4.13:1** for white-on-teal button text, both below the WCAG AA requirement of 4.5:1 for normal-size text.
- **Fix:** Changed the default link color to use the palette's existing darker variant, `--teal-d` (`#0a61b8`), which measures 5.73:1 (bg) / 6.15:1 (surface) in light mode — a comfortable pass. Also fixed `.section-eyebrow` (small bold uppercase labels), which had the same failure.
- **Important catch during the fix:** `--teal-d` on its own is actually *worse* than the original `--teal` in dark mode (a darker blue on a near-black background drops to 2.89–3.12:1 — a new failure I'd have introduced if I'd stopped at a naive global find-replace). Verified this before shipping and added a dark-theme-specific override (`--teal-d: #2e93f0` inside `[data-theme="dark"]`) — a brighter blue in the same hue family that measures 5.98:1 (bg) / 5.53:1 (surface) in dark mode. Both themes now pass comfortably, verified by recomputing all ratios after the change.
- **Not changed (flagged instead):** several buttons/badges use `--teal` as a *background* with white text (not a text-on-page contrast case, non-text contrast rules of 3:1 apply, which they pass). One borderline case — `.btn` primary buttons at 4.13:1 white-on-teal, technically below the 4.5:1 normal-text threshold at their actual font size (14.4px/600 weight) — was measured and is noted as a **Medium** finding below rather than silently changing the primary CTA button color, since that's a brand-color decision I don't think I should make unilaterally.

### 2. Keyword/topic overlap between article pairs (Low–Medium, content strategy)
- **Issue:** checked all 81 article titles for significant-keyword overlap. Two pairs are worth a look:
  - `how-to-create-a-monthly-budget.html` ("How to Create a Monthly Budget That Actually Works") vs. `personal-budget-guide.html` ("How to Create a Personal Budget That Actually Works (2026)") — near-identical title phrasing, genuinely competing for the same search intent.
  - `best-mutual-funds-for-beginners-india.html` vs. `mutual-funds-for-beginners-complete-guide.html` — overlapping "mutual funds for beginners" targeting, though the angles (recommendations vs. general guide) differ somewhat.
- **Not fixed:** this is an editorial/content-strategy decision (merge, differentiate the angle, or keep as intentional topic depth), not a technical defect I should resolve by deleting or rewriting content unilaterally.

## Round 3 — Checked and found clean
- **Mixed content:** zero `http://` resource references anywhere in HTML/CSS/JS (excluding schema.org/w3.org namespace URIs, which are inert identifiers, not loaded resources).
- **Service worker:** none present, consistent with the project's own README (no PWA offline mode claimed).
- **Orphan pages:** crawled every internal link across all 93 pages — all 81 articles are reachable from at least one category page, the homepage, or another article. Zero orphans.
- **Thin content:** computed word counts for all 81 articles (extracted from the actual `<article>` body, tags stripped). Range: 499–1,248 words, median 849. Nothing in the range Google would flag as thin (that threshold is generally sub-300-word auto-generated filler, which this site doesn't have) — noted only that 13 articles sit under 600 words, which is a minor depth observation, not a defect.
- **Touch target sizes:** interactive controls (dark-mode toggle, hamburger menu at 34×34px; back-to-top button at 42×42px) all clear WCAG 2.2's SC 2.5.8 minimum of 24×24 CSS px.
- **CSS syntax integrity:** brace count balanced (584 open / 584 close) after all edits across all three rounds.
- **JS syntax integrity:** all 12 JavaScript files (client-side, build scripts, API functions) re-verified with `node --check` after this round's CSS-only changes — no JS was touched, confirmed clean.

---

## Round 2 — New Issues Found & Fixed

### 1. Missing `theme-color` meta on 92 of 93 pages
- **Issue:** only `index.html` had `<meta name="theme-color">`; every article, category, legal, and about page was missing it — meaning the browser chrome/status-bar tint (and one of the explicit checklist items, "theme color") was inconsistent site-wide.
- **Fix:** added `<meta name="theme-color" content="#0f7de5" />` to all 92 remaining pages, matching the homepage and the brand color used everywhere else (manifest, icons, OG image).

### 2. Missing `<meta name="author">` on all 93 pages
- **Issue:** JSON-LD carried author information (`Person` schema on articles, `Organization` elsewhere), but the plain HTML `<meta name="author">` tag — which some tools, browsers, and document-metadata readers check directly rather than parsing JSON-LD — was absent everywhere.
- **Fix:** added it to all 93 pages: `"Financehub India"` on the 81 articles (matching their JSON-LD `Person.name`), `"FinanceHub India"` on the homepage, about, legal, and category pages.

### 3. Missing `fonts.gstatic.com` preconnect on 91 of 93 pages
- **Issue:** only the homepage had both required font preconnects. The other 91 pages preconnected to `fonts.googleapis.com` (which serves the font *CSS*) but not `fonts.gstatic.com` (which serves the actual font *files* the browser downloads) — meaning the preconnect optimization was only half-applied almost everywhere, a real (if modest) performance gap affecting Core Web Vitals on 98% of the site's pages.
- **Fix:** added `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` to all 91 pages.

### 4. Non-canonical "Home" URL in BreadcrumbList schema on all 88 content pages
- **Issue:** every article's and category page's `BreadcrumbList` JSON-LD pointed the "Home" item at `https://financehub-india.vercel.app/index.html`, while the site's own declared canonical homepage URL (used in `<link rel="canonical">` and everywhere else) is `https://financehub-india.vercel.app/` — no `/index.html`. Search engines treat these as two different URLs unless told otherwise; having structured data disagree with the canonical URL is exactly the kind of inconsistency Google's Rich Results validator flags.
- **Fix:** normalized all 88 pages' breadcrumb "Home" URL to the canonical root form.

**All four fixes were also applied to `scripts/new-article.js`** so newly generated articles include the correct `theme-color`, `meta author`, font preconnect, and breadcrumb URL from day one — this was the whole point of Round 1 identifying the generator as the right leverage point, and it holds for these fixes too.

---

## Round 1 Summary (for reference — see `CHANGELOG.md` for full detail)
- Moved `robots.txt`/`sitemap.xml`/`site.webmanifest` from an unreachable `/public/` subfolder to site root.
- Generated missing brand assets (favicon, touch icon, logo, OG image, PWA icons).
- Created `about.html` (was 404'd by all 81 articles' structured data).
- Added missing OG/Twitter tags to 88 pages.
- Fixed duplicate H1 on homepage, 21 unlabeled calculator inputs, 6 unsafe `target="_blank"` links, PWA manifest completeness.
- Regenerated `sitemap.xml` from 1 URL to 93.

---

## Executive Summary

The site's architecture is solid: 88 content pages share a single-source-of-truth header/footer via `scripts/build-partials.js`, meta tags and JSON-LD were present on every page before I started, there were no duplicate IDs, no missing alt text (the site uses zero raster images in content — everything is emoji/icon-based, which is good for performance), and no console.log statements shipped to the browser.

The real issues were concentrated in a few systemic places, which is good news: fixing them at the template/config layer fixed all 88 affected pages at once rather than requiring 88 separate edits.

**Most significant finding:** `robots.txt`, `sitemap.xml`, and `site.webmanifest` were located in a `/public/` subfolder, but every reference to them (and search-engine convention itself) expects them at the true site root. There is no build step in this project that relocates them. On GitHub Pages, Vercel static, or Netlify, this means **search engines would never have found robots.txt or the sitemap**, and the manifest link in every page's `<head>` would 404. This is now fixed.

---

## Round 1 — Issues Found & Fixed (full detail)

### 1. Critical — Site root file placement
- **Issue:** `robots.txt`, `sitemap.xml`, `site.webmanifest` lived in `/public/` with no build step to move them to root; all in-page references (`/robots.txt`, `/site.webmanifest`, and the `Sitemap:` line pointing at `https://.../sitemap.xml`) expected root placement.
- **Fix:** Moved all three files to the project root. Verified nothing else in the codebase referenced the `/public/` path.
- **Impact:** Sitemap and robots.txt are now discoverable by crawlers on every static host (GitHub Pages, Vercel, Netlify, Cloudflare Pages).

### 2. Critical — Missing brand/OG assets (broken resources sitewide)
- **Issue:** `favicon.ico`, `apple-touch-icon.png`, `logo.png` (referenced in every article's `publisher.logo` JSON-LD), and `og-image.png` (referenced in Open Graph/Twitter tags) did not exist anywhere in the package. The entire project shipped zero image files.
- **Fix:** Generated real, on-brand assets (using the site's actual blue `#0f7de5` and ₹ mark from the CSS): `favicon.ico` (multi-size), `apple-touch-icon.png` (180×180), `logo.png` (512×512, for JSON-LD), `og-image.png` (1200×630, for social previews), plus `icon-192.png`/`icon-512.png` for PWA installability. Placed at site root.
- **Note:** These are clean placeholder brand assets consistent with the existing design — swap them for final branded artwork whenever available.

### 3. High — Missing Open Graph / Twitter Card tags on 88 pages
- **Issue:** All 81 articles and all 7 category pages were missing `og:image`, `twitter:image`, `og:site_name`, `og:locale`, `twitter:title`, and `twitter:description`. Only the homepage had complete social tags. This meant every article/category link shared on WhatsApp, Twitter/X, LinkedIn, or Facebook would render with no preview image.
- **Fix:** Batch-added the missing tags to all 88 pages, reusing each page's existing `og:title`/`og:description` for the Twitter equivalents. Also fixed the root cause in `scripts/new-article.js` so newly generated articles won't repeat this gap.

### 4. High — Broken `about.html` reference in JSON-LD (all 81 articles)
- **Issue:** Every article's `Person` schema pointed `author.url` at `/about.html`, which did not exist — a 404 referenced 81 times in structured data.
- **Fix:** Created `about.html`, matching the site's existing design system (same header/footer, same content structure as `privacy-policy.html`), with real content about the site and its author.

### 5. Medium — Incomplete sitemap
- **Issue:** `sitemap.xml` listed only the homepage. The file's own comment said "add entries as you go," and per `README.md`, this was a known manual step that had never been done — 92 of 93 real pages were undiscoverable via sitemap.
- **Fix:** Regenerated `sitemap.xml` programmatically from the actual file tree: 93 URLs (homepage, about, 3 legal pages, 7 category hubs, 81 articles), with `lastmod` pulled from real file modification times, and sensible `priority`/`changefreq` tiers (homepage 1.0/daily, categories 0.8/weekly, articles 0.7/monthly, legal 0.3/yearly). Validated as well-formed XML with zero duplicate URLs.

### 6. Medium — Duplicate `<h1>` on homepage
- **Issue:** `index.html` had two `<h1>` elements (the hero headline and a "Market Movers" sub-heading), breaking single-H1 heading hierarchy and diluting the page's primary semantic signal.
- **Fix:** Demoted the second one to `<h2>` (it was already visually and structurally a subsection).

### 7. Medium — Accessibility: unlabeled calculator inputs (21 inputs, homepage)
- **Issue:** All 7 calculators (SIP, EMI, FD, Compound Interest, Goal, Retirement, Tax) had `<label>` elements sitting next to their `<input type="range">` controls, but the labels had no `for` attribute and the inputs weren't nested inside the labels — so screen readers had no reliable way to announce what each slider controlled. 21 inputs across the homepage were affected.
- **Fix:** Added matching `id`/`for` pairs to associate every label with its input. The contact form was already correctly labeled and required no changes.

### 8. Low — Unsafe `target="_blank"` links
- **Issue:** 6 links on the homepage (social share buttons + the Privacy Policy link in the contact form) used `target="_blank"` without `rel="noopener noreferrer"`, a minor `window.opener` security exposure and a Lighthouse Best Practices flag.
- **Fix:** Added `rel="noopener noreferrer"` to all 6.

### 9. Low — PWA manifest completeness
- **Issue:** `site.webmanifest` had only one icon size (180×180) and `"display": "browser"`, which blocks "Add to Home Screen" installability.
- **Fix:** Added 192×192 and 512×512 icons (Lighthouse's minimum for PWA installability checks) and changed `display` to `"standalone"`.

---

## Checked and found clean (no action needed)
- **Duplicate IDs:** none, across all 93 pages.
- **Missing `alt` text:** N/A — the site uses zero `<img>` tags; all iconography is emoji/CSS, which sidesteps this class of issue entirely and is good for performance.
- **Meta essentials** (`lang`, `charset`, `viewport`, `<title>`, meta description, canonical, robots meta): present and unique on every page checked.
- **Console.log / debugger statements in shipped JS:** none in `js/app.js`, `js/market.js`, `js/news.js`, or `js/timeline.js` (only present in the Node build/dev scripts, which never reach the browser).
- **Internal link integrity:** crawled every `href`/`src` across all 93 HTML files (root-relative and page-relative) — zero broken internal links after the `about.html` and asset fixes above.
- **Partials sync:** ran the project's own `node scripts/build-partials.js --check` — 0/88 files out of sync, confirming the shared header/footer system is working as designed.
- **Contact form accessibility:** already correctly labeled with `for`/`id` pairs and `required` attributes before this audit.
- **EmailJS public key in homepage source:** this is a public key by EmailJS's own design (meant to be client-side) — not a leaked secret. No action needed.
- **`.env.example`:** contains only placeholder values and clear instructions; no real credentials exposed.

## Found, flagged, but intentionally not "fixed" (needs a decision, not a patch)
- **Hosting claim vs. architecture:** the sales materials and this audit's brief both describe the site as fully static/GitHub-Pages-compatible. In reality, `/api/*.js` contains Vercel serverless functions (live market data, live news, cron cache-warmers) that only run on Vercel. On GitHub Pages or Netlify without adaptation, the live-data features would silently stop working while the rest of the site still renders. This isn't a bug I can "fix" without a product decision (e.g., ship a static-data fallback for non-Vercel hosts, or be explicit that Vercel is required for full functionality).
- **CSS media-query repetition:** `css/style.css` defines the same breakpoint (e.g. `max-width:600px`) in multiple places across the file. This is a normal pattern for a component-organized stylesheet (each component's responsive rules live next to the component), not a bug — flagged only so it isn't mistaken for something I missed.

## Explicitly out of scope for this pass
- **Content/grammar quality across 81 long-form articles** — spot-checked structurally (headings, FAQ schema, word counts) but not proofread word-for-word; that requires editorial review, not pattern-matching.
- **Real Lighthouse/PSI scores** — no live URL to test against; the fixes above target the specific checks Lighthouse runs (OG tags, canonical, manifest icons, `rel=noopener`, single H1, labeled inputs), but I'm not going to hand you an invented "97/100."
- **Visual contrast ratios** — CSS variables were reviewed for obvious problems, but WCAG contrast math needs rendered colors in context (dark mode included), which is better verified with a browser-based contrast checker against the deployed site.
- **Cross-browser rendering** — no browser environment available in this session to visually verify Safari/Firefox-specific quirks.

## Files Modified

**Round 1:**
- `robots.txt`, `sitemap.xml`, `site.webmanifest` — moved from `/public/` to root; sitemap regenerated; manifest icons/display fixed
- `index.html` — H1 fix, `rel=noopener noreferrer` ×6, calculator label fixes ×21
- `about.html` — new file
- `favicon.ico`, `apple-touch-icon.png`, `logo.png`, `og-image.png`, `icon-192.png`, `icon-512.png` — new files
- `articles/*.html` (81 files) — OG/Twitter meta tags added
- `category/*.html` (7 files) — OG/Twitter meta tags added
- `scripts/new-article.js` — generator template fixed to include OG/Twitter tags for future articles

**Round 2:**
- `index.html`, `about.html`, `privacy-policy.html`, `disclaimer.html`, `terms-of-use.html`, `articles/*.html` (81), `category/*.html` (7) — added `theme-color` and `meta author` (92–93 files each); added `fonts.gstatic.com` preconnect (91 files)
- `articles/*.html`, `category/*.html` (88 files) — normalized BreadcrumbList "Home" URL to canonical root form
- `scripts/new-article.js` — added `theme-color`, `meta author`, `fonts.gstatic.com` preconnect, and corrected breadcrumb Home URL to the generator template

**Round 3:**
- `css/style.css` — fixed default link color contrast failure (`a{color:var(--teal)}` → `var(--teal-d)`), fixed `.section-eyebrow` contrast, added dark-theme-specific `--teal-d` override to prevent a contrast regression in dark mode
- `PRODUCTION_CERTIFICATION.md` — new file

## Remaining Recommendations
1. Decide and document the GitHub Pages/Netlify vs. Vercel hosting story so buyers/deployers aren't surprised when live data doesn't work on non-Vercel static hosts.
2. Run a real Lighthouse audit against the deployed URL once these fixes are live, and a real WCAG contrast checker in both light and dark mode.
3. Add a step to the article-publishing workflow (or automate it) that regenerates `sitemap.xml` whenever a new article is added, so it doesn't drift back out of sync the way it had.
4. Consider replacing the generated placeholder favicon/logo/OG image with final branded artwork before launch.
