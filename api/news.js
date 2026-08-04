// =============================================================================
// /api/news.js
// -----------------------------------------------------------------------------
// Vercel Serverless Function (Node.js runtime).
// Fetches LIVE Indian + global financial news covering:
//   Indian market news, RBI news, IPO news, mutual fund news,
//   stock market news, and global market news.
//
// DATA SOURCES (free tier, in priority order with automatic fallback):
//   1. GNews          (https://gnews.io)        — free: 100 requests/day
//   2. NewsAPI.org     (https://newsapi.org)     — free: 100 requests/day (dev use)
//   3. Finnhub         (https://finnhub.io)      — free: 60 calls/minute, has a
//                                                  dedicated /news endpoint for
//                                                  general market news (used as
//                                                  a topical fallback, not for
//                                                  India-specific keyword search)
//
// Each provider is tried in order; if one fails (missing key, rate-limited,
// network error, or empty results) the next one is tried automatically.
// Alpha Vantage and Twelve Data do not offer a general news-search endpoint
// suitable for keyword queries like "RBI" or "IPO India" on the free tier,
// so they are intentionally not used for this endpoint (Twelve Data is
// instead used in api/market.js for price fallback).
//
// CACHING:
//   Responses are cached in-memory for 10 minutes (news changes slower
//   than prices) plus standard HTTP cache headers. A once-daily Vercel
//   Cron Job (see vercel.json) pre-warms this cache — Vercel's Hobby
//   plan caps cron at once per day, so ongoing freshness throughout the
//   day comes from every visitor's browser re-requesting this endpoint
//   every 15 minutes (see js/news.js), with the 10-minute server cache
//   absorbing repeat requests in between.
//
// SECURITY:
//   API keys (GNEWS_API_KEY, NEWSAPI_KEY, FINNHUB_API_KEY) are read only
//   from server-side environment variables and are NEVER included in the
//   JSON sent to the browser.
// =============================================================================

let cache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Search query covering the categories requested: Indian market news,
// RBI news, IPO news, mutual fund news, stock market news, global market news.
const SEARCH_QUERY =
  '("Indian stock market" OR Sensex OR Nifty OR RBI OR "IPO India" OR "mutual fund" India OR "global markets")';

const CATEGORY_QUERIES = {
  all: SEARCH_QUERY,
  india: '("Indian stock market" OR Sensex OR Nifty)',
  rbi: '(RBI OR "Reserve Bank of India" OR "monetary policy" India)',
  ipo: '("IPO India" OR "initial public offering" India)',
  mutualfunds: '("mutual fund" India OR SIP OR AMFI)',
  global: '("global markets" OR "Wall Street" OR "Fed rate" OR "Asian markets")',
};

/**
 * Provider 1: GNews — https://gnews.io/docs/v4
 */
async function fetchFromGNews(query) {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) throw new Error("GNEWS_API_KEY not configured");

  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    query
  )}&lang=en&country=in&max=10&sortby=publishedAt&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GNews status ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.articles) || json.articles.length === 0) {
    throw new Error("GNews returned no articles");
  }

  return json.articles.map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    image: a.image || null,
    source: a.source?.name || "GNews",
    publishedAt: a.publishedAt,
  }));
}

/**
 * Provider 2 (fallback): NewsAPI.org — https://newsapi.org/docs
 */
async function fetchFromNewsAPI(query) {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) throw new Error("NEWSAPI_KEY not configured");

  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    query
  )}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NewsAPI status ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json.articles) || json.articles.length === 0) {
    throw new Error("NewsAPI returned no articles");
  }

  return json.articles.map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    image: a.urlToImage || null,
    source: a.source?.name || "NewsAPI",
    publishedAt: a.publishedAt,
  }));
}

/**
 * Provider 3 (fallback): Finnhub general market news —
 * https://finnhub.io/docs/api/market-news
 * Note: Finnhub's free news endpoint is topical (general/forex/crypto/merger)
 * rather than keyword-searchable, so it's used as a last-resort fallback to
 * ensure the news section is never empty, rather than for category filtering.
 */
async function fetchFromFinnhub() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY not configured");

  const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Finnhub status ${res.status}: ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("Finnhub returned no articles");
  }

  return json.slice(0, 10).map((a) => ({
    title: a.headline,
    description: a.summary,
    url: a.url,
    image: a.image || null,
    source: a.source || "Finnhub",
    publishedAt: a.datetime
      ? new Date(a.datetime * 1000).toISOString()
      : new Date().toISOString(),
  }));
}

/**
 * Tries each provider in order until one succeeds. Returns both the
 * articles and which provider ultimately served them (useful for
 * debugging / transparency, stripped from the public response if desired).
 */
async function fetchNewsWithFallback(category) {
  const query = CATEGORY_QUERIES[category] || CATEGORY_QUERIES.all;
  const attempts = [];

  for (const [name, fn] of [
    ["gnews", () => fetchFromGNews(query)],
    ["newsapi", () => fetchFromNewsAPI(query)],
    ["finnhub", () => fetchFromFinnhub()],
  ]) {
    try {
      const articles = await fn();
      return { provider: name, articles, attempts };
    } catch (err) {
      attempts.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(
    `All news providers failed. Attempts: ${attempts.join(" | ")}`
  );
}

/**
 * Deduplicates articles by title (different providers sometimes carry
 * the same wire story) and trims to a max count.
 */
function dedupeAndTrim(articles, max = 10) {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const normalizedTitle = (a.title || "").trim().toLowerCase();
    if (!normalizedTitle || seen.has(normalizedTitle)) continue;
    seen.add(normalizedTitle);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

async function getNewsData(category) {
  const now = Date.now();
  const cacheKey = category || "all";

  if (
    cache.data &&
    cache.data._cacheKey === cacheKey &&
    now - cache.timestamp < CACHE_TTL_MS
  ) {
    return { ...cache.data, fromCache: true };
  }

  try {
    const { provider, articles } = await fetchNewsWithFallback(cacheKey);
    const cleaned = dedupeAndTrim(articles, 10);

    const result = {
      updatedAt: new Date().toISOString(),
      provider,
      featured: cleaned[0] || null,
      articles: cleaned.slice(1),
      allArticles: cleaned, // convenience: full top-10 including featured
      _cacheKey: cacheKey,
    };

    cache = { data: result, timestamp: now };
    return result;
  } catch (err) {
    // If every provider failed, serve a stale cache rather than an error
    // page, if one exists — graceful degradation.
    if (cache.data && cache.data._cacheKey === cacheKey) {
      return { ...cache.data, stale: true, error: err.message };
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Vercel Serverless Function handler
// -----------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const category = (req.query.category || "all").toLowerCase();

  try {
    const data = await getNewsData(category);

    // Cache for 10 minutes at the edge, serve stale up to 5 min longer
    // while revalidating in the background.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=600, stale-while-revalidate=300"
    );
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch news data",
      message: err.message,
    });
  }
}
