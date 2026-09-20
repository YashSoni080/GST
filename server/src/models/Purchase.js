import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    vendorId: { type: mongoose.Types.ObjectId, ref: "Party" },
    vendorName: { type: String, required: true },
    vendorGstin: String,
    vendorStateCode: String,
    billNo: { type: String, required: true },
    billDate: { type: Date, required: true },
    period: { type: String, required: true }, // YYYY-MM of supply
    taxableValue: { type: Number, required: true, min: 0 },
    cgst: Number,
    sgst: Number,
    igst: Number,
    gst: Number,
    total: Number,
    nature: { type: String, default: "purchase" },
    blockedReason: String,
    itcEligible: { type: String, enum: ["yes", "no", "partial"], default: "yes" },
    itcEligibleAmount: { type: Number, default: 0 },
    // GSTR-2B reconciliation linkage
    reconStatus: {
      type: String,
      enum: ["pending", "matched", "mismatch", "missing", "ims_pending"],
      default: "pending",
    },
    matchedDocId: mongoose.Types.ObjectId,
    matchedOn: Date,
    notes: String,
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseSchema.index({ companyId: 1, vendorGstin: 1, billNo: 1 }, { unique: true });

export const Purchase = mongoose.model("Purchase", purchaseSchema);