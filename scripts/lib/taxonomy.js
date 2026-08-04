// scripts/lib/taxonomy.js
// -----------------------------------------------------------------------------
// Derives the category and tag taxonomy directly from the article corpus —
// no manual category list to keep in sync (Step 7 & Step 8).
// -----------------------------------------------------------------------------
import { KNOWN_CATEGORY_ICONS } from "./config.js";
import { slugify } from "./content.js";

const FALLBACK_ICONS = ["📘", "🧭", "📚", "🧮", "💳", "🪙", "📑", "🏛️"];

export function buildCategoryIndex(articles) {
  const map = new Map();
  for (const a of articles) {
    if (!a.category) continue;
    const key = a.category.slug;
    if (!map.has(key)) {
      map.set(key, {
        name: a.category.name,
        slug: key,
        icon: KNOWN_CATEGORY_ICONS[key] || FALLBACK_ICONS[map.size % FALLBACK_ICONS.length],
        articles: [],
      });
    }
    map.get(key).articles.push(a);
  }
  for (const cat of map.values()) {
    cat.articles.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  return [...map.values()].sort((a, b) => b.articles.length - a.articles.length);
}

export function buildTagIndex(articles) {
  const map = new Map();
  for (const a of articles) {
    for (const rawTag of a.tags || []) {
      const key = slugify(rawTag);
      if (!map.has(key)) map.set(key, { name: rawTag, slug: key, articles: [] });
      map.get(key).articles.push(a);
    }
  }
  for (const tag of map.values()) {
    tag.articles.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  return [...map.values()].sort((a, b) => b.articles.length - a.articles.length);
}

export function buildArchiveIndex(articles) {
  const years = new Map();
  for (const a of articles) {
    const [y, m] = a.date.split("-");
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y);
    if (!months.has(m)) months.set(m, []);
    months.get(m).push(a);
  }
  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, arts]) => ({
          month,
          articles: arts.sort((a, b) => (a.date < b.date ? 1 : -1)),
        })),
      articles: [...months.values()].flat().sort((a, b) => (a.date < b.date ? 1 : -1)),
    }));
}
