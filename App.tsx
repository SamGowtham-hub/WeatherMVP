import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, ActivityIndicator, Button, TouchableOpacity, Platform } from "react-native";
import * as Location from "expo-location";

// Simple types
type WeatherNow = {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode?: number;
  time: string;
};

type Daily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weathercode?: number[];
};

export default function App(): JSX.Element {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherNow, setWeatherNow] = useState<WeatherNow | null>(null);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [unitsC, setUnitsC] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission denied. Please allow location access and restart the app.");
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const lat = Number(loc.coords.latitude.toFixed(4));
        const lon = Number(loc.coords.longitude.toFixed(4));
        setLocation({ lat, lon });
        await fetchWeather(lat, lon);
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchWeather = async (lat: number, lon: number) => {
    // Open-Meteo API (no API key)
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: "temperature_2m,relativehumidity_2m,windspeed_10m",
      current_weather: "true",
      daily: "temperature_2m_max,temperature_2m_min,weathercode",
      timezone: "auto",
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const resp = await fetch(url, { headers: { "User-Agent": "WeatherMVP/1.0 (example)" } });
    if (!resp.ok) throw new Error(`Weather API error: ${resp.status}`);
    const data = await resp.json();

    if (data.current_weather) {
      setWeatherNow({
        temperature: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        winddirection: data.current_weather.winddirection,
        weathercode: data.current_weather.weathercode,
        time: data.current_weather.time,
      });
    }
    if (data.daily) {
      setDaily({
        time: data.daily.time,
        temperature_2m_max: data.daily.temperature_2m_max,
        temperature_2m_min: data.daily.temperature_2m_min,
        weathercode: data.daily.weathercode,
      });
    }
  };

  const reload = async () => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      await fetchWeather(location.lat, location.lon);
    } catch (e: any) {
      setError(e.message ?? "Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  const formatTemp = (t: number) => {
    if (unitsC) return `${Math.round(t)}°C`;
    return `${Math.round((t * 9) / 5 + 32)}°F`;
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      // short local format e.g. "Nov 28, 21:05"
      return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading weather…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red", marginBottom: 12 }}>{error}</Text>
        <Button title="Try again" onPress={reload} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WeatherMVP</Text>
        <TouchableOpacity onPress={() => setUnitsC(!unitsC)} style={styles.unitBtn}>
          <Text>{unitsC ? "°C" : "°F"}</Text>
        </TouchableOpacity>
      </View>

      {weatherNow && (
        <View style={styles.nowCard}>
          <Text style={styles.bigTemp}>{formatTemp(weatherNow.temperature)}</Text>
          <Text style={styles.small}>Wind: {Math.round(weatherNow.windspeed)} km/h</Text>
          <Text style={styles.small}>Updated: {formatTime(weatherNow.time)}</Text>
        </View>
      )}

      <View style={styles.forecast}>
        <Text style={styles.sectionTitle}>3-day forecast</Text>
        {daily &&
          daily.time.slice(0, 3).map((t, i) => (
            <View key={t} style={styles.dayRow}>
              <Text style={{ width: 140 }}>{new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Text>
              <Text>
                {formatTemp(daily.temperature_2m_min[i])} / {formatTemp(daily.temperature_2m_max[i])}
              </Text>
            </View>
          ))}
      </View>

      <View style={{ marginTop: 20 }}>
        <Button title="Refresh" onPress={reload} />
      </View>

      <View style={{ height: Platform.OS === "ios" ? 36 : 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, paddingTop: 48, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  unitBtn: { padding: 8, borderWidth: 1, borderRadius: 8 },
  nowCard: { marginTop: 18, padding: 18, borderRadius: 12, backgroundColor: "#f0f0f0" },
  bigTemp: { fontSize: 48, fontWeight: "700" },
  small: { fontSize: 14, color: "#333" },
  forecast: { marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#ddd" },
});
