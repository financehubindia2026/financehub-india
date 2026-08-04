#!/usr/bin/env node
/**
 * scripts/publish.js
 * -----------------------------------------------------------------------------
 * The one command that builds the entire site from content/articles/*.md.
 *
 *   npm run publish
 *
 * Steps (see README / CMS spec):
 *   1. Read every Markdown article
 *   2. Validate (stop on errors)
 *   3. Generate article HTML (reusing existing templates/partials)
 *   4. SEO (meta, canonical, OG, Twitter, JSON-LD) — done inside step 3
 *   5. Article features (TOC, reading time, related, prev/next, share, ...) — step 3
 *   6. Homepage automation (featured + latest)
 *   7. Category automation (auto-create/update category pages)
 *   8. Tag pages
 *   9. Archive pages
 *  10. Related articles — computed inside step 3
 *  11. search.json
 *  12. rss.xml
 *  13. sitemap.xml
 *  14. robots.txt sitemap check
 *  15. Image processing (lazy-loading — done at markdown-render time; existence validation in step 2)
 *  18. Incremental builds — skips unchanged articles' HTML write
 * -----------------------------------------------------------------------------
 */
import fs from "fs";
import path from "path";
import { PATHS, SITE_URL, ROOT } from "./lib/config.js";
import { loadAllArticles } from "./lib/content.js";
import { validateArticles } from "./lib/validate.js";
import { renderArticleHtml } from "./lib/render-article.js";
import { buildCategoryIndex, buildTagIndex, buildArchiveIndex } from "./lib/taxonomy.js";
import {
  renderCategoryPage,
  renderTagPage,
  renderArchiveYearPage,
  renderArchiveIndexPage,
} from "./lib/render-listing.js";
import { updateHomepage } from "./lib/homepage.js";
import { generateSitemap } from "./lib/sitemap.js";
import { generateRss } from "./lib/rss.js";
import { generateSearchIndex } from "./lib/search.js";
import { loadCache, saveCache, isChanged, markBuilt } from "./lib/cache.js";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");

function log(msg) {
  console.log(msg);
}

function writeFile(filePath, content, manifest) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  manifest.push(path.relative(ROOT, filePath));
}

function ensureSitemapInRobots() {
  const line = `Sitemap: ${SITE_URL}/sitemap.xml`;
  let robots = "";
  try {
    robots = fs.readFileSync(PATHS.robots, "utf8");
  } catch {
    robots = "";
  }
  if (!robots.includes("Sitemap:")) {
    robots = robots.trimEnd() + `\n\n${line}\n`;
    fs.writeFileSync(PATHS.robots, robots, "utf8");
    log("  robots.txt: added missing Sitemap directive");
  } else if (!robots.includes(line)) {
    log(`  ⚠️  robots.txt has a Sitemap directive that doesn't match ${line} — left untouched, please verify manually.`);
  }
}

async function main() {
  const t0 = Date.now();
  log("\n▶ FinanceHub India — publish\n");

  // -------------------------------------------------------------------------
  // Step 1: Read every Markdown article
  // -------------------------------------------------------------------------
  const articles = loadAllArticles();
  log(`  Step 1  Read ${articles.length} article(s) from content/articles/`);

  // -------------------------------------------------------------------------
  // Step 2: Validate
  // -------------------------------------------------------------------------
  const { errors, warnings } = validateArticles(articles);
  if (warnings.length) {
    log(`  Step 2  ${warnings.length} warning(s):`);
    warnings.forEach((w) => log(`            ⚠️  ${w}`));
  }
  if (errors.length) {
    log(`  Step 2  ✖ ${errors.length} error(s) — build stopped:`);
    errors.forEach((e) => log(`            ✖ ${e}`));
    process.exit(1);
  }
  log(`  Step 2  Validation passed`);

  const manifest = [];
  const cache = FORCE ? {} : loadCache();
  let rebuilt = 0;
  let skipped = 0;

  // -------------------------------------------------------------------------
  // Steps 3–5, 10: Generate article HTML (SEO + features + related, built in)
  // -------------------------------------------------------------------------
  for (const article of articles) {
    const outPath = path.join(PATHS.articlesOut, `${article.slug}.html`);
    const relatedSignature = articles.map((a) => a.slug + a.category?.slug).join(",");
    if (!FORCE && !isChanged(cache, article, relatedSignature) && fs.existsSync(outPath)) {
      skipped++;
      manifest.push(path.relative(ROOT, outPath));
      continue;
    }
    const html = renderArticleHtml(article, articles);
    writeFile(outPath, html, manifest);
    markBuilt(cache, article, relatedSignature);
    rebuilt++;
  }
  log(`  Step 3-5,10  Generated article HTML — ${rebuilt} rebuilt, ${skipped} unchanged (skipped)`);

  // -------------------------------------------------------------------------
  // Step 6: Homepage automation
  // -------------------------------------------------------------------------
  updateHomepage(articles);
  manifest.push("index.html (updated in place)");
  log(`  Step 6  Homepage featured/latest sections updated`);

  // -------------------------------------------------------------------------
  // Step 7: Category automation
  // -------------------------------------------------------------------------
  const categories = buildCategoryIndex(articles);
  for (const cat of categories) {
    const outPath = path.join(PATHS.categoryOut, `${cat.slug}.html`);
    const isNew = !fs.existsSync(outPath);
    writeFile(outPath, renderCategoryPage(cat, categories), manifest);
    if (isNew) log(`            + created category/${cat.slug}.html (new category: ${cat.name})`);
  }
  log(`  Step 7  ${categories.length} category page(s) up to date`);

  // -------------------------------------------------------------------------
  // Step 8: Tag pages
  // -------------------------------------------------------------------------
  const tags = buildTagIndex(articles);
  for (const tag of tags) {
    const outPath = path.join(PATHS.tagOut, `${tag.slug}.html`);
    writeFile(outPath, renderTagPage(tag, categories), manifest);
  }
  log(`  Step 8  ${tags.length} tag page(s) up to date`);

  // -------------------------------------------------------------------------
  // Step 9: Archive pages
  // -------------------------------------------------------------------------
  const archiveIndex = buildArchiveIndex(articles);
  for (const year of archiveIndex) {
    const outPath = path.join(PATHS.archiveOut, `${year.year}.html`);
    writeFile(outPath, renderArchiveYearPage(year, categories), manifest);
  }
  writeFile(
    path.join(PATHS.archiveOut, "index.html"),
    renderArchiveIndexPage(archiveIndex, articles, categories),
    manifest
  );
  log(`  Step 9  ${archiveIndex.length} year archive page(s) + index up to date`);

  // -------------------------------------------------------------------------
  // Step 11: Search
  // -------------------------------------------------------------------------
  generateSearchIndex(articles);
  manifest.push(path.relative(ROOT, PATHS.searchJson));
  log(`  Step 11  search.json regenerated (${articles.length} entries)`);

  // -------------------------------------------------------------------------
  // Step 12: RSS
  // -------------------------------------------------------------------------
  generateRss(articles);
  manifest.push(path.relative(ROOT, PATHS.rss));
  log(`  Step 12  rss.xml regenerated`);

  // -------------------------------------------------------------------------
  // Step 13: Sitemap
  // -------------------------------------------------------------------------
  generateSitemap({ articles, categories, tags, archiveIndex });
  manifest.push(path.relative(ROOT, PATHS.sitemap));
  log(`  Step 13  sitemap.xml regenerated (${articles.length + categories.length + tags.length + archiveIndex.length + 6} URLs)`);

  // -------------------------------------------------------------------------
  // Step 14: robots.txt
  // -------------------------------------------------------------------------
  ensureSitemapInRobots();
  log(`  Step 14  robots.txt sitemap directive verified`);

  // -------------------------------------------------------------------------
  // Save manifest (for `npm run clean`) and incremental-build cache
  // -------------------------------------------------------------------------
  fs.mkdirSync(PATHS.generated, { recursive: true });
  fs.writeFileSync(PATHS.manifestFile, JSON.stringify([...new Set(manifest)], null, 2), "utf8");
  saveCache(cache);

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  log(`\n✔ Publish complete in ${secs}s\n`);
  log(`  Next steps:\n    git add .\n    git commit -m "Publish article"\n    git push\n`);
}

main().catch((err) => {
  console.error(`\n✖ Publish failed: ${err.message}\n`);
  console.error(err.stack);
  process.exit(1);
});
