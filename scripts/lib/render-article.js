// scripts/lib/render-article.js
// -----------------------------------------------------------------------------
// Renders one article object into the full articles/<slug>.html page, reusing
// the exact existing layout/CSS/partials (this is the same markup previously
// produced by scripts/new-article.js — refactored here into a pure function so
// both `new:article` scaffolding and the `publish` pipeline share one
// implementation and can never drift apart).
// -----------------------------------------------------------------------------
import fs from "fs";
import path from "path";
import { PATHS, SITE_URL, SITE_NAME } from "./config.js";
import { computeRelated, computeSidebarLinks, computePrevNext } from "./related.js";
import { slugify } from "./content.js";

function loadPartial(name) {
  return fs.readFileSync(path.join(PATHS.partials, name), "utf8").trim();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function jsonLd(obj) {
  return JSON.stringify(obj, null, 2);
}

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

/**
 * @param {object} article - normalized article from lib/content.js
 * @param {object[]} allArticles - full corpus (sorted desc by date), for related/prev/next
 */
export function renderArticleHtml(article, allArticles) {
  const canonicalUrl = `${SITE_URL}${article.url}`;
  const related = computeRelated(article, allArticles);
  const sidebarLinks = computeSidebarLinks(article, allArticles);
  const { prev, next } = computePrevNext(article, allArticles);

  const updatedLabel = new Date(article.updated + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const articleLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    author: { "@type": "Person", name: article.author, url: `${SITE_URL}/about.html` },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    datePublished: article.date,
    dateModified: article.updated,
    articleSection: article.category.name,
    wordCount: article.wordCount,
    keywords: article.tags.join(", "),
    ...(article.image ? { image: `${SITE_URL}${article.image}` } : {}),
  });

  const faqLd =
    article.faqs.length > 0
      ? jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: article.faqs.map((f) => ({
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
        name: article.category.name,
        item: `${SITE_URL}/category/${article.category.slug}.html`,
      },
      { "@type": "ListItem", position: 3, name: article.title },
    ],
  });

  const tocHtml = article.toc.map((e) => `<a href="#${e.id}">${e.label}</a>`).join("\n");

  const faqSectionHtml =
    article.faqs.length > 0
      ? `      <section id="faqs" class="faq-section">
        <h2>Frequently Asked Questions</h2>
${article.faqs
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
    article.tags.length > 0
      ? `      <div class="tag-row">
${article.tags.map((k) => `        <a href="../tag/${escapeHtml(slugify(k))}.html" class="tag-chip">${escapeHtml(k)}</a>`).join("\n")}
      </div>`
      : "";

  const relatedSectionHtml =
    related.length > 0
      ? `      <section class="related-section">
        <h2>Related Articles</h2>
        <div class="related-grid">
${related
  .map(
    (r) => `<a href="${escapeHtml(SITE_URL + r.url)}" class="related-card">
  <span class="article-tag">${escapeHtml(r.category.name)}</span>
  <h4>${escapeHtml(r.title)}</h4>
  <p>${escapeHtml(r.description)}</p>
</a>`
  )
  .join("\n")}
        </div>
      </section>`
      : "";

  const prevNextHtml =
    prev || next
      ? `      <div class="prev-next-nav" style="display:flex;justify-content:space-between;gap:16px;margin:32px 0;flex-wrap:wrap;">
${
  prev
    ? `        <a href="../articles/${prev.slug}.html" class="btn btn-outline" style="flex:1;min-width:200px;">← ${escapeHtml(
        prev.title
      )}</a>`
    : `<span></span>`
}
${
  next
    ? `        <a href="../articles/${next.slug}.html" class="btn btn-outline" style="flex:1;min-width:200px;text-align:right;">${escapeHtml(
        next.title
      )} →</a>`
    : ""
}
      </div>`
      : "";

  const shareButtonsHtml = `      <div class="share-buttons" style="display:flex;gap:10px;margin:20px 0;flex-wrap:wrap;">
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(
          canonicalUrl
        )}&text=${encodeURIComponent(article.title)}">Share on X</a>
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          canonicalUrl
        )}">Share on LinkedIn</a>
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(
          article.title + " " + canonicalUrl
        )}">Share on WhatsApp</a>
      </div>`;

  const sidebarLinksHtml = sidebarLinks
    .map((l) => `          <li><a href="${l.slug}.html">${escapeHtml(l.title)}</a></li>`)
    .join("\n");

  const HEADER_PARTIAL = loadPartial("site-header.html");
  const FOOTER_PARTIAL = loadPartial("footer-article.html");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f7de5" />
  <title>${escapeHtml(article.title)}</title>
  <meta name="description" content="${escapeHtml(article.description)}" />
  <meta name="author" content="${escapeHtml(article.author)}" />
  <meta property="og:title" content="${escapeHtml(article.title)}" />
  <meta property="og:description" content="${escapeHtml(article.description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:image" content="${SITE_URL}${article.image || "/og-image.png"}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(article.title)}" />
  <meta name="twitter:description" content="${escapeHtml(article.description)}" />
  <meta name="twitter:image" content="${SITE_URL}${article.image || "/og-image.png"}" />
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
      <a href="../category/${article.category.slug}.html">${escapeHtml(article.category.name)}</a><span class="sep">/</span>
      <span class="current">${escapeHtml(article.title)}</span>
    </div>
    <span class="article-hero-tag">${escapeHtml(article.category.name)}</span>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="article-hero-meta">
      <span>📅 Updated ${updatedLabel}</span>
      <span>⏱ ${article.readMinutes} min read</span>
      <span>✍️ ${escapeHtml(article.author)}</span>
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
${article.bodyHtml}
      </article>

      <div class="article-disclaimer">
        <strong>Disclaimer:</strong> This article is for educational purposes only and is not SEBI-registered investment advice. Please consult a certified financial advisor before making investment decisions.
      </div>

${faqSectionHtml}

${tagRowHtml}

${shareButtonsHtml}

<div class="author-box" style="display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--border,#e5e7eb);border-radius:12px;margin:20px 0;">
  <div style="width:44px;height:44px;border-radius:50%;background:var(--surface-2,#eef2f7);display:flex;align-items:center;justify-content:center;font-weight:700;">${escapeHtml(
    article.author.slice(0, 1)
  )}</div>
  <div>
    <div style="font-weight:700;">${escapeHtml(article.author)}</div>
    <div style="font-size:.85rem;color:var(--muted,#6b7280);">Published ${escapeHtml(article.date)} · Updated ${escapeHtml(
    article.updated
  )}</div>
  </div>
</div>

${prevNextHtml}

${relatedSectionHtml}

    </div>

    <aside class="sidebar">
      <div class="sidebar-widget">
        <div class="ad-placeholder ad-sidebar">
          <span>Advertisement</span>
        </div>
      </div>

      <div class="sidebar-widget">
        <h4 class="widget-title">More in ${escapeHtml(article.category.name)}</h4>
        <ul class="sidebar-cats">
${sidebarLinksHtml}
        </ul>
        <div style="margin-top:14px;">
          <a href="../category/${article.category.slug}.html" class="btn btn-outline btn-sm btn-block">View All ${escapeHtml(
    article.category.name
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

  return html;
}
