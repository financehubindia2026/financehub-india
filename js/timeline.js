// =============================================================================
// js/timeline.js
// -----------------------------------------------------------------------------
// MODULE: Today's Chronology / Market Timeline (auto-refreshing).
// Responsible for:
//   - Fetching /api/timeline on page load and every 15 minutes (same
//     cadence as js/news.js, since the timeline is news-derived)
//   - Replacing the hardcoded .timeline items with today's real
//     chronology once the first fetch resolves
//   - Filling in the short auto-generated "Market Pulse" line
//   - Leaving the hand-written timeline already in index.html completely
//     untouched if the fetch fails — that hardcoded content is the
//     no-JS / pre-hydration fallback, exactly like the market cards.
//
// This file does not import from or get imported by market.js/news.js —
// if this module has a bug, live prices and the news feed are unaffected.
// =============================================================================

const TIMELINE_REFRESH_MS = 15 * 60 * 1000; // 15 minutes, matches news.js

/** Escapes basic HTML special characters (same helper as news.js). */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the timeline items into #timeline-list. If items is empty,
 * the existing hardcoded markup is left exactly as-is (no clearing).
 */
function renderTimeline(items) {
  const container = document.getElementById("timeline-list");
  if (!container || !items || items.length === 0) return;

  container.innerHTML = items
    .map(
      (item) => `
      <div class="tl-item">
        <div class="tl-time">${escapeHtml(item.time)}</div>
        <div class="tl-dot ${item.cls}"></div>
        <div class="tl-content">
          <span class="tl-badge badge-${item.cls}">${escapeHtml(item.badge)}</span>
          <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        item.text
      )}</a></p>
        </div>
      </div>`
    )
    .join("");
}

/** Fills the short auto-generated market-pulse sentence, if present. */
function renderMarketPulse(text) {
  const el = document.getElementById("market-pulse");
  if (!el || !text) return;
  el.textContent = text;
  el.style.display = "block";
}

function renderTimelineUpdatedAt(iso) {
  const el = document.getElementById("timeline-updated-at");
  if (!el || !iso) return;
  const d = new Date(iso);
  el.textContent = `Updated ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Main fetch + render cycle. Any failure is swallowed on purpose: the
 * hand-written timeline already in the HTML stays visible, so there is
 * nothing that needs an error banner here.
 */
async function refreshTimeline() {
  try {
    const res = await fetch("/api/timeline");
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const json = await res.json();

    renderTimeline(json.timeline);
    renderMarketPulse(json.marketPulse);
    renderTimelineUpdatedAt(json.updatedAt);
  } catch (err) {
    console.error("[timeline.js] refresh failed:", err);
    // Intentionally no fallback UI change — the static timeline already
    // on the page (see index.html) keeps showing.
  }
}

/**
 * Public init function called from app.js once the DOM is ready.
 */
export function initTimelineModule() {
  refreshTimeline();
  setInterval(refreshTimeline, TIMELINE_REFRESH_MS);
}
