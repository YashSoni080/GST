import mongoose from "mongoose";

const orderLineSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    orderDate: Date,
    channel: { type: String, default: "amazon" },
    state: String,
    posStateCode: String,
    supplyType: { type: String, enum: ["B2C", "B2B"], default: "B2C" },
    customerGstin: String,
    itemDescription: String,
    hsn: String,
    qty: { type: Number, default: 1 },
    grossAmount: { type: Number, default: 0 },
    taxable: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    isReturn: { type: Boolean, default: false },
    tcsAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const ecommerceSettlementSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    channel: {
      type: String,
      enum: ["amazon", "flipkart", "meesho", "blinkit", "zepto", "custom"],
      required: true,
    },
    settlementPeriod: { type: String, required: true }, // e.g. "2026-09"
    reportName: { type: String, default: "Marketplace Settlement Report" },
    totalOrders: { type: Number, default: 0 },
    grossSales: { type: Number, default: 0 },
    netTaxableTurnover: { type: Number, default: 0 },
    
    b2cSales: {
      count: { type: Number, default: 0 },
      taxable: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },
    b2bSales: {
      count: { type: Number, default: 0 },
      taxable: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },
    returns: {
      count: { type: Number, default: 0 },
      taxable: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },

    tcsCollected: {
      ratePct: { type: Number, default: 1.0 }, // Statutory 1% TCS under Section 52
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    gstr8Reconciliation: {
      gstr8ReportedTcs: { type: Number, default: 0 },
      variance: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["matched", "minor_variance", "critical_mismatch", "pending_sync"],
        default: "matched",
      },
      lastSyncedAt: Date,
    },

    stateWiseDistribution: [
      {
        stateCode: String,
        stateName: String,
        taxable: Number,
        igst: Number,
        cgst: Number,
        sgst: Number,
        tcs: Number,
      },
    ],

    lineItems: [orderLineSchema],
    ingestedBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ecommerceSettlementSchema.index({ companyId: 1, channel: 1, settlementPeriod: 1 });

export const EcommerceSettlement = mongoose.model("EcommerceSettlement", ecommerceSettlementSchema);
