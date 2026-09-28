import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    name: String,
    hsn: String,
    qty: { type: Number, default: 1 },
    rate: { type: Number, default: 0 },
    gstRate: { type: Number, default: 18 },
    taxable: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
  },
  { _id: false }
);

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
    items: [purchaseItemSchema],
    taxableValue: { type: Number, required: true, min: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    nature: { type: String, default: "purchase" },
    
    // Reverse Charge Mechanism (RCM - Section 9(3) / 9(4))
    isRcm: { type: Boolean, default: false },
    rcmCategory: {
      type: String,
      enum: [
        "none",
        "unregistered_supplier",
        "gta_transport",
        "legal_services",
        "security_services",
        "director_remuneration",
        "sponsorship",
        "import_of_services",
        "other_notified",
      ],
      default: "none",
    },
    selfInvoiceNo: String,
    selfInvoiceDate: Date,
    paymentVoucherNo: String,

    // Section 17(5) Blocked Credit
    itcEligible: { type: String, enum: ["yes", "no", "partial"], default: "yes" },
    itcEligibleAmount: { type: Number, default: 0 },
    blockedReason: String,
    section17_5Category: {
      type: String,
      enum: [
        "none",
        "motor_vehicles",
        "food_and_beverages",
        "club_membership_health",
        "personal_consumption",
        "goods_lost_stolen_destroyed",
        "works_contract_immovable",
      ],
      default: "none",
    },

    // 180-Day Rule 37 Payment Tracking
    paymentStatus: {
      type: String,
      enum: ["paid", "partially_paid", "unpaid"],
      default: "unpaid",
    },
    paidAmount: { type: Number, default: 0 },
    paymentDate: Date,
    paymentDueDate: Date, // usually billDate + 180 days
    rule37Flag: { type: Boolean, default: false },
    rule37ReversalAmount: { type: Number, default: 0 },
    rule37Interest: { type: Number, default: 0 },

    // GSTR-2B reconciliation linkage
    reconStatus: {
      type: String,
      enum: ["pending", "matched", "approximate", "mismatch", "missing", "ims_pending"],
      default: "pending",
    },
    matchedDocId: mongoose.Types.ObjectId,
    matchedOn: Date,
    disputeStatus: {
      type: String,
      enum: ["none", "discrepancy_sent", "vendor_acknowledged", "resolved"],
      default: "none",
    },
    lastAlertSentAt: Date,

    // Smart Escrow Split-Payment status
    escrowStatus: {
      type: String,
      enum: ["not_applicable", "held_in_escrow", "released", "disputed"],
      default: "not_applicable",
    },

    notes: String,
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseSchema.index({ companyId: 1, vendorGstin: 1, billNo: 1 }, { unique: true });
purchaseSchema.index({ companyId: 1, period: 1 });
purchaseSchema.index({ companyId: 1, paymentStatus: 1 });

export const Purchase = mongoose.model("Purchase", purchaseSchema);