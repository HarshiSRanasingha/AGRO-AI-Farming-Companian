import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  language: { type: String, enum: ["en", "si", "ta"], default: "en" },
  farmLocation: { type: String, default: "", maxlength: 500 },
  landSize: { type: Number, min: 0 },
  irrigation: { type: String, default: "", maxlength: 120 },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
