// api/weather.js
const fetch = require("node-fetch");
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async function (req, res) {
  try {
    const lat = req.query.lat || req.query.latitude;
    const lon = req.query.lon || req.query.longitude;
    const units = req.query.units || "metric";

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat & lon are required" });
    }

    const cacheKey = `weather:${lat}:${lon}:${units}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.status(200).json(JSON.parse(cached));
    } catch (e) {
      console.error("Redis GET error:", e && e.message ? e.message : e);
    }

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: "temperature_2m,relativehumidity_2m,windspeed_10m",
      current_weather: "true",
      daily: "temperature_2m_max,temperature_2m_min,weathercode",
      timezone: "auto",
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("Upstream weather fetch failed", r.status, text);
      return res.status(502).json({ error: "Upstream weather API error", status: r.status });
    }

    const data = await r.json();

    try {
      await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });
    } catch (e) {
      console.error("Redis SET error:", e && e.message ? e.message : e);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("weather handler error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "internal_server_error", message: String(err) });
  }
};
