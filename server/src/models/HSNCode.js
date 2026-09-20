import mongoose from "mongoose";

const hsnSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    type: { type: String, enum: ["goods", "service"], default: "goods" },
    scheme: { type: String, enum: ["HSN", "SAC"], default: "HSN" },
    rate: { type: Number, required: true, min: 0, max: 999 }, // GST %
    cgst: Number,
    sgst: Number,
    igst: Number,
    utgst: Number,
    reverseCharge: { type: Boolean, default: false },
    exempt: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const HSNCode = mongoose.model("HSNCode", hsnSchema);