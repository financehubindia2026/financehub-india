#!/usr/bin/env node
/**
 * scripts/migrate.js — npm run migrate
 *
 * Converts every existing articles/<slug>.html into
 * content/articles/<slug>.md, preserving:
 *   - URL (slug is unchanged, so articles/<slug>.html continues to work
 *     once `npm run publish` regenerates it from the new Markdown source)
 *   - SEO (title, description, keywords/tags, category, dates)
 *   - JSON-LD data (author, datePublished, dateModified, articleSection)
 *   - FAQs
 *   - Body content and internal links (converted to GFM Markdown; a small
 *     set of hand-styled components — the "Did You Know" fact callout,
 *     check-list boxes, and data tables — are preserved as raw HTML blocks
 *     since Markdown syntax has no equivalent for their custom styling)
 *
 * Existing articles/<slug>.html files are left untouched by this script.
 * They are only overwritten once you run `npm run publish`, at which point
 * they're regenerated from the new Markdown source through the exact same
 * renderer used for brand-new articles — so URLs and SEO never break.
 *
 * Usage:
 *   npm run migrate            (skips slugs that already have a .md source)
 *   npm run migrate -- --force (re-converts and overwrites existing .md files)
 */
import fs from "fs";
import path from "path";
import fg from "fast-glob";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { PATHS } from "./lib/config.js";

const FORCE = process.argv.includes("--force");

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
turndown.use(gfm);

// Preserve custom hand-styled components verbatim as raw HTML blocks —
// Markdown has no native syntax for these, and the goal is pixel-identical
// output, not a lossy re-interpretation.
turndown.addRule("preserveCustomComponents", {
  filter: (node) =>
    node.nodeType === 1 &&
    ((node.tagName === "DIV" && node.classList.contains("fact-callout")) ||
      (node.tagName === "DIV" && node.classList.contains("table-wrap")) ||
      (node.tagName === "UL" && node.classList.contains("check-list")) ||
      (node.tagName === "P" && node.classList.contains("lead"))),
  replacement: (content, node) => `\n\n${node.outerHTML}\n\n`,
});

function yamlString(str) {
  if (str === undefined || str === null) return "";
  const s = String(str);
  if (/[:#\[\]{}|>*&!%@`"']/.test(s) || s.trim() !== s) {
    return JSON.stringify(s);
  }
  return s;
}

function yamlList(items, indent = "  ") {
  if (!items || items.length === 0) return "[]";
  return "\n" + items.map((i) => `${indent}- ${yamlString(i)}`).join("\n");
}

function migrateOne(htmlPath) {
  const slug = path.basename(htmlPath, ".html");
  const outPath = path.join(PATHS.contentArticles, `${slug}.md`);
  if (fs.existsSync(outPath) && !FORCE) return { slug, skipped: true };

  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const description = $('meta[name="description"]').attr("content") || "";
  const author = $('meta[name="author"]').attr("content") || "";

  // Pull structured data straight from the Article JSON-LD block, so the
  // migrated front matter matches exactly what was already indexed by
  // search engines.
  let ld = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text());
      if (parsed["@type"] === "Article") ld = parsed;
    } catch {
      /* ignore malformed block */
    }
  });

  const datePublished = ld?.datePublished || new Date().toISOString().slice(0, 10);
  const dateModified = ld?.dateModified || datePublished;
  const categoryName = ld?.articleSection || $(".article-hero-tag").first().text().trim() || "Personal Finance";
  const keywords = (ld?.keywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  // FAQs
  const faqs = [];
  $(".faq-item").each((_, el) => {
    const question = $(el).find(".faq-question span").first().text().trim();
    const answerHtml = $(el).find(".faq-answer-inner").html()?.trim() || "";
    if (question) faqs.push({ question, answer: answerHtml });
  });

  // Body: the article-prose element, minus the trailing FAQ/tag/related
  // sections which are regenerated automatically rather than migrated.
  const $prose = $("article.article-prose").first();
  $prose.find(".faq-section, .tag-row, .related-section").remove();
  const bodyHtml = $prose.html() || "";
  const bodyMarkdown = turndown.turndown(bodyHtml).trim();

  const fm = [
    "---",
    `title: ${yamlString(title)}`,
    `slug: ${slug}`,
    `description: ${yamlString(description)}`,
    `category: ${yamlString(categoryName)}`,
    `tags:${yamlList(keywords)}`,
    `author: ${yamlString(author || "Financehub India")}`,
    `date: ${datePublished}`,
    `updated: ${dateModified}`,
    `featured: false`,
    `image:`,
    `coverAlt:`,
    faqs.length
      ? `faqs:\n${faqs
          .map((f) => `  - question: ${yamlString(f.question)}\n    answer: ${yamlString(f.answer)}`)
          .join("\n")}`
      : `faqs: []`,
    "---",
    "",
  ].join("\n");

  fs.mkdirSync(PATHS.contentArticles, { recursive: true });
  fs.writeFileSync(outPath, fm + bodyMarkdown + "\n", "utf8");
  return { slug, skipped: false };
}

function main() {
  const files = fg.sync("*.html", { cwd: PATHS.articlesOut, absolute: true });
  console.log(`\n▶ Migrating ${files.length} article(s) from articles/*.html to content/articles/*.md\n`);

  let converted = 0;
  let skipped = 0;
  for (const f of files) {
    const result = migrateOne(f);
    if (result.skipped) {
      skipped++;
    } else {
      converted++;
      console.log(`  ✔ ${result.slug}.md`);
    }
  }

  console.log(`\n✔ Migration complete — ${converted} converted, ${skipped} already had a Markdown source (skipped).`);
  console.log(`  Run "npm run validate" then "npm run publish" to regenerate articles/*.html from Markdown.\n`);
}

main();
