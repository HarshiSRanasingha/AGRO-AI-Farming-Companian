import mongoose from "mongoose";

const cropRecommendationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  question: { type: String, default: "", maxlength: 3000 },
  answer: { type: String, required: true, maxlength: 12000 },
  basedOn: {
    profile: { type: Boolean, default: true },
    cropHistory: { type: Boolean, default: false },
    forecast: { type: Boolean, default: false }
  }
}, { timestamps: true });

export default mongoose.model("CropRecommendation", cropRecommendationSchema);
