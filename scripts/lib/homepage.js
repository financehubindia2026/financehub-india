// scripts/lib/homepage.js
// -----------------------------------------------------------------------------
// Step 6: Homepage Automation. Regenerates the Featured Guides, Latest
// Articles, and right-sidebar blocks in index.html between AUTO markers —
// no manual editing.
// -----------------------------------------------------------------------------
import fs from "fs";
import { PATHS, HOMEPAGE_FEATURED_COUNT, HOMEPAGE_LATEST_COUNT } from "./config.js";
import { renderHomeSidebarWidgets } from "./sidebar.js";

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function monthYear(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function featuredGridHtml(featured) {
  if (featured.length === 0) return `<div class="featured-grid"></div>`;
  const [main, ...side] = featured;
  const mainHtml = `      <div class="article-card">
        <div class="art-img tall"><div class="art-tag">${escapeHtml(main.category.name)}</div></div>
        <div class="art-body">
          <div class="art-meta"><span>📅 ${monthYear(main.date)}</span><span>⏱ ${main.readMinutes} min read</span></div>
          <h3><a href="articles/${main.slug}.html">${escapeHtml(main.title)}</a></h3>
          <p>${escapeHtml(main.description)}</p>
          <a href="articles/${main.slug}.html" class="read-more">Read Article →</a>
        </div>
      </div>`;
  const sideHtml =
    side.length > 0
      ? `      <div class="featured-side">
${side
  .map(
    (a) => `        <div class="article-card side">
          <div class="art-img"><div class="art-tag">${escapeHtml(a.category.name)}</div></div>
          <div class="art-body"><div class="art-meta"><span>${monthYear(a.date)}</span><span>${a.readMinutes} min</span></div><h3><a href="articles/${a.slug}.html">${escapeHtml(
      a.title
    )}</a></h3><p>${escapeHtml(a.description)}</p><a href="articles/${a.slug}.html" class="read-more">Read →</a></div>
        </div>`
  )
  .join("\n")}
      </div>`
      : "";
  return `<div class="featured-grid">\n${mainHtml}\n${sideHtml}\n    </div>`;
}

function latestListHtml(latest) {
  return `<div>
${latest
  .map(
    (a) => `      <div class="art-list-item"><div class="art-list-img">📄</div><div class="art-list-body"><span style="background:var(--surface-2);color:var(--muted);font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px">${escapeHtml(
      a.category.name
    )}</span><h3 style="margin-top:6px"><a href="articles/${a.slug}.html">${escapeHtml(a.title)}</a></h3><p>${escapeHtml(
      a.description
    )}</p><div class="art-meta"><span>${monthYear(a.date)}</span><span>${a.readMinutes} min read</span></div></div></div>`
  )
  .join("\n")}
    </div>`;
}

function replaceBetween(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(`homepage.js: could not find markers ${startMarker} / ${endMarker} in index.html`);
  }
  const before = html.slice(0, start + startMarker.length);
  const after = html.slice(end);
  return `${before}\n    ${replacement}\n    ${after}`;
}

export function updateHomepage(articles) {
  let html = fs.readFileSync(PATHS.indexHtml, "utf8");

  const featured = [...articles].filter((a) => a.featured).slice(0, HOMEPAGE_FEATURED_COUNT);
  const rest = articles.filter((a) => !featured.includes(a));
  while (featured.length < HOMEPAGE_FEATURED_COUNT && rest.length) featured.push(rest.shift());

  const latest = articles.filter((a) => !featured.includes(a)).slice(0, HOMEPAGE_LATEST_COUNT);

  html = replaceBetween(html, "<!-- AUTO:FEATURED_START -->", "<!-- AUTO:FEATURED_END -->", featuredGridHtml(featured));
  html = replaceBetween(html, "<!-- AUTO:LATEST_START -->", "<!-- AUTO:LATEST_END -->", latestListHtml(latest));

  // Right sidebar (Beginner's Corner / Popular Articles / Financial
  // Calculators / Advertisement). Popular Articles excludes whatever's
  // already shown in Featured Guides + Latest Articles above, so the
  // sidebar surfaces different content instead of repeating the same cards.
  const alreadyShown = new Set([...featured, ...latest].map((a) => a.slug));
  html = replaceBetween(
    html,
    "<!-- AUTO:HOME_SIDEBAR_START -->",
    "<!-- AUTO:HOME_SIDEBAR_END -->",
    renderHomeSidebarWidgets(articles, alreadyShown)
  );

  fs.writeFileSync(PATHS.indexHtml, html, "utf8");
}
