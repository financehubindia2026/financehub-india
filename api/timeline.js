// =============================================================================
// /api/timeline.js
// -----------------------------------------------------------------------------
// Vercel Serverless Function (Node.js runtime).
// Builds the "Today's Chronology / Market Timeline" section and a short
// auto-generated "Market Pulse" line, entirely by RE-USING the responses
// already produced by /api/news and /api/market — it does NOT call GNews,
// NewsAPI, Finnhub, Yahoo Finance, or Twelve Data directly, so it adds
// ZERO extra load against those free-tier quotas.
//
// HOW IT WORKS:
//   1. Internally calls this same deployment's /api/news?category=all
//      (already cached 10 min server-side) to get today's top headlines.
//   2. Internally calls /api/market (already cached 5 min server-side)
//      to get the latest Nifty/Sensex figures.
//   3. Buckets each headline into a badge (RBI / IPO / Crude / Commodities
//      / Global / Mutual Funds / Stocks) via simple keyword matching, using
//      the article's own publishedAt timestamp as the timeline time — so
//      the timeline is always today's real chronology, not a guess.
//   4. Builds one short "Market Pulse" sentence from the live index move
//      + the single most recent headline.
//
// CACHING:
//   Same in-memory + HTTP caching pattern as market.js/news.js. Cached
//   10 minutes (matches news.js's cadence, since this is news-derived).
//   A once-daily Vercel Cron (see vercel.json / cron-refresh-timeline.js)
//   pre-warms this cache; ongoing freshness during the day comes from
//   every visitor's browser polling this endpoint every 15 minutes
//   (see js/timeline.js).
//
// SAFETY:
//   If /api/news or /api/market fail, this degrades gracefully — a
//   missing piece just means a shorter timeline / no market-pulse line,
//   never a hard error, and the hand-written timeline already in
//   index.html stays on screen as the fallback (js/timeline.js only
//   overwrites it once real data comes back).
// =============================================================================

let cache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes, matches news.js cadence

// Checked in order — first match wins. Keep RBI/IPO/Crude/Commodities/
// Global/Mutual Funds ahead of the generic "Stocks" catch-all.
const CATEGORY_RULES = [
  { badge: "RBI", cls: "info", test: /\bRBI\b|Reserve Bank of India|repo rate|monetary policy/i },
  { badge: "IPO", cls: "info", test: /\bIPO\b|initial public offering|stake sale|\blisting\b/i },
  { badge: "Crude", cls: "neg", test: /crude|brent|\bwti\b|oil price/i },
  { badge: "Commodities", cls: "pos", test: /\bgold\b|\bsilver\b/i },
  { badge: "Global", cls: "warn", test: /wall street|nasdaq|fed rate|s&p ?500|dow jones|global markets|asian markets/i },
  { badge: "Mutual Funds", cls: "info", test: /mutual fund|\bSIP\b|\bAMFI\b/i },
  { badge: "Stocks", cls: "pos", test: /sensex|nifty|share price|\bstock\b|\bNSE\b|\bBSE\b/i },
];

function categorize(article) {
  const text = `${article.title || ""} ${article.description || ""}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(text)) return { badge: rule.badge, cls: rule.cls };
  }
  return { badge: "Markets", cls: "pos" };
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "";
  }
}

/**
 * Turns today's news articles into timeline entries, oldest-first, capped
 * at 8 items so the section doesn't grow unbounded on a heavy news day.
 */
function buildTimeline(articles) {
  return articles
    .filter((a) => a.publishedAt)
    .map((a) => {
      const { badge, cls } = categorize(a);
      return {
        time: formatTime(a.publishedAt),
        iso: a.publishedAt,
        badge,
        cls,
        text: a.title,
        url: a.url,
        source: a.source,
      };
    })
    .sort((a, b) => new Date(a.iso) - new Date(b.iso))
    .slice(-8);
}

/**
 * One short templated sentence combining the live index move with the
 * most recent headline. Intentionally simple (no LLM call, no extra
 * cost) — just enough to make the section feel "today", matching the
 * hand-written "Market Summary" article's tone.
 */
function buildMarketPulse(market, latestArticle) {
  const parts = [];
  const nifty = market?.nifty50;
  const sensex = market?.sensex;

  if (nifty && typeof nifty.changePercent === "number") {
    const dir = nifty.change >= 0 ? "up" : "down";
    const sign = nifty.change >= 0 ? "+" : "";
    parts.push(
      `Nifty 50 is ${dir} at ${nifty.displayValue ?? nifty.price} (${sign}${nifty.changePercent.toFixed(2)}%)`
    );
  }
  if (sensex && typeof sensex.changePercent === "number") {
    const dir = sensex.change >= 0 ? "up" : "down";
    parts.push(`Sensex ${dir} at ${sensex.displayValue ?? sensex.price}`);
  }

  let sentence = parts.length ? parts.join(", ") + "." : "";
  if (latestArticle?.title) {
    sentence += `${sentence ? " " : ""}Latest: ${latestArticle.title}.`;
  }
  return sentence || null;
}

function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

async function getTimelineData() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return { ...cache.data, fromCache: true };
  }

  const baseUrl = getBaseUrl();
  const errors = [];
  let articles = [];
  let market = {};

  try {
    const newsRes = await fetch(`${baseUrl}/api/news?category=all`);
    if (!newsRes.ok) throw new Error(`news status ${newsRes.status}`);
    const newsJson = await newsRes.json();
    articles = newsJson.allArticles || [];
  } catch (err) {
    errors.push(`news: ${err.message}`);
  }

  try {
    const marketRes = await fetch(`${baseUrl}/api/market`);
    if (!marketRes.ok) throw new Error(`market status ${marketRes.status}`);
    const marketJson = await marketRes.json();
    market = marketJson.market || {};
  } catch (err) {
    errors.push(`market: ${err.message}`);
  }

  const timeline = buildTimeline(articles);
  const marketPulse = buildMarketPulse(market, articles[0]);

  const result = {
    updatedAt: new Date().toISOString(),
    timeline,
    marketPulse,
    errors: errors.length ? errors : undefined,
  };

  const isEmpty = timeline.length === 0 && !marketPulse;
  if (isEmpty && cache.data) {
    // Prefer serving yesterday's still-reasonable timeline over an
    // empty section if both upstream calls failed.
    return { ...cache.data, stale: true, errors };
  }

  cache = { data: result, timestamp: now };
  return result;
}

// -----------------------------------------------------------------------------
// Vercel Serverless Function handler
// -----------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getTimelineData();
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=300"
    );
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to build timeline",
      message: err.message,
    });
  }
}
