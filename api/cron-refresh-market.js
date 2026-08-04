// =============================================================================
// /api/cron-refresh-market.js
// -----------------------------------------------------------------------------
// Triggered automatically by Vercel Cron once per day (see vercel.json —
// Vercel's free Hobby plan caps ALL cron jobs at once-per-day; more
// frequent expressions fail at deploy time). Its job is to "warm" the
// market data cache by calling the same logic /api/market.js uses, so
// that the very first visitor of the day doesn't have to wait on a cold
// upstream call. Real-time freshness throughout the day comes from
// every visitor's browser polling /api/market every 60 seconds — this
// cron is just a once-a-day head start, not the primary refresh path.
//
// Vercel Cron Jobs send a GET request with an Authorization header
// containing the CRON_SECRET when one is configured — we verify it below
// so this endpoint can't be triggered by random members of the public to
// burn through our free-tier API quota.
// =============================================================================

export default async function handler(req, res) {
  // Optional but recommended: verify the request actually came from
  // Vercel's Cron scheduler using a shared secret.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    // Re-use market.js's handler logic by calling our own deployed API
    // route. Using the VERCEL_URL env var (auto-provided by Vercel) means
    // this works in production and preview deployments without any
    // hardcoded domain.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const refreshRes = await fetch(`${baseUrl}/api/market?warm=1`);
    const ok = refreshRes.ok;

    return res.status(200).json({
      refreshed: ok,
      target: "market",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
