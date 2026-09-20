import mongoose from "mongoose";

const gstrSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    companyGstin: { type: String, required: true },
    period: { type: String, required: true }, // YYYY-MM
    type: { type: String, enum: ["GSTR1", "GSTR3B", "GSTR2B"], required: true },
    status: {
      type: String,
      enum: ["draft", "validated", "generated", "filed", "partially_filed"],
      default: "draft",
    },
    summary: Object,
    sections: Object,
    jsonPayload: Object,
    validationErrors: [String],
    arn: String, // acknowledgment reference number from (simulated) portal
    filedAt: Date,
    paidAt: Date,
    paymentChallan: String,
    filedBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

gstrSchema.index({ companyId: 1, companyGstin: 1, period: 1, type: 1 }, { unique: true });

export const GSTR = mongoose.model("GSTR", gstrSchema);