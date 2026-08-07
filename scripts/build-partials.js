#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const PARTIALS_DIR = path.join(ROOT, "partials");

const isCheckMode = process.argv.includes("--check");

const HEADER_RE = /<header class="site-header"[\s\S]*?<\/header>/i;
const FOOTER_RE = /<footer class="site-footer"[\s\S]*?<\/footer>/i;
const HEAD_CLOSE_RE = /<\/head>/i;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "partials",
  ".vercel",
  ".github"
]);

function loadPartial(name) {
  return fs.readFileSync(path.join(PARTIALS_DIR, name), "utf8").trim();
}

const HEAD_PARTIAL = loadPartial("head.html");
const HEADER_PARTIAL = loadPartial("site-header.html");
const FOOTER_ARTICLE = loadPartial("footer-article.html");
const FOOTER_CATEGORY = loadPartial("footer-category.html");

function walk(dir) {
  let files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...walk(path.join(dir, entry.name)));
      }
      continue;
    }

    if (entry.name.endsWith(".html")) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

function footerFor(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");

  if (rel.startsWith("category/")) return FOOTER_CATEGORY;

  return FOOTER_ARTICLE;
}

function apply(file) {
  const original = fs.readFileSync(file, "utf8");

  let html = original;

  // Inject / update head partial
if (HEAD_CLOSE_RE.test(html)) {
  const hasAdSense = html.includes("pagead2.googlesyndication.com");
  const hasGA4 = html.includes("G-H6F7NMRFB6");

  // Existing pages already contain the old GA4 head partial.
  // Replace the existing Google Analytics section with the
  // current head partial so AdSense is added without duplicating GA4.
  if (hasGA4 && !hasAdSense) {
    const GA4_SECTION_RE =
      /<!-- Google Analytics 4 -->[\s\S]*?<\/script>\s*<\/head>/i;

    if (GA4_SECTION_RE.test(html)) {
      html = html.replace(
        GA4_SECTION_RE,
        `${HEAD_PARTIAL}\n</head>`
      );
    } else {
      html = html.replace(
        HEAD_CLOSE_RE,
        `${HEAD_PARTIAL}\n</head>`
      );
    }
  }

  // For pages that don't have the head partial yet.
  else if (!hasGA4 && !hasAdSense) {
    html = html.replace(
      HEAD_CLOSE_RE,
      `${HEAD_PARTIAL}\n</head>`
    );
  }
}

  // Replace header
  if (HEADER_RE.test(html)) {
    html = html.replace(HEADER_RE, HEADER_PARTIAL);
  }

  // Replace footer
  if (FOOTER_RE.test(html)) {
    html = html.replace(
      FOOTER_RE,
      footerFor(file)
    );
  }

  if (html !== original) {
    if (!isCheckMode) {
      fs.writeFileSync(file, html, "utf8");
    }
    return true;
  }

  return false;
}

const htmlFiles = walk(ROOT);

let updated = 0;

for (const file of htmlFiles) {
  if (apply(file)) {
    updated++;
    console.log(
      `${isCheckMode ? "Would update" : "Updated"} ${path.relative(ROOT, file)}`
    );
  }
}

console.log("");
console.log(`${updated}/${htmlFiles.length} HTML files updated.`);
