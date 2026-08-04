// scripts/lib/sidebar.js
// -----------------------------------------------------------------------------
// Homepage right-sidebar widgets: Beginner's Corner, Popular Articles,
// Financial Calculators, and a reusable Advertisement slot. Renders into the
// existing <aside class="sidebar"> on index.html, between the
// <!-- AUTO:HOME_SIDEBAR_START/END --> markers — replacing the old
// Market Snapshot / Trending Topics / Categories cards.
//
// Content is driven entirely by config, so editors never touch template code:
//   content/config/sidebar.json      -> Beginner's Corner article slugs
//   content/config/popular.json      -> Popular Articles mode + manual list
//   content/config/calculators.json  -> Financial Calculators list
//
// All three are re-read on every `npm run publish`. Card shell markup reuses
// the homepage's existing .sb-card / .sb-title classes verbatim — only the
// widgets' internal content/links use new markup (icons, reading-time chip,
// arrow, hover states, defined in css/style.css under "Right Sidebar").
// -----------------------------------------------------------------------------
import fs from "fs";
import { PATHS, SIDEBAR_BEGINNER_MAX, SIDEBAR_POPULAR_DEFAULT_COUNT } from "./config.js";

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// Small inline SVG icons — no external icon library, so no extra requests and
// no CLS while a font/sprite loads. Each inherits color via currentColor.
// -----------------------------------------------------------------------------
const ICONS = {
  book: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  fire: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  calculator: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>`,
  megaphone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
  chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="sidebar-item-arrow"><polyline points="9 18 15 12 9 6"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  sip: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-4 4"/></svg>`,
  emi: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
  fd: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  cagr: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  loan: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  gst: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
};

function readMinutesChip(minutes) {
  if (!minutes) return "";
  return `<span class="sidebar-item-meta">${ICONS.clock} ${minutes} min</span>`;
}

// -----------------------------------------------------------------------------
// Config loading + resolution
// -----------------------------------------------------------------------------

export function loadSidebarConfig() {
  const cfg = readJsonSafe(PATHS.sidebarConfig, { beginners: [] });
  return { beginners: Array.isArray(cfg.beginners) ? cfg.beginners : [] };
}

export function loadPopularConfig() {
  const cfg = readJsonSafe(PATHS.popularConfig, { mode: "auto", count: SIDEBAR_POPULAR_DEFAULT_COUNT, manual: [] });
  return {
    mode: cfg.mode === "manual" ? "manual" : "auto",
    count: Number.isFinite(cfg.count) ? cfg.count : SIDEBAR_POPULAR_DEFAULT_COUNT,
    manual: Array.isArray(cfg.manual) ? cfg.manual : [],
  };
}

export function loadCalculatorsConfig() {
  const cfg = readJsonSafe(PATHS.calculatorsConfig, { calculators: [] });
  return Array.isArray(cfg.calculators) ? cfg.calculators : [];
}

/**
 * Resolves Beginner's Corner slugs against the live article corpus.
 * Unknown or draft/unpublished slugs are silently skipped (Step: "if an
 * article is unpublished, automatically hide it").
 */
export function resolveBeginnerArticles(articles, config) {
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  return config.beginners
    .map((slug) => bySlug.get(slug))
    .filter(Boolean)
    .slice(0, SIDEBAR_BEGINNER_MAX);
}

/**
 * Resolves the Popular Articles list.
 * - mode "manual": uses the configured slug list, in order.
 * - mode "auto" (default): featured articles first, then most recent, until
 *   `count` is reached. Swapping in real analytics later (most-viewed /
 *   trending) only requires changing the ranking here — the template and
 *   config schema don't need to change.
 * `excludeSlugs` drops articles already shown elsewhere on the homepage
 * (Featured Guides / Latest Articles) so Popular Articles doesn't just
 * repeat them.
 */
export function resolvePopularArticles(articles, config, excludeSlugs = new Set()) {
  const pool = articles.filter((a) => !excludeSlugs.has(a.slug));

  if (config.mode === "manual" && config.manual.length > 0) {
    const bySlug = new Map(pool.map((a) => [a.slug, a]));
    return config.manual.map((slug) => bySlug.get(slug)).filter(Boolean).slice(0, config.count);
  }

  const featured = pool.filter((a) => a.featured);
  const rest = pool.filter((a) => !a.featured); // already sorted newest-first by loadAllArticles()
  return [...featured, ...rest].slice(0, config.count);
}

// -----------------------------------------------------------------------------
// HTML rendering — links are relative to index.html (this sidebar only
// renders on the homepage), so article links get an "articles/" prefix.
// -----------------------------------------------------------------------------

function linkListItem(article, iconSvg) {
  return `          <li>
            <a href="articles/${article.slug}.html" class="sidebar-item-link">
              <span class="sidebar-item-icon">${iconSvg}</span>
              <span class="sidebar-item-text">
                <span class="sidebar-item-title">${escapeHtml(article.title)}</span>
                ${readMinutesChip(article.readMinutes)}
              </span>
              ${ICONS.chevron}
            </a>
          </li>`;
}

function renderBeginnersCorner(articles) {
  if (articles.length === 0) return "";
  return `        <div class="sb-card" aria-labelledby="sidebar-beginners-heading">
          <h3 class="sb-title"><span class="widget-title-icon">${ICONS.book}</span>Beginner's Corner</h3>
          <nav aria-label="Beginner-friendly guides">
            <ul class="sidebar-link-list">
${articles.map((a) => linkListItem(a, ICONS.book)).join("\n")}
            </ul>
          </nav>
        </div>`;
}

function renderPopularArticles(articles) {
  if (articles.length === 0) return "";
  return `        <div class="sb-card" aria-labelledby="sidebar-popular-heading">
          <h3 class="sb-title"><span class="widget-title-icon">${ICONS.fire}</span>Popular Articles</h3>
          <nav aria-label="Popular articles">
            <ul class="sidebar-link-list sidebar-link-list--popular">
${articles
  .map(
    (a) => `          <li>
            <a href="articles/${a.slug}.html" class="sidebar-item-link">
              ${
                a.image
                  ? `<span class="sidebar-item-thumb"><img src="${a.image.replace(/^\//, "")}" alt="" loading="lazy" width="44" height="44" /></span>`
                  : `<span class="sidebar-item-icon">${ICONS.fire}</span>`
              }
              <span class="sidebar-item-text">
                <span class="sidebar-item-title">${escapeHtml(a.title)}</span>
                ${readMinutesChip(a.readMinutes)}
              </span>
              ${ICONS.chevron}
            </a>
          </li>`
  )
  .join("\n")}
            </ul>
          </nav>
        </div>`;
}

function renderCalculators(calculators) {
  if (calculators.length === 0) return "";
  return `        <div class="sb-card sidebar-widget--highlight" aria-labelledby="sidebar-calculators-heading">
          <h3 class="sb-title"><span class="widget-title-icon">${ICONS.calculator}</span>Financial Calculators</h3>
          <nav aria-label="Financial calculators">
            <ul class="sidebar-link-list sidebar-link-list--calc">
${calculators
  .map(
    (c) => `          <li>
            <a href="${escapeHtml(c.url)}" class="sidebar-item-link">
              <span class="sidebar-item-icon">${ICONS[c.icon] || ICONS.calculator}</span>
              <span class="sidebar-item-text">
                <span class="sidebar-item-title">${escapeHtml(c.name)}</span>
                ${c.available === false ? `<span class="sidebar-item-badge">Soon</span>` : ""}
              </span>
              ${ICONS.chevron}
            </a>
          </li>`
  )
  .join("\n")}
            </ul>
          </nav>
        </div>`;
}

function renderAdvertisement() {
  return `        <div class="sb-card ad-widget" role="complementary" aria-label="Advertisement">
          <h3 class="sb-title"><span class="widget-title-icon">${ICONS.megaphone}</span>Advertisement</h3>
          <div class="ad-placeholder ad-sidebar">
            <span>Advertisement<br />Your Ad Here</span>
          </div>
        </div>`;
}

/**
 * Renders the 4 homepage sidebar widgets, in order:
 * Beginner's Corner -> Popular Articles -> Financial Calculators -> Advertisement.
 * Returns just the inner cards (no <aside> wrapper — index.html already has one).
 */
export function renderHomeSidebarWidgets(articles, excludeSlugs = new Set()) {
  const sidebarConfig = loadSidebarConfig();
  const popularConfig = loadPopularConfig();
  const calculators = loadCalculatorsConfig();

  const beginnerArticles = resolveBeginnerArticles(articles, sidebarConfig);
  const popularArticles = resolvePopularArticles(articles, popularConfig, excludeSlugs);

  const sections = [
    renderBeginnersCorner(beginnerArticles),
    renderPopularArticles(popularArticles),
    renderCalculators(calculators),
    renderAdvertisement(),
  ].filter(Boolean);

  return sections.join("\n\n");
}
