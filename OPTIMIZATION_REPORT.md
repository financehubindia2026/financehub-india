# Optimization Report

This report covers performance, SEO discoverability, accessibility, and security posture — the checkable, structural side of "production-ready." It does not include a fabricated Lighthouse score; see the note at the end on how to get a real one.

## Performance

**Already good, unchanged:**
- Zero `<img>` tags anywhere in the site — content uses emoji/CSS icons instead of raster images, which sidesteps a huge share of typical performance issues (oversized images, missing dimensions, layout shift from image loading) entirely.
- `css/style.css` is already externalized (not inlined), enabling separate browser/CDN caching, and `vercel.json` sets `Cache-Control: immutable` on `/css/` and `/js/` for a full year — correct for hashless static assets.
- Google Fonts are loaded with `rel="preconnect"` to both `fonts.googleapis.com` and `fonts.gstatic.com`, and the font stylesheet uses `display=swap`, which avoids invisible-text flashes (FOIT) while fonts load.
- `js/app.js` loads as `<script type="module" src="js/app.js">` at the end of `<body>` — modules are deferred by default, so this doesn't block rendering.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are already configured in `vercel.json`.

**Fixed this pass (Round 1):**
- Added real, appropriately-sized brand images (favicon multi-size ICO, 180px touch icon, 512px logo, 1200×630 OG image) rather than leaving broken references — this avoids failed network requests and layout hiccups from missing assets, and unblocks social-preview rendering (which affects click-through, not raw Lighthouse performance score, but is part of a production-ready launch).

**Fixed this pass (Round 2):**
- 91 of 93 pages were missing the `fonts.gstatic.com` preconnect — only `fonts.googleapis.com` (which serves the font *CSS*) was preconnected; `fonts.gstatic.com` (which serves the actual font *files* the browser downloads) was not. Added the missing preconnect to all 91 pages, so the connection-warmup optimization is now fully applied site-wide instead of only on the homepage.

**Not verified in this pass (needs a live URL):**
- Real Core Web Vitals (LCP/CLS/INP) — these depend on actual network conditions and rendering, which requires a deployed URL and a real Lighthouse/PageSpeed Insights run.
- Whether the two Google Fonts (`Inter`, `Sora`, 8 total weights) are fully utilized or could be trimmed — a font-usage audit needs to cross-reference every `font-weight` actually rendered, which is more reliably done with a browser coverage tool against the live site than static analysis.

## SEO

**Fixed this pass (Round 1)** (see AUDIT_REPORT.md for full detail):
- `robots.txt` and `sitemap.xml` moved to a location where crawlers can actually find them — arguably the highest-leverage fix in this entire audit, since a sitemap crawlers can't reach is equivalent to not having one.
- `sitemap.xml` expanded from 1 URL to 93, with real lastmod dates.
- Open Graph/Twitter completeness fixed on 88 pages, so shared links render previews instead of blank cards.
- `about.html` created, resolving 81 broken `author.url` references in JSON-LD `Person` schema (structured data pointing at a 404 can suppress rich-result eligibility for the affected field).
- Single, correct H1 hierarchy restored on the homepage.

**Fixed this pass (Round 2):**
- `theme-color` meta was present only on the homepage; added to the other 92 pages for consistent browser-chrome theming.
- `<meta name="author">` was missing site-wide (JSON-LD had author data, but the plain meta tag some tools read directly did not exist anywhere); added to all 93 pages.
- All 88 articles/category pages' `BreadcrumbList` structured data pointed "Home" at `/index.html` while the site's actual canonical homepage URL is `/` — a genuine structured-data/canonical mismatch that Google's Rich Results tooling flags. Normalized to the canonical form on all 88 pages.

**Already correct, verified:**
- Every article carries `Article` + `FAQPage` JSON-LD, generated from the same data that renders the visible page (per the project's own generator script), so structured data can't silently drift from content.
- Canonical URLs, unique titles, and unique meta descriptions present on all 93 pages.
- `robots: index, follow` set consistently; `robots.txt` correctly disallows only `/api/` (data endpoints, not content).

## Accessibility

**Fixed this pass (Round 1):**
- 21 calculator inputs (7 calculators × 3 inputs each) across the homepage now have properly associated `<label for>` elements — previously, screen reader users would have heard "slider" with no indication of what it controlled.

**Fixed this pass (Round 3):**
- Computed real WCAG contrast ratios (not visual estimation) for every color pair in the site's CSS custom properties, in both light and dark themes. Found and fixed a genuine AA failure: the default link color across all 93 pages measured 3.85:1 (needs 4.5:1). Fixed to a theme-aware darker/brighter variant depending on mode — verified 5.5:1+ in both themes after the change, including catching and fixing a dark-mode regression the naive one-line fix would have introduced.
- **Flagged, not changed:** primary button text (white on brand-teal background) measures 4.13:1 at actual button font size — narrowly below 4.5:1. Left as a documented recommendation since changing the primary CTA color is a brand decision.

**Already good, verified:**
- Skip-to-content link present on every content page.
- `aria-label`, `aria-pressed`, `aria-expanded`, `aria-controls` used correctly on icon-only buttons (dark mode toggle, hamburger menu).
- `aria-live` regions present for dynamically-updating content (market cards, news feed).
- Contact form already fully labeled with `for`/`id` pairs and `required` attributes.

**Not verified in this pass (needs a browser):**
- Actual color contrast ratios in both light and dark themes — CSS custom properties were reviewed for anything alarming, but WCAG contrast math needs rendered, computed colors, which is best checked with a browser extension (e.g. axe DevTools) against the live site.
- Full keyboard-navigation walkthrough (tab order, focus traps in the mobile menu) — static analysis can confirm the right ARIA attributes exist, but not that focus actually moves correctly at runtime.

## Security

**Fixed this pass:**
- 6 `target="_blank"` links now carry `rel="noopener noreferrer"`, closing a minor reverse-tabnabbing exposure and a standard Lighthouse Best Practices flag.

**Already good, verified:**
- `vercel.json` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` restricting geolocation/camera/microphone.
- No real secrets in the repository — `.env.example` contains only placeholder values with clear setup instructions; API keys for market/news data are read server-side only in `/api/*.js`.
- The EmailJS key visible in `index.html` is a public key by EmailJS's own design (meant to be embedded client-side) — not a credential leak.

## How to get a real Lighthouse score
Deploy the fixed project (Vercel, since `/api/*.js` needs a Node serverless runtime for live data — see AUDIT_REPORT.md's note on hosting), then run Lighthouse either via Chrome DevTools or `npx lighthouse <url> --view` against the live URL. The fixes in this pass target the specific line items Lighthouse checks (manifest icons, `rel=noopener`, single H1, canonical/OG tags, labeled form controls) — but only a real run against a real deployment can produce a real number.
