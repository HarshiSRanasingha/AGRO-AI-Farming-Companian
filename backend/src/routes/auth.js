import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function issueToken(user) {
  return jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function publicUser(user) {
  return {
    id: user._id, name: user.name, email: user.email, language: user.language,
    farmLocation: user.farmLocation,
    landSize: user.landSize, irrigation: user.irrigation,
    latitude: user.latitude, longitude: user.longitude
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, language } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 8) return res.status(400).json({ message: "Use a password with at least 8 characters." });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email, passwordHash, language: ["en","si","ta"].includes(language) ? language : "en" });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ message: "Email or password is incorrect." });
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("name email language farmLocation landSize irrigation latitude longitude");
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const allowed = ["name", "language", "farmLocation", "landSize", "irrigation", "latitude", "longitude"];
    const update = {};
    const unset = {};
    for (const key of allowed) {
      if (!(key in req.body)) continue;
      update[key] = req.body[key];
    }
    for (const key of ["name", "farmLocation", "irrigation"]) {
      if (update[key] !== undefined && typeof update[key] !== "string") {
        return res.status(400).json({ message: `${key} must be text.` });
      }
    }
    if (update.name !== undefined) {
      update.name = update.name.trim();
      if (!update.name) return res.status(400).json({ message: "Name cannot be empty." });
    }
    if (update.language !== undefined && !["en", "si", "ta"].includes(update.language)) {
      return res.status(400).json({ message: "Choose English, Sinhala, or Tamil." });
    }
    if (update.landSize !== undefined) {
      if (update.landSize === "" || update.landSize === null) {
        unset.landSize = 1;
        delete update.landSize;
      } else update.landSize = Number(update.landSize);
      if (update.landSize !== undefined && (!Number.isFinite(update.landSize) || update.landSize < 0)) {
        return res.status(400).json({ message: "Land size must be a non-negative number." });
      }
    }
    for (const key of ["latitude", "longitude"]) {
      if (update[key] === undefined) continue;
      if (update[key] === "" || update[key] === null) {
        unset[key] = 1;
        delete update[key];
        continue;
      }
      update[key] = Number(update[key]);
      const min = key === "latitude" ? -90 : -180;
      const max = key === "latitude" ? 90 : 180;
      if (update[key] !== undefined && (!Number.isFinite(update[key]) || update[key] < min || update[key] > max)) {
        return res.status(400).json({ message: `${key} must be between ${min} and ${max}.` });
      }
    }
    const user = await User.findByIdAndUpdate(req.userId, {
      ...update,
      ...(Object.keys(unset).length ? { $unset: unset } : {})
    }, { new: true, runValidators: true })
      .select("name email language farmLocation landSize irrigation latitude longitude");
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

export default router;
