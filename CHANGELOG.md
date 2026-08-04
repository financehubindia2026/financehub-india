# Changelog

## [Unreleased] — Final Production Audit — Round 3 — 2026-08-01

### Fixed
- **WCAG AA contrast failure on default link color (High, site-wide):** computed real contrast ratios from the CSS custom properties. `a{color:var(--teal)}` (used for every inline link across all 93 pages, including 81 articles' body text) measured 3.85:1 in light mode — below the 4.5:1 AA threshold for normal text. Changed to `var(--teal-d)` (5.73–6.15:1). Also fixed `.section-eyebrow` (small bold labels), same issue.
- **Dark-mode contrast regression caught before shipping:** `--teal-d` alone measured only 2.89–3.12:1 against dark-theme backgrounds (worse than the original `--teal`). Added a dark-theme-specific override (`--teal-d: #2e93f0` inside `[data-theme="dark"]`) that measures 5.53–5.98:1 in dark mode — verified both themes pass after the fix, not just the one that prompted it.

### Documented, not auto-fixed (flagged for human decision)
- **Primary button contrast (Medium):** white text on `--teal` button backgrounds measures 4.13:1 at the buttons' actual font size (14.4px/600 weight), narrowly below the 4.5:1 normal-text threshold. Not changed — altering the primary CTA button color is a brand decision, not something to change unilaterally. See `PRODUCTION_CERTIFICATION.md` and `AUDIT_REPORT.md` for the measured numbers.
- **3 pairs of articles with overlapping title/topic targeting** — most notably `how-to-create-a-monthly-budget.html` vs. `personal-budget-guide.html` (near-identical title phrasing). Editorial decision (merge/differentiate/keep), not a technical defect.

### Verified, no changes needed (Round 3)
- Zero mixed-content (`http://`) references anywhere in HTML/CSS/JS.
- Zero orphan pages — crawled all internal links; every one of the 81 articles is reachable from the site's own navigation/category/cross-linking structure.
- No thin content — word counts computed for all 81 articles, range 499–1,248, median 849; nothing near Google's thin-content threshold.
- Touch targets (dark toggle, hamburger, back-to-top) all clear WCAG 2.2 SC 2.5.8's 24×24px minimum.
- CSS brace-balance and all 12 JS files' syntax re-verified clean after this round's changes.
- `scripts/build-partials.js --check` still reports 0/88 drift; sitemap still valid with 93 URLs; zero broken internal links; zero duplicate titles/descriptions — full regression sweep passed after the contrast fix.

### New files
- `PRODUCTION_CERTIFICATION.md` — formal certification report with per-category scores, methodology, and final verdict.

---

## [Unreleased] — Final Production Audit — Round 2 — 2026-08-01

### Fixed
- **Missing `theme-color` meta on 92/93 pages:** only the homepage had it; added `<meta name="theme-color" content="#0f7de5" />` to about, all 3 legal pages, all 81 articles, and all 7 category pages.
- **Missing `<meta name="author">` on all 93 pages:** JSON-LD had author info, but the plain HTML meta tag (which some tools/readers check directly) was absent everywhere. Added `"Financehub India"` on articles, `"FinanceHub India"` on category/legal/about/homepage.
- **Missing `fonts.gstatic.com` preconnect on 91/93 pages:** only the homepage had both required font preconnects; the other 91 pages only preconnected to `fonts.googleapis.com` (the CSS host) but not `fonts.gstatic.com` (where the actual font *files* load from), reducing the optimization's effectiveness. Added the missing preconnect to all 91 pages.
- **Non-canonical Home URL in BreadcrumbList schema on all 88 content pages:** every article/category page's breadcrumb schema pointed the "Home" item at `https://financehub-india.vercel.app/index.html`, while the site's actual canonical homepage URL is `https://financehub-india.vercel.app/` (no `/index.html`). This mismatch could confuse URL canonicalization signals in structured data. Fixed to use the canonical root URL on all 88 pages.
- **Generator script (`scripts/new-article.js`) brought in line** with all of the above so future generated articles include `theme-color`, `meta author`, the `fonts.gstatic.com` preconnect, and the corrected breadcrumb Home URL from day one.

### Verified, no changes needed (Round 2)
- Zero duplicate `<title>` or meta description values across all 93 pages.
- Zero broken internal links (re-crawled after all Round 2 edits).
- `sitemap.xml` still valid XML, 93 URLs, zero duplicates.
- `scripts/build-partials.js --check` still reports 0/88 pages out of sync — batch edits did not touch header/footer regions.
- Zero remaining `target="_blank"` links without `rel="noopener noreferrer"`.
- Zero duplicate `<h1>` elements on any page.
- `data-theme="light"` present only on `index.html`'s `<html>` tag but absent elsewhere — reviewed and confirmed harmless: the CSS `:root` block already defaults to the light theme's values, so pages without the attribute render identically; the attribute is set dynamically by `js/app.js` from `localStorage` regardless of its initial HTML value. No fix needed.

---

## [Unreleased] — Production Audit Fixes — Round 1 — 2026-08-01

### Fixed
- **Site root files unreachable:** moved `robots.txt`, `sitemap.xml`, `site.webmanifest` from `/public/` to the project root, matching every in-page reference and search-engine convention. Previously undiscoverable by crawlers on any static host.
- **Sitemap coverage:** regenerated `sitemap.xml` from 1 URL (homepage only) to 93 URLs (homepage, about, 3 legal pages, 7 category pages, 81 articles), with real `lastmod` dates and tiered `priority`/`changefreq`.
- **Missing brand assets:** added `favicon.ico`, `apple-touch-icon.png`, `logo.png`, `og-image.png`, `icon-192.png`, `icon-512.png` — none previously existed, so every reference to them (browser tab icon, JSON-LD `publisher.logo`, Open Graph/Twitter previews, PWA manifest icons) was broken.
- **Broken `about.html` reference:** created `about.html`; it was referenced in `author.url` on all 81 articles' JSON-LD but returned 404.
- **Missing social meta tags on 88 pages:** added `og:image`, `og:site_name`, `og:locale`, `twitter:title`, `twitter:description`, `twitter:image` to all 81 articles and 7 category pages (previously only the homepage had these).
- **Duplicate `<h1>` on homepage:** demoted the secondary "Market Movers" heading from `<h1>` to `<h2>`.
- **Unlabeled calculator inputs:** added `for`/`id` associations to 21 `<label>`/`<input>` pairs across all 7 homepage calculators (SIP, EMI, FD, Compound Interest, Goal, Retirement, Tax).
- **Unsafe `target="_blank"` links:** added `rel="noopener noreferrer"` to 6 links on the homepage (social share buttons, contact-form privacy policy link).
- **PWA manifest:** added 192px/512px icons (required for installability checks) and changed `display` from `"browser"` to `"standalone"`.

### Changed
- `scripts/new-article.js`: article-generation template now emits `og:image`, `og:site_name`, `og:locale`, and Twitter Card tags by default, so future articles generated via `npm run new:article` won't reproduce the meta-tag gap fixed above.

### Verified, no changes needed
- Zero duplicate element IDs across all 93 pages.
- Zero missing `alt` attributes (site uses no `<img>` tags; icon-font/emoji-based design).
- All required meta basics (`lang`, `charset`, `viewport`, title, description, canonical, robots) present and unique on every page.
- Zero `console.log`/`debugger` statements in browser-shipped JS.
- Zero broken internal links (crawled all `href`/`src` across all 93 pages).
- `scripts/build-partials.js --check` reports 0/88 pages out of sync with the shared header/footer partials.
- Contact form already had correct `label[for]`/`id` associations.
