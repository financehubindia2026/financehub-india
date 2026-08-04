// scripts/lib/sitemap.js
// -----------------------------------------------------------------------------
// Step 13: regenerates sitemap.xml from the live article/category/tag/archive
// index every publish, with lastmod, priority, and changefreq set per URL type.
// -----------------------------------------------------------------------------
import fs from "fs";
import { PATHS, SITE_URL } from "./config.js";

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/about.html", priority: "0.5", changefreq: "monthly" },
  { loc: "/disclaimer.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/privacy-policy.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms-of-use.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/archive/index.html", priority: "0.4", changefreq: "weekly" },
];

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${SITE_URL}${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export function generateSitemap({ articles, categories, tags, archiveIndex }) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [];

  for (const p of STATIC_PAGES) entries.push(urlEntry({ ...p, lastmod: today }));

  for (const a of articles) {
    entries.push(
      urlEntry({ loc: a.url, lastmod: a.updated, changefreq: "monthly", priority: a.featured ? "0.9" : "0.7" })
    );
  }
  for (const c of categories) {
    entries.push(urlEntry({ loc: `/category/${c.slug}.html`, lastmod: today, changefreq: "weekly", priority: "0.8" }));
  }
  for (const t of tags) {
    entries.push(urlEntry({ loc: `/tag/${t.slug}.html`, lastmod: today, changefreq: "weekly", priority: "0.5" }));
  }
  for (const y of archiveIndex) {
    entries.push(urlEntry({ loc: `/archive/${y.year}.html`, lastmod: today, changefreq: "monthly", priority: "0.4" }));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;
  fs.writeFileSync(PATHS.sitemap, xml, "utf8");
}
