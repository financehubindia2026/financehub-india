// =============================================================================
// /api/cron-refresh-news.js
// -----------------------------------------------------------------------------
// Triggered automatically by Vercel Cron once per day (see vercel.json —
// Hobby plan limit). Warms the news cache in /api/news.js ahead of the
// first visit of the day. Ongoing freshness during the day comes from
// every visitor's browser polling /api/news every 15 minutes.
// =============================================================================

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const refreshRes = await fetch(`${baseUrl}/api/news?category=all`);
    const ok = refreshRes.ok;

    return res.status(200).json({
      refreshed: ok,
      target: "news",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
