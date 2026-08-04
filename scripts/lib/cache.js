// scripts/lib/cache.js
// -----------------------------------------------------------------------------
// Step 18: Performance. Tracks a content hash per source Markdown file so
// `publish` only re-renders articles/<slug>.html for files that changed since
// the last build. Aggregate outputs (homepage, category/tag/archive pages,
// sitemap, RSS, search.json) are cheap to regenerate in full every run since
// they're small compared to per-article rendering.
// -----------------------------------------------------------------------------
import fs from "fs";
import crypto from "crypto";
import { PATHS } from "./config.js";

export function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(PATHS.cacheFile, "utf8"));
  } catch {
    return {};
  }
}

export function saveCache(cache) {
  fs.mkdirSync(PATHS.generated, { recursive: true });
  fs.writeFileSync(PATHS.cacheFile, JSON.stringify(cache, null, 2), "utf8");
}

export function hashOf(str) {
  return crypto.createHash("sha1").update(str).digest("hex");
}

/** Returns true if the article's source content differs from the last cached build. */
export function isChanged(cache, article, relatedHash) {
  const key = article.sourceFile;
  const currentHash = hashOf(article.bodyMarkdown + JSON.stringify(relatedHash));
  return cache[key] !== currentHash;
}

export function markBuilt(cache, article, relatedHash) {
  cache[article.sourceFile] = hashOf(article.bodyMarkdown + JSON.stringify(relatedHash));
}
