import mongoose from "mongoose";

const cropMediaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  crop: { type: mongoose.Schema.Types.ObjectId, ref: "Crop", required: true, index: true },
  filename: { type: String, required: true, maxlength: 200 },
  contentType: { type: String, required: true, maxlength: 120 },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("CropMedia", cropMediaSchema);
