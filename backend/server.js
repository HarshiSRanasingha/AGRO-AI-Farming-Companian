import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import authRoutes from "./src/routes/auth.js";
import cropRoutes from "./src/routes/crops.js";
import chatRoutes from "./src/routes/chat.js";
import weatherRoutes from "./src/routes/weather.js";

dotenv.config();
const app = express();
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin: clientOrigins }));
app.use(express.json({ limit: "2mb" }));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "AGRO API" }));
app.use("/api/auth", authRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/weather", weatherRoutes);

app.use((err, _req, res, _next) => {
  if (process.env.AI_PROVIDER === "ollama" &&
      (err.name === "APIConnectionError" || err.cause?.code === "ECONNREFUSED")) {
    console.error("Local AI request failed: Ollama is not reachable.");
    return res.status(503).json({
      message: "AGRO cannot reach Ollama. Start Ollama and make sure the configured model is installed."
    });
  }
  if (process.env.AI_PROVIDER === "ollama" && err.status === 404) {
    console.error("Local AI request failed: the configured Ollama model or endpoint was not found.");
    return res.status(503).json({
      message: "The configured local AI model was not found. Run `ollama pull` for the model set in AI_MODEL, then restart AGRO."
    });
  }
  const hasNoAiCredits = err.status === 429 && (
    err.code === "insufficient_quota" ||
    /no credits remaining|insufficient_quota|exceeded your current quota/i.test(err.message || "")
  );
  if (hasNoAiCredits) {
    console.error("OpenAI request rejected: the configured API account has no credits remaining.");
    return res.status(503).json({
      message: "AGRO's OpenAI account has no API credits remaining. Add API credits or use a key with available quota, then try again."
    });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Unexpected server error" });
});

const port = process.env.PORT || 5000;
try {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Configure backend/.env");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes("replace-this")) {
    throw new Error("JWT_SECRET must be a private random value of at least 32 characters. Configure backend/.env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  app.listen(port, () => console.log(`AGRO API running at http://localhost:${port}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
