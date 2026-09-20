import mongoose from "mongoose";

const gstinSchema = new mongoose.Schema(
  {
    gstin: { type: String, required: true, unique: true },
    tradeName: { type: String, required: true },
    legalName: String,
    stateCode: { type: String, required: true },
    state: { type: String, required: true },
    city: String,
    branch: String,
    invoiceSeries: { type: String, required: true, default: "INV" },
    isPrimary: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pan: String,
    fiscalYear: { type: String, default: "2025-26" },
    gstins: [gstinSchema],
    address: String,
    bankAccount: String,
    gstInNumber: String,
  },
  { timestamps: true }
);

companySchema.methods.primaryGstin = function () {
  return this.gstins.find((g) => g.isPrimary) || this.gstins[0];
};

export const Company = mongoose.model("Company", companySchema);