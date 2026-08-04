// scripts/lib/render-listing.js
// -----------------------------------------------------------------------------
// Renders category pages (/category/<slug>.html), tag pages (/tag/<slug>.html)
// and archive pages (/archive/<year>.html, /archive/<year>-<month>.html),
// reusing the same header/footer partials and "pillar" CSS classes as the
// original hand-written category pages.
// -----------------------------------------------------------------------------
import fs from "fs";
import path from "path";
import { PATHS, SITE_URL, SITE_NAME } from "./config.js";

function loadPartial(name) {
  return fs.readFileSync(path.join(PATHS.partials, name), "utf8").trim();
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function jsonLd(obj) {
  return JSON.stringify(obj, null, 2);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shell({ title, description, canonicalUrl, breadcrumbItems, bodyHtml, otherCategoriesHtml }) {
  const HEADER_PARTIAL = loadPartial("site-header.html");
  const FOOTER_PARTIAL = loadPartial("footer-category.html");

  const collectionLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
  });
  const breadcrumbLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      ...(b.item ? { item: b.item } : {}),
    })),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f7de5" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="author" content="${SITE_NAME}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:image" content="${SITE_URL}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <script type="application/ld+json">
${collectionLd}
  </script>
  <script type="application/ld+json">
${breadcrumbLd}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Sora:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../css/style.css" />
</head>
<body>
<a class="skip-link" href="#main-content">Skip to main content</a>
${HEADER_PARTIAL}

<div id="main-content"></div>
${bodyHtml}

${otherCategoriesHtml || ""}
${FOOTER_PARTIAL}

<button id="back-top" aria-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>

<script type="module" src="../js/app.js"></script>
</body>
</html>
`;
}

function articleCardsHtml(articles) {
  return articles
    .map(
      (a) => `<div class="pillar-card">
        <h3><a href="../articles/${a.slug}.html">${escapeHtml(a.title)}</a></h3>
        <p>${escapeHtml(a.description)}</p>
        <a href="../articles/${a.slug}.html" class="read-more">Read Guide →</a>
      </div>`
    )
    .join("\n");
}

function otherCategoriesSection(allCategories, currentSlug) {
  const others = allCategories.filter((c) => c.slug !== currentSlug);
  if (others.length === 0) return "";
  return `<div class="pillar-other-cats">
  <h2>Explore Other Categories</h2>
  <div class="categories-grid">
${others
  .map(
    (c) =>
      `    <a href="../category/${c.slug}.html" class="cat-card"><div class="cat-icon">${c.icon}</div><span>${escapeHtml(
        c.name
      )}</span><em>${c.articles.length} article${c.articles.length === 1 ? "" : "s"}</em></a>`
  )
  .join("\n")}
  </div>
</div>`;
}

export function renderCategoryPage(category, allCategories) {
  const canonicalUrl = `${SITE_URL}/category/${category.slug}.html`;
  const title = `${category.name}: Complete Guide for Indian Investors (2026)`;
  const description = `Complete ${category.name} guide for Indian investors: ${category.articles.length} in-depth article${
    category.articles.length === 1 ? "" : "s"
  } covering everything from the basics to advanced strategy. Updated for 2026.`;

  const bodyHtml = `<section class="pillar-hero">
  <div class="container">
    <div class="breadcrumbs" style="justify-content:center;">
      <a href="../index.html">Home</a><span class="sep">/</span>
      <span class="current">${escapeHtml(category.name)}</span>
    </div>
    <div class="pillar-hero-icon">${category.icon}</div>
    <h1>${escapeHtml(category.name)}: Complete Guide</h1>
    <p>${escapeHtml(description)}</p>
    <div class="pillar-hero-stats">
      <div><strong>${category.articles.length}</strong>Guides</div>
      <div><strong>2026</strong>Updated</div>
      <div><strong>Free</strong>Always</div>
    </div>
  </div>
</section>

<div class="pillar-articles">
  <div class="pillar-group">
    <div class="pillar-grid">
${articleCardsHtml(category.articles)}
    </div>
  </div>
</div>`;

  return shell({
    title,
    description,
    canonicalUrl,
    breadcrumbItems: [
      { name: "Home", item: `${SITE_URL}/` },
      { name: category.name },
    ],
    bodyHtml,
    otherCategoriesHtml: otherCategoriesSection(allCategories, category.slug),
  });
}

export function renderTagPage(tag, allCategories) {
  const canonicalUrl = `${SITE_URL}/tag/${tag.slug}.html`;
  const title = `${tag.name}: Articles Tagged "${tag.name}" | ${SITE_NAME}`;
  const description = `${tag.articles.length} article${tag.articles.length === 1 ? "" : "s"} tagged "${tag.name}" on ${SITE_NAME}.`;

  const bodyHtml = `<section class="pillar-hero">
  <div class="container">
    <div class="breadcrumbs" style="justify-content:center;">
      <a href="../index.html">Home</a><span class="sep">/</span>
      <span class="current">#${escapeHtml(tag.name)}</span>
    </div>
    <div class="pillar-hero-icon">🏷️</div>
    <h1>#${escapeHtml(tag.name)}</h1>
    <p>${escapeHtml(description)}</p>
  </div>
</section>

<div class="pillar-articles">
  <div class="pillar-group">
    <div class="pillar-grid">
${articleCardsHtml(tag.articles)}
    </div>
  </div>
</div>`;

  return shell({
    title,
    description,
    canonicalUrl,
    breadcrumbItems: [
      { name: "Home", item: `${SITE_URL}/` },
      { name: `#${tag.name}` },
    ],
    bodyHtml,
    otherCategoriesHtml: otherCategoriesSection(allCategories, null),
  });
}

export function renderArchiveYearPage(yearEntry, allCategories) {
  const canonicalUrl = `${SITE_URL}/archive/${yearEntry.year}.html`;
  const title = `${yearEntry.year} Archive | ${SITE_NAME}`;
  const description = `All ${yearEntry.articles.length} article${yearEntry.articles.length === 1 ? "" : "s"} published in ${yearEntry.year} on ${SITE_NAME}.`;

  const monthSections = yearEntry.months
    .map(
      (m) => `  <div class="pillar-group">
    <h2 class="pillar-group-title">${MONTH_NAMES[Number(m.month) - 1]} ${yearEntry.year}</h2>
    <div class="pillar-grid">
${articleCardsHtml(m.articles)}
    </div>
  </div>`
    )
    .join("\n");

  const bodyHtml = `<section class="pillar-hero">
  <div class="container">
    <div class="breadcrumbs" style="justify-content:center;">
      <a href="../index.html">Home</a><span class="sep">/</span>
      <a href="../archive/index.html">Archive</a><span class="sep">/</span>
      <span class="current">${yearEntry.year}</span>
    </div>
    <div class="pillar-hero-icon">🗓️</div>
    <h1>${yearEntry.year} Archive</h1>
    <p>${escapeHtml(description)}</p>
  </div>
</section>

<div class="pillar-articles">
${monthSections}
</div>`;

  return shell({
    title,
    description,
    canonicalUrl,
    breadcrumbItems: [
      { name: "Home", item: `${SITE_URL}/` },
      { name: "Archive", item: `${SITE_URL}/archive/index.html` },
      { name: yearEntry.year },
    ],
    bodyHtml,
    otherCategoriesHtml: otherCategoriesSection(allCategories, null),
  });
}

export function renderArchiveIndexPage(archiveIndex, allArticles, allCategories) {
  const canonicalUrl = `${SITE_URL}/archive/index.html`;
  const title = `Article Archive | ${SITE_NAME}`;
  const description = `Browse every ${SITE_NAME} article by year and month — ${allArticles.length} guides in total.`;

  const newest = [...allArticles].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
  const popular = [...allArticles].slice(0, 8); // no analytics source yet; falls back to newest ordering

  const yearLinks = archiveIndex
    .map(
      (y) => `      <a href="../archive/${y.year}.html" class="cat-card"><div class="cat-icon">🗓️</div><span>${y.year}</span><em>${y.articles.length} article${
        y.articles.length === 1 ? "" : "s"
      }</em></a>`
    )
    .join("\n");

  const bodyHtml = `<section class="pillar-hero">
  <div class="container">
    <div class="breadcrumbs" style="justify-content:center;">
      <a href="../index.html">Home</a><span class="sep">/</span>
      <span class="current">Archive</span>
    </div>
    <div class="pillar-hero-icon">🗓️</div>
    <h1>Article Archive</h1>
    <p>${escapeHtml(description)}</p>
  </div>
</section>

<div class="pillar-articles">
  <div class="pillar-group">
    <h2 class="pillar-group-title">By Year</h2>
    <div class="categories-grid">
${yearLinks}
    </div>
  </div>
  <div class="pillar-group">
    <h2 class="pillar-group-title">Newest Articles</h2>
    <div class="pillar-grid">
${articleCardsHtml(newest)}
    </div>
  </div>
  <div class="pillar-group">
    <h2 class="pillar-group-title">Popular Articles</h2>
    <div class="pillar-grid">
${articleCardsHtml(popular)}
    </div>
  </div>
</div>`;

  return shell({
    title,
    description,
    canonicalUrl,
    breadcrumbItems: [
      { name: "Home", item: `${SITE_URL}/` },
      { name: "Archive" },
    ],
    bodyHtml,
    otherCategoriesHtml: otherCategoriesSection(allCategories, null),
  });
}
