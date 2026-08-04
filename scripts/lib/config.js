// scripts/lib/config.js
// -----------------------------------------------------------------------------
// Single source of truth for site-wide constants used across every CMS script.
// -----------------------------------------------------------------------------
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, "..", "..");
export const SITE_URL = "https://financehub-india.vercel.app";
export const SITE_NAME = "FinanceHub India";
export const DEFAULT_AUTHOR = "Financehub India";

export const PATHS = {
  contentArticles: path.join(ROOT, "content", "articles"),
  contentDrafts: path.join(ROOT, "content", "drafts"),
  contentImages: path.join(ROOT, "content", "images"),
  contentAuthors: path.join(ROOT, "content", "authors"),
  contentConfig: path.join(ROOT, "content", "config"),
  sidebarConfig: path.join(ROOT, "content", "config", "sidebar.json"),
  popularConfig: path.join(ROOT, "content", "config", "popular.json"),
  calculatorsConfig: path.join(ROOT, "content", "config", "calculators.json"),
  articlesOut: path.join(ROOT, "articles"),
  categoryOut: path.join(ROOT, "category"),
  tagOut: path.join(ROOT, "tag"),
  archiveOut: path.join(ROOT, "archive"),
  partials: path.join(ROOT, "partials"),
  generated: path.join(ROOT, "generated"),
  templates: path.join(ROOT, "templates"),
  indexHtml: path.join(ROOT, "index.html"),
  sitemap: path.join(ROOT, "sitemap.xml"),
  robots: path.join(ROOT, "robots.txt"),
  searchJson: path.join(ROOT, "search.json"),
  rss: path.join(ROOT, "rss.xml"),
  cacheFile: path.join(ROOT, "generated", ".build-cache.json"),
  manifestFile: path.join(ROOT, "generated", ".manifest.json"),
};

// Known categories (name -> slug). New categories are added automatically
// the first time an article references them (see lib/categories.js).
export const KNOWN_CATEGORY_ICONS = {
  "mutual-funds": "📊",
  "stock-market": "📈",
  "personal-finance": "💰",
  "tax-saving": "📋",
  insurance: "🛡️",
  banking: "🏦",
  "financial-planning": "🎯",
};

export const RSS_ITEM_COUNT = 25;
export const HOMEPAGE_FEATURED_COUNT = 3;
export const HOMEPAGE_LATEST_COUNT = 4;
export const RELATED_COUNT = 3;
export const SIDEBAR_LINKS_COUNT = 5;
export const SIDEBAR_BEGINNER_MAX = 8;
export const SIDEBAR_POPULAR_DEFAULT_COUNT = 5;
