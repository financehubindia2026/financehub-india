#!/usr/bin/env node
/**
 * scripts/new-article.js — npm run new:article
 *
 * Usage:
 *   npm run new:article -- "Cryptocurrency Basics for Beginners"
 *   npm run new:article -- "Cryptocurrency Basics for Beginners" --category="Cryptocurrency"
 *
 * Creates content/articles/<slug>.md pre-filled with YAML front matter.
 * Write the article body below the front matter, then run:
 *   npm run publish
 *
 * (The previous JSON-based generator is preserved at scripts/legacy/new-article-json.js
 * for reference, but Markdown is now the single source of truth for new content.)
 */
import fs from "fs";
import path from "path";
import { PATHS } from "./lib/config.js";
import { slugify } from "./lib/content.js";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of args) {
  const m = a.match(/^--([\w-]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
  else positional.push(a);
}

const title = positional.join(" ").trim();
if (!title) {
  fail(`Usage: npm run new:article -- "Article Title" [--category="Category Name"] [--slug=custom-slug]`);
}

const slug = flags.slug || slugify(title);
const category = flags.category || "Personal Finance";
const outPath = path.join(PATHS.contentArticles, `${slug}.md`);

if (fs.existsSync(outPath)) {
  fail(`content/articles/${slug}.md already exists.`);
}

const today = new Date().toISOString().slice(0, 10);

const template = `---
title: ${title}
slug: ${slug}
description: 
category: ${category}
tags:
  - 
author: Financehub India
date: ${today}
updated:
featured: false
image:
coverAlt:
faqs:
  - question: 
    answer: 
---

<p class="lead">Write your opening paragraph here.</p>

## First Heading

Write your content here. Supports **bold**, _italics_, lists, tables, images, and more.

::: tip
Use admonitions like this for callouts — types available: note, tip, warning, danger.
:::

### A Sub-heading

More content here.
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, template, "utf8");

console.log(`\n✔ Created content/articles/${slug}.md`);
console.log(`  1. Fill in the description, tags, and body content.`);
console.log(`  2. Run: npm run publish`);
console.log(`  3. git add . && git commit -m "Publish article" && git push\n`);
