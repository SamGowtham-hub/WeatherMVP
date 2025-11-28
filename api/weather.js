// api/weather.js
const fetch = require("node-fetch");
const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  try {
    const lat = req.query.lat;
    const lon = req.query.lon;
    const units = req.query.units || "metric";

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat & lon required" });
    }

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current_weather: "true",
      timezone: "auto",
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    console.error("weather.js error:", err);
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
};
