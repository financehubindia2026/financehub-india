// scripts/lib/search.js
// -----------------------------------------------------------------------------
// Step 11: Search. Generates search.json — a flat client-side search index.
// -----------------------------------------------------------------------------
import fs from "fs";
import { PATHS } from "./config.js";

function excerpt(bodyHtml, length = 200) {
  const plain = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > length ? plain.slice(0, length).trim() + "…" : plain;
}

export function generateSearchIndex(articles) {
  const index = articles.map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    tags: a.tags,
    category: a.category.name,
    excerpt: excerpt(a.bodyHtml),
    keywords: [a.title, a.category.name, ...a.tags].join(" "),
    date: a.date,
  }));
  fs.writeFileSync(PATHS.searchJson, JSON.stringify(index, null, 2), "utf8");
}
