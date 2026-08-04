// scripts/lib/content.js
// -----------------------------------------------------------------------------
// Reads every Markdown file in content/articles, parses YAML front matter,
// renders the body to HTML, and returns a normalized "article" object used by
// every downstream generator (HTML, SEO, sitemap, RSS, search.json, ...).
// -----------------------------------------------------------------------------
import fs from "fs";
import path from "path";
import fg from "fast-glob";
import matter from "gray-matter";
import { renderMarkdown } from "./markdown.js";
import { PATHS, DEFAULT_AUTHOR, ROOT } from "./config.js";

export function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toIsoDate(value, fallback) {
  if (!value) return fallback;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Extracts h2/h3 with their generated ids for the table of contents. */
function extractToc(html) {
  const headingRe = /<h([23]) id="([^"]+)"[^>]*>(.*?)<\/h[23]>/gs;
  const entries = [];
  let m;
  while ((m = headingRe.exec(html)) !== null) {
    const [, level, id, rawLabel] = m;
    entries.push({ level: Number(level), id, label: rawLabel.replace(/<[^>]+>/g, "").trim() });
  }
  return entries;
}

function computeReadingStats(html) {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plain ? plain.split(" ").length : 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  return { wordCount, readMinutes };
}

/**
 * Loads and parses a single Markdown article file.
 */
export function loadArticleFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data: fm, content } = matter(raw);
  const relSource = path.relative(ROOT, filePath);

  const today = new Date().toISOString().slice(0, 10);
  const slug = fm.slug || slugify(path.basename(filePath, path.extname(filePath)));
  const date = toIsoDate(fm.date, today);
  const updated = fm.updated ? toIsoDate(fm.updated) : date;
  const categoryName = typeof fm.category === "string" ? fm.category : fm.category?.name;
  const categorySlug = fm.categorySlug || (categoryName ? slugify(categoryName) : undefined);

  const bodyHtml = renderMarkdown(content);
  const { wordCount, readMinutes } = computeReadingStats(bodyHtml);
  const toc = extractToc(bodyHtml);

  return {
    sourceFile: relSource,
    slug,
    title: fm.title,
    description: fm.description,
    category: categoryName ? { name: categoryName, slug: categorySlug } : null,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    author: fm.author || DEFAULT_AUTHOR,
    date,
    updated,
    featured: Boolean(fm.featured),
    image: fm.image || null,
    coverAlt: fm.coverAlt || fm.title || "",
    faqs: Array.isArray(fm.faqs) ? fm.faqs : [],
    draft: Boolean(fm.draft),
    bodyMarkdown: content,
    bodyHtml,
    wordCount,
    readMinutes,
    toc,
    url: `/articles/${slug}.html`,
  };
}

/** Loads all published articles (content/articles/*.md), skipping drafts. */
export function loadAllArticles() {
  const files = fg.sync("*.md", { cwd: PATHS.contentArticles, absolute: true });
  const articles = files.map(loadArticleFile).filter((a) => !a.draft);
  articles.sort((a, b) => (a.date < b.date ? 1 : -1));
  return articles;
}

export function articleMtimeSignature(filePath) {
  const stat = fs.statSync(filePath);
  return `${stat.size}:${stat.mtimeMs}`;
}
