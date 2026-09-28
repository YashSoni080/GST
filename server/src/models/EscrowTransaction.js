import mongoose from "mongoose";

const escrowTransactionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    purchaseId: { type: mongoose.Types.ObjectId, ref: "Purchase" },
    vendorId: { type: mongoose.Types.ObjectId, ref: "Party" },
    vendorName: { type: String, required: true },
    vendorGstin: { type: String, required: true },
    billNo: { type: String, required: true },
    billDate: { type: Date, required: true },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    totalInvoiceAmount: { type: Number, required: true },
    // Split payment parameters
    baseAmountStatus: {
      type: String,
      enum: ["paid_to_vendor", "pending", "hold"],
      default: "paid_to_vendor",
    },
    baseAmountPaidAt: Date,
    escrowGstStatus: {
      type: String,
      enum: ["held_in_escrow", "released_to_vendor", "clawed_back", "disputed"],
      default: "held_in_escrow",
    },
    escrowReleasedAt: Date,
    escrowAccountRef: { type: String, default: "ESCROW-HDFC-99214-GST" },
    reconciliationProof: {
      gstr2bPeriod: String,
      filingDate: Date,
      matchedDocRef: String,
    },
    disputeReason: String,
  },
  { timestamps: true }
);

escrowTransactionSchema.index({ companyId: 1, billNo: 1, vendorGstin: 1 });
escrowTransactionSchema.index({ companyId: 1, escrowGstStatus: 1 });

export const EscrowTransaction = mongoose.model("EscrowTransaction", escrowTransactionSchema);
