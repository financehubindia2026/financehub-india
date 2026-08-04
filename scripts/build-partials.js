#!/usr/bin/env node
/**
 * build-partials.js
 * -------------------------------------------------------------------------
 * Injects the shared header/footer partials (partials/site-header.html,
 * partials/footer-article.html, partials/footer-category.html) into every
 * page in articles/ and category/.
 *
 * Why this exists:
 * The site is deployed as plain static HTML (no framework, no build step
 * at request time — Vercel just serves the files as-is). That's simple and
 * fast, but it means the header/nav and footer used to be copy-pasted into
 * all 88 article + category files. Editing the nav meant hand-editing 88
 * files. This script keeps a SINGLE source of truth for each partial and
 * "compiles" it into every page, so the deployed output is still 100%
 * plain static HTML — nothing changes about how the site is hosted.
 *
 * Usage:
 *   node scripts/build-partials.js         # apply partials to all pages
 *   node scripts/build-partials.js --check # dry-run: report pages that
 *                                           # would change, don't write
 *
 * How to edit the site-wide header or footer:
 *   1. Edit the relevant file in partials/
 *   2. Run: npm run build:partials
 *   3. Commit the changed article/category files along with the partial.
 *
 * This script is idempotent — safe to run repeatedly. It finds the existing
 * <header class="site-header" ...>...</header> block and the existing
 * <footer class="site-footer">...</footer> block in each target file (by
 * tag, not by exact content) and replaces them wholesale.
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const PARTIALS_DIR = path.join(ROOT, "partials");

const HEADER_RE = /<header class="site-header"[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="site-footer">[\s\S]*?<\/footer>/;

const isCheckMode = process.argv.includes("--check");

function loadPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf8").trim();
}

const HEADER_PARTIAL = loadPartial("site-header.html");
const FOOTER_ARTICLE_PARTIAL = loadPartial("footer-article.html");
const FOOTER_CATEGORY_PARTIAL = loadPartial("footer-category.html");

function listHtmlFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(dir, f));
}

function applyPartials(filePath, footerPartial) {
  const original = fs.readFileSync(filePath, "utf8");
  let updated = original;

  if (!HEADER_RE.test(updated)) {
    console.warn(`  ⚠️  No <header class="site-header"> found in ${filePath} — skipped header.`);
  } else {
    updated = updated.replace(HEADER_RE, HEADER_PARTIAL);
  }

  if (!FOOTER_RE.test(updated)) {
    console.warn(`  ⚠️  No <footer class="site-footer"> found in ${filePath} — skipped footer.`);
  } else {
    updated = updated.replace(FOOTER_RE, footerPartial);
  }

  const changed = updated !== original;
  if (changed && !isCheckMode) {
    fs.writeFileSync(filePath, updated, "utf8");
  }
  return changed;
}

function run() {
  const targets = [
    { dir: path.join(ROOT, "articles"), footer: FOOTER_ARTICLE_PARTIAL, label: "articles" },
    { dir: path.join(ROOT, "category"), footer: FOOTER_CATEGORY_PARTIAL, label: "category" },
  ];

  let totalChanged = 0;
  let totalFiles = 0;

  for (const { dir, footer, label } of targets) {
    const files = listHtmlFiles(dir);
    console.log(`\n${label}/ — ${files.length} files`);
    for (const file of files) {
      totalFiles += 1;
      const changed = applyPartials(file, footer);
      if (changed) {
        totalChanged += 1;
        console.log(`  ${isCheckMode ? "would update" : "updated"}: ${path.relative(ROOT, file)}`);
      }
    }
  }

  console.log(
    `\n${isCheckMode ? "[check mode] " : ""}${totalChanged}/${totalFiles} files ${
      isCheckMode ? "would be" : "were"
    } updated.\n`
  );
}

run();
