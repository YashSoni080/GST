import mongoose from "mongoose";

const partySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    gstin: { type: String, trim: true },
    isRegistered: { type: Boolean, default: true },
    gstType: {
      type: String,
      enum: ["registered", "unregistered", "composition", "SEZ", "export"],
      default: "registered",
    },
    stateCode: String,
    state: String,
    city: String,
    address: String,
    type: { type: String, enum: ["customer", "vendor", "both"], default: "customer" },
    email: String,
    phone: String,
    // Compliance / ITC risk model & Continuous Vendor Scoring (PRD Section 2.2)
    itcRiskScore: { type: Number, min: 0, max: 100, default: 0 },
    itcRiskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    complianceScore: { type: Number, min: 0, max: 100, default: 95 },
    complianceCategory: {
      type: String,
      enum: ["Consistent", "Delayed Filer", "Chronic Non-Filer"],
      default: "Consistent",
    },
    filingPunctualityRate: { type: Number, default: 95 },
    procurementAlert: { type: Boolean, default: false },
    riskSignals: [{ type: String }],
    riskLastComputed: Date,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

partySchema.index({ companyId: 1, gstin: 1 }, { unique: true, sparse: true });

export const Party = mongoose.model("Party", partySchema);