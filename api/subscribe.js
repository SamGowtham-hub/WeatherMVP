// api/subscribe.js
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function (req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    // Vercel parses JSON body automatically
    const payload = req.body;
    const token = payload && payload.token;
    const tags = (payload && payload.tags) || [];

    if (!token) {
      return res.status(400).json({ error: "Push token required" });
    }

    try {
      await redis.sadd("push_tokens", token);
      await redis.hset(`push_meta:${token}`, {
        tags: JSON.stringify(tags),
        createdAt: Date.now(),
      });
    } catch (e) {
      console.error("Redis write error:", e && e.message ? e.message : e);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("subscribe handler error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
};
