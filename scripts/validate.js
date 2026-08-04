#!/usr/bin/env node
/**
 * scripts/validate.js — npm run validate
 * Checks every Markdown article and its SEO-relevant fields without writing
 * any output. Exits non-zero if there are errors.
 */
import { loadAllArticles } from "./lib/content.js";
import { validateArticles } from "./lib/validate.js";

const articles = loadAllArticles();
console.log(`\n▶ Validating ${articles.length} article(s)...\n`);

const { errors, warnings } = validateArticles(articles);

if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  ✖ ${e}`));
  console.log("");
  process.exit(1);
}

console.log(`✔ All articles valid\n`);
