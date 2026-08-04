// scripts/lib/rss.js
// -----------------------------------------------------------------------------
// Step 12: RSS Feed. Generates rss.xml with the most recent N articles.
// -----------------------------------------------------------------------------
import fs from "fs";
import { PATHS, SITE_URL, SITE_NAME, RSS_ITEM_COUNT } from "./config.js";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(dateStr) {
  return new Date(dateStr + "T00:00:00Z").toUTCString();
}

export function generateRss(articles) {
  const items = articles.slice(0, RSS_ITEM_COUNT);
  const now = new Date().toUTCString();

  const itemsXml = items
    .map(
      (a) => `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${SITE_URL}${a.url}</link>
    <guid isPermaLink="true">${SITE_URL}${a.url}</guid>
    <description>${escapeXml(a.description)}</description>
    <category>${escapeXml(a.category.name)}</category>
    <pubDate>${rfc822(a.date)}</pubDate>
  </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${SITE_NAME}</title>
  <link>${SITE_URL}/</link>
  <description>Personal finance guides, market data, and calculators for Indian investors.</description>
  <language>en-in</language>
  <lastBuildDate>${now}</lastBuildDate>
${itemsXml}
</channel>
</rss>
`;
  fs.writeFileSync(PATHS.rss, xml, "utf8");
}
