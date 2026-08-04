// =============================================================================
// js/news.js
// -----------------------------------------------------------------------------
// MODULE: Live market news.
// Responsible for:
//   - Fetching /api/news on page load and every 15 minutes
//   - Rendering: featured headline, top 10 latest news, image, source,
//     published time, and a "Read More" button for each story
//   - Category pill filtering (India / RBI / IPO / Mutual Funds / Global)
//   - Skeleton loading state on first load, error card on total failure
// =============================================================================

const NEWS_REFRESH_MS = 15 * 60 * 1000; // 15 minutes, per spec
let currentCategory = "all";
let newsRefreshTimer = null;

/**
 * Converts an ISO timestamp into a friendly "x minutes/hours ago" string,
 * falling back to a readable date for older articles.
 */
function timeAgo(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Escapes basic HTML special characters to avoid markup injection from feeds. */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the single large "featured headline" card.
 */
function renderFeatured(article) {
  const el = document.getElementById("news-featured-card");
  if (!el) return;

  if (!article) {
    el.innerHTML = `<div class="news-img skeleton"></div><div class="news-body"><span class="skel-line w-60 skeleton"></span><span class="skel-line w-80 skeleton"></span></div>`;
    return;
  }

  const img = article.image
    ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(
        article.title
      )}" loading="lazy" width="600" height="200" />`
    : "";

  el.innerHTML = `
    <div class="news-img">
      ${img}
      <span class="news-tag">Featured</span>
    </div>
    <div class="news-body">
      <h3><a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
    article.title
  )}</a></h3>
      <div class="news-meta">
        <span class="src">${escapeHtml(article.source)}</span>
        <span aria-hidden="true">·</span>
        <span>${timeAgo(article.publishedAt)}</span>
      </div>
      <p>${escapeHtml(article.description || "")}</p>
      <a class="news-readmore" href="${escapeHtml(
        article.url
      )}" target="_blank" rel="noopener noreferrer">Read More →</a>
    </div>
  `;
}

/**
 * Renders the compact side list of stories (used next to the featured card).
 */
function renderSideList(articles) {
  const el = document.getElementById("news-side-list");
  if (!el) return;

  if (!articles || articles.length === 0) {
    el.innerHTML = Array.from({ length: 3 })
      .map(
        () =>
          `<div class="news-side-item"><div class="news-side-img skeleton"></div><div class="news-side-body"><span class="skel-line w-80 skeleton"></span><span class="skel-line w-40 skeleton"></span></div></div>`
      )
      .join("");
    return;
  }

  el.innerHTML = articles
    .slice(0, 3)
    .map((a) => {
      const img = a.image
        ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" loading="lazy" width="64" height="64" />`
        : "📰";
      return `
        <div class="news-side-item">
          <div class="news-side-img">${img}</div>
          <div class="news-side-body">
            <h4><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        a.title
      )}</a></h4>
            <div class="news-side-meta">${escapeHtml(a.source)} · ${timeAgo(a.publishedAt)}</div>
          </div>
        </div>`;
    })
    .join("");
}

/**
 * Renders the remaining grid of news cards (rest of the top 10).
 */
function renderNewsGrid(articles) {
  const el = document.getElementById("news-grid");
  if (!el) return;

  if (!articles || articles.length === 0) {
    el.innerHTML = Array.from({ length: 6 })
      .map(
        () =>
          `<div class="news-skel-card"><div class="news-img skeleton"></div><div class="news-body"><span class="skel-line w-80 skeleton"></span><span class="skel-line w-60 skeleton"></span></div></div>`
      )
      .join("");
    return;
  }

  el.innerHTML = articles
    .map((a) => {
      const img = a.image
        ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" loading="lazy" width="260" height="140" />`
        : "";
      return `
        <div class="news-card">
          <div class="news-img">${img}</div>
          <div class="news-body">
            <h3><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        a.title
      )}</a></h3>
            <div class="news-meta">
              <span class="src">${escapeHtml(a.source)}</span>
              <span aria-hidden="true">·</span>
              <span>${timeAgo(a.publishedAt)}</span>
            </div>
            <p>${escapeHtml(a.description || "")}</p>
            <a class="news-readmore" href="${escapeHtml(
              a.url
            )}" target="_blank" rel="noopener noreferrer">Read More →</a>
          </div>
        </div>`;
    })
    .join("");
}

function showNewsError(message) {
  const el = document.getElementById("news-error-banner");
  if (!el) return;
  el.style.display = "flex";
  el.querySelector("[data-field='message']").textContent =
    message || "Live news is temporarily unavailable.";
}

function hideNewsError() {
  const el = document.getElementById("news-error-banner");
  if (el) el.style.display = "none";
}

function renderNewsUpdatedAt(iso) {
  const el = document.getElementById("news-updated-at");
  if (!el || !iso) return;
  const d = new Date(iso);
  el.textContent = `Updated ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Main fetch + render cycle for the news section.
 */
async function refreshNews(category = currentCategory) {
  try {
    const res = await fetch(`/api/news?category=${encodeURIComponent(category)}`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const json = await res.json();

    if (!json.allArticles) throw new Error("Malformed news response");

    hideNewsError();
    renderFeatured(json.featured);
    renderSideList(json.articles);
    // Grid shows articles 4-10 (the side list already covers 2-3, featured covers 1).
    renderNewsGrid(json.articles.slice(2, 9));
    renderNewsUpdatedAt(json.updatedAt);
  } catch (err) {
    console.error("[news.js] refresh failed:", err);
    const el = document.getElementById("news-featured-card");
    const alreadyHasContent = el && el.querySelector("h3");
    if (!alreadyHasContent) {
      showNewsError(
        "Couldn't load live news right now. We'll keep trying automatically."
      );
    }
  }
}

/**
 * Wires up the category filter pills (India / RBI / IPO / Mutual Funds / Global).
 */
function initCategoryPills() {
  const pills = document.querySelectorAll(".news-pill");
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => {
        p.classList.remove("active");
        p.setAttribute("aria-selected", "false");
      });
      pill.classList.add("active");
      pill.setAttribute("aria-selected", "true");
      currentCategory = pill.dataset.category || "all";

      // Show skeletons immediately for snappy feedback while refetching.
      renderFeatured(null);
      renderSideList(null);
      renderNewsGrid(null);
      refreshNews(currentCategory);
    });
  });
}

/**
 * Public init function called from app.js once the DOM is ready.
 */
export function initNewsModule() {
  initCategoryPills();
  refreshNews();

  if (newsRefreshTimer) clearInterval(newsRefreshTimer);
  newsRefreshTimer = setInterval(() => refreshNews(currentCategory), NEWS_REFRESH_MS);
}
