import mongoose from "mongoose";

const reconRunSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    period: { type: String, required: true },
    runAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["running", "completed"], default: "running" },
    summary: {
      docsIn2b: Number,
      purchases: Number,
      matched: Number,
      mismatched: Number,
      missing: Number,
      extra: Number, // in 2B but not in purchase register
      itcInvolved: Number,
    },
    results: [
      {
        purchaseId: mongoose.Types.ObjectId,
        supplierGstin: String,
        supplierName: String,
        invoiceNo: String,
        period: String,
        taxable: Number,
        gst: Number,
        status: { type: String },

        _id: false,
      },
    ],
    ranBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

reconRunSchema.index({ companyId: 1, period: 1, runAt: -1 });

export const ReconRun = mongoose.model("ReconRun", reconRunSchema);