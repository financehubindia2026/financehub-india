// scripts/lib/validate.js
// -----------------------------------------------------------------------------
// Validates parsed articles before any HTML is generated (Step 2).
// Returns { errors: [], warnings: [] }. The publish script aborts the build
// if `errors` is non-empty.
// -----------------------------------------------------------------------------
import fs from "fs";
import path from "path";
import { ROOT } from "./config.js";

export function validateArticles(articles) {
  const errors = [];
  const warnings = [];

  const seenSlugs = new Map();
  const seenTitles = new Map();

  for (const a of articles) {
    const where = a.sourceFile;

    if (!a.title) errors.push(`${where}: missing "title"`);
    if (!a.description) errors.push(`${where}: missing "description"`);
    if (!a.slug) errors.push(`${where}: missing "slug"`);
    if (!a.category || !a.category.name) errors.push(`${where}: missing "category"`);

    if (a.slug) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) {
        errors.push(`${where}: invalid slug "${a.slug}" — use lowercase letters, numbers, hyphens only`);
      }
      if (seenSlugs.has(a.slug)) {
        errors.push(`${where}: duplicate slug "${a.slug}" (also used by ${seenSlugs.get(a.slug)})`);
      } else {
        seenSlugs.set(a.slug, where);
      }
    }

    if (a.title) {
      const key = a.title.trim().toLowerCase();
      if (seenTitles.has(key)) {
        warnings.push(`${where}: duplicate title "${a.title}" (also used by ${seenTitles.get(key)})`);
      } else {
        seenTitles.set(key, where);
      }
    }

    if (!a.date || isNaN(Date.parse(a.date))) {
      errors.push(`${where}: missing or invalid "date"`);
    }
    if (a.updated && isNaN(Date.parse(a.updated))) {
      errors.push(`${where}: invalid "updated" date`);
    }

    // Broken image reference (cover image)
    if (a.image) {
      const resolved = resolveSitePath(a.image);
      if (resolved && !fs.existsSync(resolved)) {
        errors.push(`${where}: broken image reference "${a.image}"`);
      }
    }

    // Broken internal links / images referenced inside the rendered body
    const linkRe = /<a [^>]*href="([^"]+)"/g;
    const imgRe = /<img [^>]*src="([^"]+)"/g;
    let m;
    while ((m = linkRe.exec(a.bodyHtml)) !== null) {
      const href = m[1];
      if (href.startsWith("/") && !href.startsWith("//")) {
        const resolved = resolveSitePath(href);
        if (resolved && !fs.existsSync(resolved)) {
          warnings.push(`${where}: possibly broken internal link "${href}"`);
        }
      }
    }
    while ((m = imgRe.exec(a.bodyHtml)) !== null) {
      const src = m[1];
      if (src.startsWith("/") && !src.startsWith("//")) {
        const resolved = resolveSitePath(src);
        if (resolved && !fs.existsSync(resolved)) {
          errors.push(`${where}: broken image "${src}"`);
        }
      }
    }
  }

  return { errors, warnings };
}

function resolveSitePath(sitePath) {
  if (!sitePath || sitePath.startsWith("http")) return null;
  const clean = sitePath.split("#")[0].split("?")[0];
  return path.join(ROOT, clean);
}
