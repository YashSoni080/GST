import mongoose from "mongoose";

const itcEntrySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    period: { type: String, required: true },
    type: {
      type: String,
      enum: ["availed", "utilized", "refund", "expired", "reversed"],
      required: true,
    },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    note: String,
    ref: { type: String, enum: ["GSTR3B", "Manual", "Reco", "Refund"], default: "Manual" },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const ITCEntry = mongoose.model("ITCEntry", itcEntrySchema);