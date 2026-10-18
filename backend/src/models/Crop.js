import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true, maxlength: 12000 },
  imageAttached: { type: Boolean, default: false },
  attachments: [{
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "CropMedia" },
    filename: { type: String, maxlength: 200 },
    contentType: { type: String, maxlength: 120 }
  }],
  agentActions: [{
    tool: { type: String, maxlength: 80 },
    summary: { type: String, maxlength: 500 },
    succeeded: { type: Boolean, default: true }
  }],
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const observationSchema = new mongoose.Schema({
  kind: { type: String, enum: ["weather", "soil", "growth", "problem", "watering", "fertilizer", "expense", "income", "other"], default: "other" },
  description: { type: String, required: true, maxlength: 5000 },
  values: { type: mongoose.Schema.Types.Mixed, default: {} },
  source: { type: String, enum: ["farmer", "official_weather", "lab_test"], default: "farmer" },
  createdAt: { type: Date, default: Date.now }
});

const cropSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  variety: { type: String, default: "" },
  location: { type: String, default: "" },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  plantingDate: { type: Date },
  growthStage: { type: String, default: "Unknown" },
  soilType: { type: String, default: "" },
  soilPH: { type: Number, min: 0, max: 14 },
  soilDataSource: { type: String, enum: ["farmer", "lab_test"], default: "farmer" },
  irrigation: { type: String, default: "" },
  notes: { type: String, default: "" },
  messages: { type: [messageSchema], default: [] },
  observations: { type: [observationSchema], default: [] }
}, { timestamps: true });

export default mongoose.model("Crop", cropSchema);
