import mongoose from "mongoose";

const reconResultItemSchema = new mongoose.Schema(
  {
    purchaseId: mongoose.Types.ObjectId,
    supplierDocId: mongoose.Types.ObjectId,
    supplierGstin: String,
    supplierName: String,
    invoiceNo: String,
    invoiceDate: Date,
    period: String,
    taxable: Number,
    gst: Number,
    docTaxable: Number,
    docGst: Number,
    status: {
      type: String,
      enum: ["matched", "approximate", "mismatch", "missing", "extra"],
    },
    matchScore: { type: Number, default: 0 },
    variance: {
      taxableDiff: { type: Number, default: 0 },
      gstDiff: { type: Number, default: 0 },
      posDiff: String,
      dateDiffDays: Number,
    },
    action: {
      type: String,
      enum: ["pending", "accepted", "rejected", "on_hold", "provisional_claim"],
      default: "pending",
    },
    actionNote: String,
    actionDate: Date,
    disputeAlertSent: { type: Boolean, default: false },
    disputeAlertDate: Date,
  },
  { _id: true }
);

const reconRunSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    period: { type: String, required: true },
    runAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["running", "completed"], default: "running" },
    summary: {
      docsIn2b: { type: Number, default: 0 },
      purchases: { type: Number, default: 0 },
      matched: { type: Number, default: 0 },
      approximate: { type: Number, default: 0 },
      mismatched: { type: Number, default: 0 },
      missing: { type: Number, default: 0 },
      extra: { type: Number, default: 0 }, // in 2B but not in purchase register
      itcInvolved: { type: Number, default: 0 },
      itcEligibleClaimed: { type: Number, default: 0 },
      itcAtRisk: { type: Number, default: 0 },
    },
    results: [reconResultItemSchema],
    ranBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

reconRunSchema.index({ companyId: 1, period: 1, runAt: -1 });

export const ReconRun = mongoose.model("ReconRun", reconRunSchema);