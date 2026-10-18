import { Router } from "express";
import Crop from "../models/Crop.js";
import CropRecommendation from "../models/CropRecommendation.js";
import User from "../models/User.js";
import CropMedia from "../models/CropMedia.js";
import { requireAuth } from "../middleware/auth.js";
import { createAiClient, getAiModel } from "../services/aiClient.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const crops = await Crop.find({ user: req.userId }).sort({ updatedAt: -1 });
    res.json({ crops });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, variety, location, latitude, longitude, plantingDate, growthStage, soilType, soilPH, soilDataSource, irrigation, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Crop name is required." });
    const crop = await Crop.create({
      user: req.userId, name: name.trim(), variety, location,
      latitude: latitude === "" || latitude == null ? undefined : Number(latitude),
      longitude: longitude === "" || longitude == null ? undefined : Number(longitude),
      plantingDate: plantingDate || undefined, growthStage, soilType,
      soilPH: soilPH === "" || soilPH == null ? undefined : Number(soilPH),
      soilDataSource: soilDataSource === "lab_test" ? "lab_test" : "farmer",
      irrigation, notes
    });
    res.status(201).json({ crop });
  } catch (error) { next(error); }
});

router.get("/recommendations", async (req, res, next) => {
  try {
    const recommendations = await CropRecommendation.find({ user: req.userId })
      .sort({ createdAt: -1 }).limit(20).select("question answer basedOn createdAt");
    res.json({ recommendations });
  } catch (error) { next(error); }
});

router.post("/recommendations", async (req, res, next) => {
  try {
    const openai = createAiClient();
    const user = await User.findById(req.userId).select("language farmLocation landSize irrigation latitude longitude");
    if (!user) return res.status(404).json({ message: "Account not found." });
    const crops = await Crop.find({ user: req.userId }).sort({ updatedAt: -1 }).limit(20)
      .select("name variety location plantingDate growthStage soilType soilPH soilDataSource irrigation latitude longitude observations");
    const coordinates = user.latitude != null && user.longitude != null
      ? { latitude: user.latitude, longitude: user.longitude }
      : crops.find(crop => crop.latitude != null && crop.longitude != null);
    let forecast = null;
    if (coordinates) {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(coordinates.latitude), longitude: String(coordinates.longitude),
        daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        timezone: "auto", forecast_days: "7"
      }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Weather service is unavailable for this crop recommendation.");
      const data = await response.json();
      forecast = { daily: data.daily, source: "Open-Meteo forecast", timezone: data.timezone };
    }
    const recentObservations = crops.flatMap(crop =>
      crop.observations.slice(-5).map(observation => ({
        crop: crop.name, kind: observation.kind, source: observation.source,
        description: observation.description, values: observation.values, createdAt: observation.createdAt
      }))
    ).slice(-20);
    const prompt = `Compare practical crop options for this farmer using only the supplied facts and the farm's stated location. Use the farmer's language (${{ en: "English", si: "Sinhala", ta: "Tamil" }[user.language]}) and simple terms. Do not assume a country, climate, season, or local agricultural practices when location details are missing. Explain suitability and trade-offs, include duration/cost/market only when reliable from supplied facts, never invent local prices or guaranteed yields, and state uncertainty. Ask a short follow-up if key information is missing. Separate observed/lab/weather sources and call recommendations provisional when evidence is incomplete.

Farmer profile: ${JSON.stringify({
      farmLocation: user.farmLocation, latitude: user.latitude, longitude: user.longitude, landSize: user.landSize,
      irrigation: user.irrigation, knownCrops: crops.map(crop => ({
        name: crop.name, location: crop.location, soilType: crop.soilType, soilPH: crop.soilPH,
        soilDataSource: crop.soilDataSource,
        irrigation: crop.irrigation, recentObservations: crop.observations.slice(-3)
      }))
    })}
Forecast (official forecast, not a field measurement): ${JSON.stringify(forecast)}
Recent farmer/lab/weather records: ${JSON.stringify(recentObservations)}
Farmer's question or extra details: ${(req.body.question || "").toString().slice(0, 3000) || "What crops could suit my land?"}`;
    const completion = await openai.chat.completions.create({
      model: getAiModel(),
      messages: [
        { role: "system", content: "You are AGRO, a friendly, cautious crop-planning assistant for farmers worldwide. Give a concise user-facing answer and do not expose internal reasoning. Adapt suggestions to the supplied farm location when possible; do not assume a country or local climate when it is unknown." },
        { role: "user", content: prompt }
      ],
      max_tokens: 900
    });
    const answer = completion.choices[0]?.message?.content;
    if (!answer) throw new Error("The AI service returned an empty crop recommendation.");
    const basedOn = { profile: true, cropHistory: crops.length > 0, forecast: Boolean(forecast) };
    const saved = await CropRecommendation.create({
      user: req.userId, question: (req.body.question || "").toString().slice(0, 3000), answer, basedOn
    });
    res.json({ answer, forecast, basedOn, recommendationId: saved._id });
  } catch (error) { next(error); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const crop = await Crop.findOne({ _id: req.params.id, user: req.userId });
    if (!crop) return res.status(404).json({ message: "Crop not found." });
    res.json({ crop });
  } catch (error) { next(error); }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const allowed = ["variety","location","latitude","longitude","plantingDate","growthStage","soilType","soilPH","soilDataSource","irrigation","notes"];
    const update = {};
    for (const key of allowed) if (key in req.body) update[key] = req.body[key];
    const crop = await Crop.findOneAndUpdate({ _id: req.params.id, user: req.userId }, update, { new: true, runValidators: true });
    if (!crop) return res.status(404).json({ message: "Crop not found." });
    res.json({ crop });
  } catch (error) { next(error); }
});

router.post("/:id/observations", async (req, res, next) => {
  try {
    const { kind = "other", description, values = {}, source = "farmer" } = req.body;
    if (!description?.trim()) return res.status(400).json({ message: "Please describe the observation." });
    if (!["farmer", "official_weather", "lab_test"].includes(source)) {
      return res.status(400).json({ message: "Choose a farmer observation, official weather, or lab result." });
    }
    const crop = await Crop.findOne({ _id: req.params.id, user: req.userId });
    if (!crop) return res.status(404).json({ message: "Crop not found." });
    crop.observations.push({ kind, description: description.trim(), values, source });
    await crop.save();
    res.status(201).json({ observations: crop.observations });
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const crop = await Crop.findOne({ _id: req.params.id, user: req.userId }).select("_id");
    if (!crop) return res.status(404).json({ message: "Crop not found." });
    await CropMedia.deleteMany({ crop: crop._id, user: req.userId });
    const result = await Crop.deleteOne({ _id: req.params.id, user: req.userId });
    if (!result.deletedCount) return res.status(404).json({ message: "Crop not found." });
    res.json({ message: "Crop and its stored history deleted." });
  } catch (error) { next(error); }
});

export default router;
