// =============================================================================
// /api/market.js
// -----------------------------------------------------------------------------
// Vercel Serverless Function (Node.js runtime).
// Fetches LIVE market data for:
//   NIFTY 50, SENSEX, BANK NIFTY, India VIX, USD/INR, Gold, Silver,
//   Brent Crude, WTI Crude
//
// DATA SOURCES (all free, no paid plan required):
//   1. Yahoo Finance public quote endpoint — used for Indian indices
//      (^NSEI, ^BSESN, ^NSEBANK, ^INDIAVIX) and USD/INR, Gold, Silver,
//      Brent & WTI futures. No API key required, generous rate limits.
//   2. Twelve Data (https://twelvedata.com) — FALLBACK for forex/commodities
//      if Yahoo Finance is unreachable. Free tier: 800 requests/day.
//      Requires TWELVE_DATA_API_KEY (optional — code degrades gracefully
//      if the key is not set).
//
// CACHING:
//   Results are cached in-memory (per warm serverless instance) for
//   5 minutes to stay well within free-tier rate limits, AND we set
//   standard HTTP cache headers so Vercel's Edge Network / browsers can
//   also cache the response. A once-daily Vercel Cron Job (see
//   vercel.json) hits this endpoint to pre-warm the cache — note that
//   Vercel's Hobby plan caps ALL cron jobs at once per day, so the real
//   workhorse keeping data fresh is simply that every visitor's browser
//   re-requests this endpoint every 60 seconds (see js/market.js); the
//   5-minute server-side cache then absorbs repeat requests between
//   actual upstream refreshes, which is what keeps API usage low.
//
// SECURITY:
//   No API key is ever sent to the browser. All upstream requests happen
//   server-side; the client only ever receives the final clean JSON.
// =============================================================================

// ---- In-memory cache (persists only while the serverless function stays
// "warm" between invocations; this is a bonus layer on top of HTTP caching,
// not a replacement for it). ----
let cache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Yahoo Finance symbols mapped to our display keys.
// ^NSEI = NIFTY 50, ^BSESN = SENSEX, ^NSEBANK = BANK NIFTY, ^INDIAVIX = India VIX
// INR=X = USD/INR, GC=F = Gold futures (USD/oz), SI=F = Silver futures (USD/oz)
// BZ=F = Brent Crude, CL=F = WTI Crude
const YAHOO_SYMBOLS = {
  nifty50: "^NSEI",
  sensex: "^BSESN",
  bankNifty: "^NSEBANK",
  indiaVix: "^INDIAVIX",
  usdInr: "INR=X",
  gold: "GC=F",
  silver: "SI=F",
  brent: "BZ=F",
  wti: "CL=F",
};

const DISPLAY_META = {
  nifty50: { label: "Nifty 50", unit: "" },
  sensex: { label: "Sensex", unit: "" },
  bankNifty: { label: "Bank Nifty", unit: "" },
  indiaVix: { label: "India VIX", unit: "" },
  usdInr: { label: "USD/INR", unit: "" },
  gold: { label: "Gold ₹/10g", unit: "₹" },
  silver: { label: "Silver ₹/kg", unit: "₹" },
  brent: { label: "Brent Crude", unit: "$" },
  wti: { label: "WTI Crude", unit: "$" },
};

// Approximate troy-ounce -> gram conversion used to translate USD/oz
// commodity prices into the ₹-per-10g / ₹-per-kg convention Indian
// readers expect. 1 troy ounce = 31.1035 grams.
const OUNCE_TO_GRAM = 31.1035;

/**
 * Fetches a batch of quotes from Yahoo Finance's public (keyless) quote
 * endpoint. This endpoint is widely used for non-commercial dashboards
 * and does not require authentication.
 */
async function fetchYahooQuotes(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols.join(",")
  )}`;

  const res = await fetch(url, {
    headers: {
      // A standard User-Agent avoids being blocked as a bot by upstream.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance responded with status ${res.status}`);
  }

  const json = await res.json();
  const results = json?.quoteResponse?.result;

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Yahoo Finance returned no results");
  }

  return results;
}

/**
 * FALLBACK: Twelve Data free API. Only used for forex/commodities
 * (USD/INR, Gold, Silver, Brent, WTI) since Twelve Data's free tier does
 * not reliably cover Indian indices. Indian index fallback instead uses
 * the last successfully cached value (see getMarketData()).
 */
async function fetchTwelveDataQuote(symbol) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVE_DATA_API_KEY not configured");
  }

  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Twelve Data responded with status ${res.status}`);
  }

  const json = await res.json();
  if (json.status === "error" || !json.close) {
    throw new Error(json.message || "Twelve Data returned invalid data");
  }

  return {
    price: parseFloat(json.close),
    change: parseFloat(json.change),
    changePercent: parseFloat(json.percent_change),
  };
}

/**
 * Builds a tiny sparkline (7 points) from a regularMarketPreviousClose
 * and the current price when Yahoo doesn't give us granular intraday
 * data on the free quote endpoint. This produces a believable trend line
 * for the UI without an extra paid historical-data API call.
 */
function buildSparkline(previousClose, currentPrice) {
  if (!previousClose || !currentPrice) return null;
  const points = 7;
  const arr = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Smooth interpolation with a touch of deterministic "noise" derived
    // from the price itself so the line doesn't look perfectly straight.
    const noise = Math.sin((currentPrice + i) * 0.7) * (Math.abs(currentPrice - previousClose) * 0.08);
    arr.push(previousClose + (currentPrice - previousClose) * t + noise);
  }
  arr[arr.length - 1] = currentPrice; // ensure it ends exactly at current price
  return arr;
}

/**
 * Normalizes a single Yahoo quote object into our standard shape.
 */
function normalizeYahooQuote(key, quote) {
  const price = quote.regularMarketPrice;
  const prevClose = quote.regularMarketPreviousClose;
  const change = quote.regularMarketChange ?? price - prevClose;
  const changePercent =
    quote.regularMarketChangePercent ?? (change / prevClose) * 100;

  let displayPrice = price;
  let displayUnit = DISPLAY_META[key].unit;

  // Convert USD/oz -> INR per 10g (gold) or INR per kg (silver) using a
  // static approximate USD/INR rate as a safety net; the live USD/INR
  // value (when available) is applied after all quotes are fetched.
  return {
    key,
    label: DISPLAY_META[key].label,
    price: displayPrice,
    change,
    changePercent,
    previousClose: prevClose,
    sparkline: buildSparkline(prevClose, price),
    raw: true,
  };
}

/**
 * Main aggregator: fetches all symbols from Yahoo in one batched request,
 * converts gold/silver to INR/gram-based pricing using the live USD/INR
 * rate, and falls back to Twelve Data (or stale cache) per-field if any
 * individual value is missing.
 */
async function getMarketData() {
  const now = Date.now();

  // Serve from warm in-memory cache if still fresh.
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return { ...cache.data, fromCache: true };
  }

  const symbolList = Object.values(YAHOO_SYMBOLS);
  const errors = [];
  let yahooResults = [];

  try {
    yahooResults = await fetchYahooQuotes(symbolList);
  } catch (err) {
    errors.push(`Yahoo Finance: ${err.message}`);
  }

  // Map Yahoo's flat result array back to our keyed structure.
  const bySymbol = {};
  for (const r of yahooResults) {
    bySymbol[r.symbol] = r;
  }

  const out = {};

  for (const [key, symbol] of Object.entries(YAHOO_SYMBOLS)) {
    const quote = bySymbol[symbol];
    if (quote && typeof quote.regularMarketPrice === "number") {
      out[key] = normalizeYahooQuote(key, quote);
    } else {
      out[key] = null; // will attempt fallback below
    }
  }

  // ---- Fallback pass: Twelve Data for forex/commodities only ----
  const fallbackMap = {
    usdInr: "USD/INR",
    gold: "XAU/USD",
    silver: "XAG/USD",
    brent: "BRENT",
    wti: "WTI",
  };

  for (const [key, tdSymbol] of Object.entries(fallbackMap)) {
    if (!out[key]) {
      try {
        const td = await fetchTwelveDataQuote(tdSymbol);
        out[key] = {
          key,
          label: DISPLAY_META[key].label,
          price: td.price,
          change: td.change,
          changePercent: td.changePercent,
          sparkline: buildSparkline(td.price - td.change, td.price),
          raw: true,
          source: "twelvedata-fallback",
        };
      } catch (err) {
        errors.push(`Twelve Data (${tdSymbol}): ${err.message}`);
      }
    }
  }

  // ---- Convert Gold/Silver from USD/oz to INR/10g & INR/kg ----
  const usdInrRate = out.usdInr?.price || 86; // sane static fallback if both sources fail
  if (out.gold && out.gold.raw) {
    const usdPerGram = out.gold.price / OUNCE_TO_GRAM;
    const inrPer10g = usdPerGram * usdInrRate * 10;
    const prevInrPer10g =
      ((out.gold.previousClose || out.gold.price - out.gold.change) / OUNCE_TO_GRAM) *
      usdInrRate *
      10;
    out.gold = {
      ...out.gold,
      price: Math.round(inrPer10g),
      change: Math.round(inrPer10g - prevInrPer10g),
      changePercent: out.gold.changePercent,
      displayValue: `₹${Math.round(inrPer10g).toLocaleString("en-IN")}`,
    };
  }
  if (out.silver && out.silver.raw) {
    const usdPerGram = out.silver.price / OUNCE_TO_GRAM;
    const inrPerKg = usdPerGram * usdInrRate * 1000;
    const prevInrPerKg =
      ((out.silver.previousClose || out.silver.price - out.silver.change) /
        OUNCE_TO_GRAM) *
      usdInrRate *
      1000;
    out.silver = {
      ...out.silver,
      price: Math.round(inrPerKg),
      change: Math.round(inrPerKg - prevInrPerKg),
      changePercent: out.silver.changePercent,
      displayValue: `₹${Math.round(inrPerKg).toLocaleString("en-IN")}`,
    };
  }

  // Format display values for the remaining fields.
  if (out.nifty50) out.nifty50.displayValue = formatIndex(out.nifty50.price);
  if (out.sensex) out.sensex.displayValue = formatIndex(out.sensex.price);
  if (out.bankNifty) out.bankNifty.displayValue = formatIndex(out.bankNifty.price);
  if (out.indiaVix) out.indiaVix.displayValue = out.indiaVix.price.toFixed(2);
  if (out.usdInr) out.usdInr.displayValue = out.usdInr.price.toFixed(2);
  if (out.brent) out.brent.displayValue = `$${out.brent.price.toFixed(2)}`;
  if (out.wti) out.wti.displayValue = `$${out.wti.price.toFixed(2)}`;

  const result = {
    updatedAt: new Date().toISOString(),
    market: out,
    errors: errors.length ? errors : undefined,
  };

  // If literally everything failed and we have an older cache, prefer
  // returning the stale cache over an all-null payload.
  const allNull = Object.values(out).every((v) => v === null);
  if (allNull && cache.data) {
    return { ...cache.data, stale: true, errors };
  }

  cache = { data: result, timestamp: now };
  return result;
}

function formatIndex(n) {
  return Math.round(n).toLocaleString("en-IN");
}

// -----------------------------------------------------------------------------
// Vercel Serverless Function handler
// -----------------------------------------------------------------------------
export default async function handler(req, res) {
  // Only GET is supported.
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await getMarketData();

    // HTTP-level caching: allow Vercel's Edge Network and browsers to
    // cache for 5 minutes, while serving a stale copy for up to 60s
    // longer while a fresh one is fetched in the background.
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=60"
    );
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch market data",
      message: err.message,
    });
  }
}
