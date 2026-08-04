// =============================================================================
// js/market.js
// -----------------------------------------------------------------------------
// MODULE: Live market data.
// Responsible for:
//   - Fetching /api/market on page load and every 60 seconds
//   - Updating the market cards, hero mini-tickers, sidebar snapshot,
//     and the scrolling ticker strip — WITHOUT reloading the page
//   - Showing skeleton loading states while the first fetch is in flight
//   - Showing a per-card error state if a specific value never loads
//   - Updating the "Live Data · <date>" eyebrow with today's real date
//
// This file intentionally does NOT touch any existing CSS classes — it
// only toggles `data-state` attributes and fills in text content, all of
// which is styled by the additions in css/style.css.
// =============================================================================

const MARKET_REFRESH_MS = 60 * 1000; // 60 seconds, per spec
const MARKET_CARD_KEYS = [
  "nifty50",
  "sensex",
  "bankNifty",
  "indiaVix",
  "usdInr",
  "gold",
  "brent",
  "wti",
];

// Maps each market card's data-market attribute to the API response key,
// and tells us which DOM elements inside that card to fill in.
function getCardEl(key) {
  return document.querySelector(`[data-market="${key}"]`);
}

/**
 * Builds a tiny inline SVG sparkline polyline from an array of numbers,
 * matching the existing inline sparkline markup/style already in the HTML.
 */
function renderSparkline(points, isPositive) {
  if (!points || points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const stepX = w / (points.length - 1);

  const coords = points
    .map((p, i) => {
      const x = (i * stepX).toFixed(1);
      // Invert Y because SVG y-axis grows downward.
      const y = (h - ((p - min) / range) * h).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  const stroke = isPositive ? "#0dab76" : "#e53935";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${coords}" fill="none" stroke="${stroke}" stroke-width="2"/></svg>`;
}

/**
 * Renders one market card's live values into the existing card markup.
 * Expects the card to already contain elements with data-field attributes
 * for value, change, and sparkline (added in index.html).
 */
function renderMarketCard(key, entry) {
  const card = getCardEl(key);
  if (!card) return;

  if (!entry) {
    card.dataset.state = "error";
    return;
  }

  card.dataset.state = "loaded";
  const isPositive = entry.change >= 0;

  card.classList.remove("pos", "neg");
  card.classList.add(isPositive ? "pos" : "neg");

  const valEl = card.querySelector("[data-field='value']");
  const chgEl = card.querySelector("[data-field='change']");
  const sparkEl = card.querySelector("[data-field='sparkline']");

  if (valEl) valEl.textContent = entry.displayValue ?? entry.price;

  if (chgEl) {
    const arrow = isPositive ? "▲" : "▼";
    const sign = isPositive ? "+" : "";
    const pct = entry.changePercent != null ? entry.changePercent.toFixed(2) : "0.00";
    const changeAbs = Math.abs(entry.change).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
    chgEl.textContent = `${arrow} ${sign}${changeAbs} (${sign}${pct}%)`;
    chgEl.classList.remove("pos", "neg");
    chgEl.classList.add(isPositive ? "pos" : "neg");
  }

  if (sparkEl) {
    sparkEl.innerHTML = renderSparkline(entry.sparkline, isPositive);
  }
}

/**
 * Updates the small "mini ticker" list inside the hero visual card.
 */
function renderHeroMiniTickers(market) {
  const map = [
    ["nifty50", "Nifty 50"],
    ["sensex", "Sensex"],
    ["bankNifty", "Bank Nifty"],
    ["usdInr", "USD/INR"],
    ["gold", "Gold ₹/10g"],
  ];

  const container = document.getElementById("hero-mini-tickers");
  if (!container) return;

  container.innerHTML = map
    .map(([key, label]) => {
      const e = market[key];
      if (!e) {
        return `<div class="mini-tick"><span>${label}</span><span class="val">—</span></div>`;
      }
      const isPositive = e.change >= 0;
      const arrow = isPositive ? "▲" : "▼";
      const pct = e.changePercent != null ? Math.abs(e.changePercent).toFixed(2) : "0.00";
      return `<div class="mini-tick"><span>${label}</span><span class="val ${
        isPositive ? "up" : "dn"
      }">${e.displayValue} ${arrow} ${pct}%</span></div>`;
    })
    .join("");
}

/**
 * Updates the sidebar "Market Snapshot" card.
 */
function renderSidebarSnapshot(market) {
  const rows = [
    ["nifty50", "Nifty 50"],
    ["sensex", "Sensex"],
    ["bankNifty", "Bank Nifty"],
    ["indiaVix", "India VIX"],
    ["usdInr", "USD/INR"],
    ["brent", "Brent Crude"],
    ["gold", "Gold ₹/10g"],
  ];

  const container = document.getElementById("sidebar-snapshot");
  if (!container) return;

  container.innerHTML = rows
    .map(([key, label]) => {
      const e = market[key];
      if (!e) {
        return `<div class="snap-row"><span>${label}</span><span style="color:var(--muted)">—</span></div>`;
      }
      const isPositive = e.change >= 0;
      const cls = isPositive ? "positive-text" : "negative-text";
      const arrow = isPositive ? "▲" : "▼";
      return `<div class="snap-row"><span>${label}</span><span class="${cls}">${e.displayValue} ${arrow}</span></div>`;
    })
    .join("");
}

/**
 * Rebuilds the scrolling ticker-strip at the top of the page using live
 * data, preserving the existing duplicate-for-seamless-loop technique.
 */
function renderTickerStrip(market) {
  const track = document.getElementById("ticker-track");
  if (!track) return;

  const order = [
    "nifty50",
    "sensex",
    "bankNifty",
    "indiaVix",
    "usdInr",
    "gold",
    "brent",
    "wti",
  ];

  const ticks = order
    .filter((k) => market[k])
    .map((k) => {
      const e = market[k];
      const isPositive = e.change >= 0;
      const arrow = isPositive ? "▲" : "▼";
      const pct = e.changePercent != null ? Math.abs(e.changePercent).toFixed(2) : "0.00";
      return [e.label, e.displayValue, `${arrow} ${isPositive ? "+" : "-"}${pct}%`, isPositive ? "up" : "dn"];
    });

  if (ticks.length === 0) return;

  track.innerHTML = [...ticks, ...ticks]
    .map(
      ([n, v, c, d]) =>
        `<div class="ticker-item"><span class="t-name">${n}</span><span>${v}</span><span class="t-${d}">${c}</span></div>`
    )
    .join("");
}

/**
 * NOTE: The "Live Data · <date>" eyebrow text is handled by app.js's
 * renderCurrentDates() via the generic [data-current-date] attribute
 * (see index.html), so market.js doesn't need its own date-rendering
 * logic — this keeps date formatting in exactly one place.
 */

/**
 * Updates the small "last updated HH:MM:SS" text shown near market data.
 */
function renderUpdatedAt(iso) {
  const el = document.getElementById("market-updated-at");
  if (!el || !iso) return;
  const d = new Date(iso);
  el.textContent = `Updated ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Toggles the small green "live" pulse dot to grey if data is stale
 * (e.g. every upstream API failed and we're showing a cached copy).
 */
function setLiveIndicator(isLive) {
  document.querySelectorAll(".live-pulse").forEach((el) => {
    el.classList.toggle("stale", !isLive);
  });
}

/**
 * Puts every market card into the loading-skeleton state. Called once,
 * before the very first fetch resolves.
 */
function setAllCardsLoading() {
  MARKET_CARD_KEYS.forEach((key) => {
    const card = getCardEl(key);
    if (card) card.dataset.state = "loading";
  });
}

/**
 * Shows a global error card (used only if /api/market itself is
 * unreachable, not for individual missing fields which degrade per-card).
 */
function showMarketSectionError(message) {
  const el = document.getElementById("market-error-banner");
  if (!el) return;
  el.style.display = "flex";
  el.querySelector("[data-field='message']").textContent =
    message || "Live market data is temporarily unavailable.";
}

function hideMarketSectionError() {
  const el = document.getElementById("market-error-banner");
  if (el) el.style.display = "none";
}

/**
 * Main fetch + render cycle for market data.
 */
async function refreshMarketData() {
  try {
    const res = await fetch("/api/market");
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const json = await res.json();

    if (!json.market) throw new Error("Malformed market response");

    hideMarketSectionError();
    setLiveIndicator(!json.stale);

    MARKET_CARD_KEYS.forEach((key) => renderMarketCard(key, json.market[key]));
    renderHeroMiniTickers(json.market);
    renderSidebarSnapshot(json.market);
    renderTickerStrip(json.market);
    renderUpdatedAt(json.updatedAt);
  } catch (err) {
    console.error("[market.js] refresh failed:", err);
    // Only show the big banner if we have literally nothing on screen yet
    // (first load failure). Otherwise keep showing the last good data and
    // just mark the live dot as stale.
    setLiveIndicator(false);
    const anyLoaded = MARKET_CARD_KEYS.some(
      (k) => getCardEl(k)?.dataset.state === "loaded"
    );
    if (!anyLoaded) {
      MARKET_CARD_KEYS.forEach((key) => {
        const card = getCardEl(key);
        if (card) card.dataset.state = "error";
      });
      showMarketSectionError(
        "Couldn't load live market data right now. We'll keep trying automatically."
      );
    }
  }
}

/**
 * Public init function called from app.js once the DOM is ready.
 * (The "Live Data · <date>" label is handled separately by app.js's
 * renderCurrentDates(), which runs before this is called.)
 */
export function initMarketModule() {
  setAllCardsLoading();
  refreshMarketData();
  setInterval(refreshMarketData, MARKET_REFRESH_MS);
}
