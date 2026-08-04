// scripts/lib/related.js
// -----------------------------------------------------------------------------
// Step 10: automatically detects related content using category, tags, and
// recency — no manual "relatedArticles" list needed in front matter.
// -----------------------------------------------------------------------------
import { RELATED_COUNT, SIDEBAR_LINKS_COUNT } from "./config.js";

function score(a, b) {
  if (a.slug === b.slug) return -1;
  let s = 0;
  if (a.category?.slug && a.category.slug === b.category?.slug) s += 5;
  const aTags = new Set(a.tags || []);
  for (const t of b.tags || []) if (aTags.has(t)) s += 2;
  return s;
}

/** Returns the top-N related articles for `article`, out of `all`. */
export function computeRelated(article, all, count = RELATED_COUNT) {
  return all
    .map((other) => ({ other, s: score(article, other) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => y.s - x.s || (x.other.date < y.other.date ? 1 : -1))
    .slice(0, count)
    .map((x) => x.other);
}

/** Sidebar "More in <Category>" links: most recent other articles in the same category. */
export function computeSidebarLinks(article, all, count = SIDEBAR_LINKS_COUNT) {
  return all
    .filter((a) => a.slug !== article.slug && a.category?.slug === article.category?.slug)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, count);
}

/** Previous/next article by publish date, within the whole corpus. */
export function computePrevNext(article, allSortedDesc) {
  const idx = allSortedDesc.findIndex((a) => a.slug === article.slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx < allSortedDesc.length - 1 ? allSortedDesc[idx + 1] : null, // older
    next: idx > 0 ? allSortedDesc[idx - 1] : null, // newer
  };
}
