// api/trigger-alert.js
const fetch = require("node-fetch");
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const FCM_KEY = process.env.FCM_SERVER_KEY; // optional, may be empty

module.exports = async function (req, res) {
  try {
    if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const body = req.body || (req._body ? req._body : undefined);
    const payload = typeof body === "string" ? JSON.parse(body) : body;
    const title = payload && payload.title ? payload.title : "Alert";
    const message = payload && payload.body ? payload.body : "";

    const tokens = await redis.smembers("push_tokens");
    if (!tokens || tokens.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no_tokens" });
    }

    if (!FCM_KEY) {
      // If no FCM key, return ok but indicate nothing was sent
      return res.status(200).json({ ok: true, sent: 0, reason: "no_fcm_key" });
    }

    // send in chunks
    const chunkSize = 500;
    let sent = 0;
    const results = [];
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const payloadBody = {
        registration_ids: chunk,
        notification: { title, body: message },
        priority: "high",
      };

      const r = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${FCM_KEY}`,
        },
        body: JSON.stringify(payloadBody),
      });

      const resJson = await r.json().catch(() => ({ status: r.status }));
      results.push(resJson);
      if (r.ok) sent += chunk.length;
    }

    return res.status(200).json({ ok: true, sent, results });
  } catch (err) {
    console.error("trigger-alert error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "internal_server_error" });
  }
};
