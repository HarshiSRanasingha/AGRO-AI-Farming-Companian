import { Router } from "express";
import Crop from "../models/Crop.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "Provide valid latitude and longitude." });
    }
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "5"
    }).toString();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yearAgo = new Date(yesterday);
    yearAgo.setUTCDate(yearAgo.getUTCDate() - 364);
    const dateString = date => date.toISOString().slice(0, 10);
    const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
    archiveUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      start_date: dateString(yearAgo),
      end_date: dateString(yesterday),
      daily: "temperature_2m_mean,precipitation_sum",
      timezone: "auto"
    }).toString();
    const [forecastResponse, archiveResponse] = await Promise.all([fetch(url), fetch(archiveUrl)]);
    if (!forecastResponse.ok) throw new Error("Weather service is unavailable right now.");
    if (!archiveResponse.ok) throw new Error("Historical climate data is unavailable right now.");
    const [forecast, climate] = await Promise.all([forecastResponse.json(), archiveResponse.json()]);
    if (req.query.cropId) {
      const crop = await Crop.findOne({ _id: req.query.cropId, user: req.userId });
      if (!crop) return res.status(404).json({ message: "Crop not found." });
      crop.observations.push({
        kind: "weather", source: "official_weather",
        description: "Current conditions and forecast retrieved from Open-Meteo, not measured at the field.",
        values: {
          temperature: forecast.current?.temperature_2m,
          humidity: forecast.current?.relative_humidity_2m,
          rainfall: forecast.current?.precipitation,
          forecastDays: forecast.daily?.time?.length
        }
      });
      await crop.save();
    }
    res.json({
      ...forecast,
      climate: {
        source: "Open-Meteo historical archive",
        period: { start: dateString(yearAgo), end: dateString(yesterday) },
        daily: climate.daily
      }
    });
  } catch (error) { next(error); }
});

export default router;
