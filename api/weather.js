// api/weather.js (robust: use global fetch if present, fallback to node-fetch)
let fetchFn = null;
try {
  // prefer global fetch (Node 18+ / environment-provided)
  if (typeof globalThis.fetch === "function") {
    fetchFn = globalThis.fetch.bind(globalThis);
  } else {
    // eslint-disable-next-line global-require
    fetchFn = require("node-fetch");
  }
} catch (e) {
  // fallback: try require (if installed)
  try {
    // eslint-disable-next-line global-require
    fetchFn = require("node-fetch");
  } catch (err) {
    console.error("No fetch available:", err);
    fetchFn = null;
  }
}

module.exports = async (req, res) => {
  try {
    if (!fetchFn) {
      return res.status(500).json({ error: "no_fetch_available" });
    }

    const lat = req.query.lat || req.query.latitude;
    const lon = req.query.lon || req.query.longitude;
    if (!lat || !lon) {
      return res.status(400).json({ error: "lat & lon required" });
    }

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current_weather: "true",
      timezone: "auto",
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const r = await fetchFn(url);
    if (!r.ok) {
      const txt = await (r.text ? r.text() : Promise.resolve(""));
      console.error("Upstream fetch failed", r.status, txt);
      return res.status(502).json({ error: "upstream_error", status: r.status, body: txt });
    }
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("weather handler error:", err && (err.stack || err));
    return res.status(500).json({ error: "server_error", details: String(err) });
  }
};
