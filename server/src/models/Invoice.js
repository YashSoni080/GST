import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    hsn: { type: String, required: true },
    hsnType: { type: String, enum: ["HSN", "SAC"], default: "HSN" },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "NOS" },
    rate: { type: Number, required: true, min: 0 },
    discountPct: { type: Number, default: 0 },
    gstRate: { type: Number, required: true, min: 0 },
    taxable: { type: Number, default: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    companyGstin: { type: String, required: true },
    gstinStateCode: String,
    gstinState: String,
    docType: {
      type: String,
      enum: [
        "invoice",
        "billOfSupply",
        "deliveryChallan",
        "creditNote",
        "debitNote",
      ],
      default: "invoice",
    },
    invNo: { type: String, required: true },
    series: { type: String, required: true },
    date: { type: Date, required: true },
    partyId: { type: mongoose.Types.ObjectId, ref: "Party" },
    partyName: { type: String, required: true },
    partyGstin: String,
    partyStateCode: String,
    partyState: String,
    placeOfSupply: { type: String, required: true },
    posStateCode: { type: String, required: true },
    posState: { type: String, required: true },
    supplyType: {
      type: String,
      enum: ["B2B", "B2C", "SEZ", "Export", "DeemedExport"],
      default: "B2B",
    },
    items: [itemSchema],
    taxableValue: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    utgst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "draft",
        "valid",
        "IRN_PENDING",
        "IRN_GENERATED",
        "EWB_GENERATED",
        "pushed",
        "cancelled",
      ],
      default: "draft",
    },
    irn: String,
    irnDate: Date,
    qrDataUrl: String,
    cancelledAt: Date,
    cancelDocNo: String,
    ewb: {
      no: String,
      genDate: Date,
      validTill: Date,
      distanceKm: Number,
      mode: { type: String, enum: ["road", "rail", "air", "ship"], default: "road" },
      vehicleNo: String,
      transporter: String,
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "extended"],
        default: "active",
      },
    },
    ewbBlock: { type: Boolean, default: false },
    ewbExempt: { type: Boolean, default: false },
    gstrFiled: { type: Boolean, default: false },
    gstrPeriod: String,
    notes: String,
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

invoiceSchema.index({ companyId: 1, series: 1, invNo: 1 }, { unique: true });
invoiceSchema.index({ companyId: 1, date: 1 });
invoiceSchema.index({ companyGstin: 1, posStateCode: 1 });

export const Invoice = mongoose.model("Invoice", invoiceSchema);