#!/usr/bin/env node
/**
 * new-article.js
 * -------------------------------------------------------------------------
 * Generates a full articles/<slug>.html page from a small JSON content file,
 * instead of hand-writing ~500 lines of HTML (meta tags, 3 JSON-LD blocks,
 * breadcrumbs, table of contents, FAQ markup, footer, etc.) per article.
 *
 * Usage:
 *   npm run new:article -- content/articles/your-slug.json
 *   npm run new:article -- content/articles/your-slug.json --force   (overwrite)
 *
 * What it does for you automatically (so it can't drift out of sync):
 *   - Meta tags, canonical URL, Open Graph tags
 *   - JSON-LD: Article, FAQPage, BreadcrumbList (built from the same data
 *     that renders on the page, so structured data always matches content)
 *   - Table of contents — parsed directly from the <h2>/<h3> ids in your
 *     bodyHtml, so it can never go stale or point at a missing anchor
 *   - Word count and estimated read time
 *   - Injects the shared site-header / article footer partials (see
 *     partials/README or the main README's "Editing the site-wide header
 *     or footer" section) — same single source of truth as every other page
 *
 * What you still write by hand, in the JSON content file:
 *   - title, description, category, dates, keywords
 *   - bodyHtml — the actual article prose/headings/tables (same HTML you'd
 *     write inside <article class="article-prose">...</article> today)
 *   - faqs, relatedArticles, sidebarLinks
 *
 * See content/articles/_example.json for a filled-in template.
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://financehub-india.vercel.app";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function loadPartial(name) {
  return fs.readFileSync(path.join(ROOT, "partials", name), "utf8").trim();
}

// ---------------------------------------------------------------------------
// 1. Load & validate input
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const force = args.includes("--force");
const jsonPath = args.find((a) => !a.startsWith("--"));

if (!jsonPath) {
  fail("Usage: npm run new:article -- content/articles/your-slug.json [--force]");
}
if (!fs.existsSync(jsonPath)) {
  fail(`File not found: ${jsonPath}`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} catch (e) {
  fail(`Invalid JSON in ${jsonPath}: ${e.message}`);
}

const REQUIRED_FIELDS = ["slug", "title", "metaDescription", "category", "bodyHtml"];
for (const field of REQUIRED_FIELDS) {
  if (!data[field]) fail(`Missing required field "${field}" in ${jsonPath}`);
}
if (!data.category.name || !data.category.slug) {
  fail(`"category" must have both "name" and "slug", e.g. {"name":"Stock Market","slug":"stock-market"}`);
}

const outPath = path.join(ROOT, "articles", `${data.slug}.html`);
if (fs.existsSync(outPath) && !force) {
  fail(`articles/${data.slug}.html already exists. Re-run with --force to overwrite it.`);
}

const categoryPagePath = path.join(ROOT, "category", `${data.category.slug}.html`);
if (!fs.existsSync(categoryPagePath)) {
  console.warn(
    `  ⚠️  Warning: category/${data.category.slug}.html doesn't exist yet — the breadcrumb and sidebar links will point at a missing page until you create it.`
  );
}

// ---------------------------------------------------------------------------
// 2. Derive computed fields
// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const datePublished = data.datePublished || today;
const dateModified = data.dateModified || datePublished;
const author = data.author || "Financehub India";
const canonicalUrl = `${SITE_URL}/articles/${data.slug}.html`;
const keywords = data.keywords || [];
const faqs = data.faqs || [];
const relatedArticles = data.relatedArticles || [];
const sidebarLinks = data.sidebarLinks || [];

const plainTextBody = data.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const wordCount = plainTextBody.length ? plainTextBody.split(" ").length : 0;
const readMinutes = Math.max(1, Math.round(wordCount / 200));

const updatedLabel = new Date(dateModified + "T00:00:00").toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
});

// Table of contents: parsed straight from the headings actually in bodyHtml,
// so it's structurally impossible for the TOC to point at a missing anchor.
const headingRe = /<h[23] id="([^"]+)">(.*?)<\/h[23]>/gs;
const tocEntries = [];
let match;
while ((match = headingRe.exec(data.bodyHtml)) !== null) {
  const [, id, rawLabel] = match;
  const label = rawLabel.replace(/<[^>]+>/g, "").trim();
  tocEntries.push({ id, label });
}
if (tocEntries.length === 0) {
  console.warn(`  ⚠️  Warning: no <h2 id="..."> or <h3 id="..."> found in bodyHtml — table of contents will be empty.`);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function jsonLd(obj) {
  return JSON.stringify(obj, null, 2);
}

// ---------------------------------------------------------------------------
// 3. Build JSON-LD blocks (from the exact same data rendered on the page)
// ---------------------------------------------------------------------------
const articleLd = jsonLd({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: data.title,
  description: data.metaDescription,
  author: { "@type": "Person", name: author, url: `${SITE_URL}/about.html` },
  publisher: {
    "@type": "Organization",
    name: "FinanceHub India",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  datePublished,
  dateModified,
  articleSection: data.category.name,
  wordCount,
  keywords: keywords.join(", "),
});

const faqLd =
  faqs.length > 0
    ? jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      })
    : null;

const breadcrumbLd = jsonLd({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    {
      "@type": "ListItem",
      position: 2,
      name: data.category.name,
      item: `${SITE_URL}/category/${data.category.slug}.html`,
    },
    { "@type": "ListItem", position: 3, name: data.title },
  ],
});

// ---------------------------------------------------------------------------
// 4. Render page sections
// ---------------------------------------------------------------------------
const tocHtml = tocEntries.map((e) => `<a href="#${e.id}">${e.label}</a>`).join("\n");

const faqSectionHtml =
  faqs.length > 0
    ? `      <section id="faqs" class="faq-section">
        <h2>Frequently Asked Questions</h2>
${faqs
  .map(
    (f) => `<div class="faq-item">
  <button class="faq-question" aria-expanded="false">
    <span>${escapeHtml(f.question)}</span>
    <span class="plus">+</span>
  </button>
  <div class="faq-answer">
    <div class="faq-answer-inner">${f.answer}</div>
  </div>
</div>`
  )
  .join("\n")}
      </section>`
    : "";

const tagRowHtml =
  keywords.length > 0
    ? `      <div class="tag-row">
${keywords.map((k) => `        <span class="tag-chip">${escapeHtml(k)}</span>`).join("\n")}
      </div>`
    : "";

const relatedSectionHtml =
  relatedArticles.length > 0
    ? `      <section class="related-section">
        <h2>Related Articles</h2>
        <div class="related-grid">
${relatedArticles
  .map(
    (r) => `<a href="${r.href}" class="related-card">
  <span class="article-tag">${escapeHtml(r.tag)}</span>
  <h4>${escapeHtml(r.title)}</h4>
  <p>${escapeHtml(r.description)}</p>
</a>`
  )
  .join("\n")}
        </div>
      </section>`
    : "";

const sidebarLinksHtml = sidebarLinks.map((l) => `          <li><a href="${l.href}">${escapeHtml(l.title)}</a></li>`).join("\n");

const HEADER_PARTIAL = loadPartial("site-header.html");
const FOOTER_PARTIAL = loadPartial("footer-article.html");

// This inline style override (footer colors) is identical across every
// existing article — copied verbatim rather than re-derived, since it's a
// CSS specificity workaround for the theme system, not article-specific data.
const FOOTER_STYLE_OVERRIDE = `<style>
    .site-footer,
    html[data-theme="light"] .site-footer,
    html[data-theme="dark"] .site-footer {
      background: #0b1220 !important;
      color: rgba(255,255,255,.72) !important;
    }
    .site-footer .footer-brand p { color: rgba(255,255,255,.55) !important; }
    .site-footer .footer-col h5 { color: #ffffff !important; }
    .site-footer .footer-col a,
    .site-footer .footer-col li { color: rgba(255,255,255,.65) !important; }
    .site-footer .footer-col a:hover { color: #ffffff !important; }
    .site-footer .footer-disclaimer { color: rgba(255,255,255,.42) !important; }
    .site-footer .footer-disclaimer strong { color: rgba(255,255,255,.55) !important; }
    .site-footer .footer-bottom {
      border-top: 1px solid rgba(255,255,255,.08) !important;
      color: rgba(255,255,255,.45) !important;
    }
    .site-footer .footer-bottom p { color: rgba(255,255,255,.45) !important; }
  </style>`;

// ---------------------------------------------------------------------------
// 5. Assemble the full page
// ---------------------------------------------------------------------------
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f7de5" />
  <title>${escapeHtml(data.title)}</title>
  <meta name="description" content="${escapeHtml(data.metaDescription)}" />
  <meta name="author" content="${escapeHtml(author)}" />
  <meta property="og:title" content="${escapeHtml(data.title)}" />
  <meta property="og:description" content="${escapeHtml(data.metaDescription)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="FinanceHub India" />
  <meta property="og:image" content="${SITE_URL}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(data.title)}" />
  <meta name="twitter:description" content="${escapeHtml(data.metaDescription)}" />
  <meta name="twitter:image" content="${SITE_URL}/og-image.png" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <script type="application/ld+json">
${articleLd}
  </script>${
    faqLd
      ? `
  <script type="application/ld+json">
${faqLd}
  </script>`
      : ""
  }
  <script type="application/ld+json">
${breadcrumbLd}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Sora:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../css/style.css" />
${FOOTER_STYLE_OVERRIDE}
</head>
<body>
<a class="skip-link" href="#main-content">Skip to main content</a>
${HEADER_PARTIAL}

<div id="main-content"></div>
<section class="article-hero">
  <div class="container">
    <div class="breadcrumbs">
      <a href="../index.html">Home</a><span class="sep">/</span>
      <a href="../category/${data.category.slug}.html">${escapeHtml(data.category.name)}</a><span class="sep">/</span>
      <span class="current">${escapeHtml(data.title)}</span>
    </div>
    <span class="article-hero-tag">${escapeHtml(data.category.name)}</span>
    <h1>${escapeHtml(data.title)}</h1>
    <div class="article-hero-meta">
      <span>📅 Updated ${updatedLabel}</span>
      <span>⏱ ${readMinutes} min read</span>
      <span>✍️ ${escapeHtml(author)}</span>
    </div>
  </div>
</section>

<div class="container">
  <div class="article-layout">
    <div class="article-body-col">

      <details class="toc-widget" open>
        <summary>In This Guide</summary>
        <nav class="toc-list">
${tocHtml}
        </nav>
      </details>

      <article class="article-prose">
${data.bodyHtml}
      </article>

      <div class="article-disclaimer">
        <strong>Disclaimer:</strong> This article is for educational purposes only and is not SEBI-registered investment advice. Please consult a certified financial advisor before making investment decisions.
      </div>

${faqSectionHtml}

${tagRowHtml}

${relatedSectionHtml}

    </div>

    <aside class="sidebar">
      <div class="sidebar-widget">
        <div class="ad-placeholder ad-sidebar">
          <span>Advertisement</span>
        </div>
      </div>

      <div class="sidebar-widget">
        <h4 class="widget-title">More in ${escapeHtml(data.category.name)}</h4>
        <ul class="sidebar-cats">
${sidebarLinksHtml}
        </ul>
        <div style="margin-top:14px;">
          <a href="../category/${data.category.slug}.html" class="btn btn-outline btn-sm btn-block">View All ${escapeHtml(
  data.category.name
)} Guides →</a>
        </div>
      </div>
    </aside>
  </div>
</div>

${FOOTER_PARTIAL}

<button id="back-top" aria-label="Back to top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑</button>

<script type="module" src="../js/app.js"></script>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// 6. Write output
// ---------------------------------------------------------------------------
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, "utf8");

console.log(`\n✔ Generated articles/${data.slug}.html`);
console.log(`  ${wordCount} words · ~${readMinutes} min read · ${tocEntries.length} TOC entries · ${faqs.length} FAQs`);
console.log(`\n  Still to do by hand:`);
console.log(`  1. Add it to public/sitemap.xml`);
console.log(`  2. Link to it from category/${data.category.slug}.html (and any other article's "Related"/sidebar you want it in)`);
console.log(`  3. Open it locally and proofread — the generator doesn't check your prose, only the structure.\n`);
