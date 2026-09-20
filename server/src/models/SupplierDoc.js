import mongoose from "mongoose";

// A document that appears on the supplier side of GSTN (GSTR-2B / IMS).
// Acts as the single source for both Reconciliation and the IMS action panel.
const supplierDocSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    period: { type: String, required: true }, // YYYY-MM as per law
    docDate: { type: Date, required: true },
    supplierGstin: { type: String, required: true },
    supplierName: { type: String },
    invoiceNo: { type: String, required: true },
    docType: {
      type: String,
      enum: ["invoice", "creditNote", "debitNote", "billOfSupply"],
      default: "invoice",
    },
    taxableValue: { type: Number, required: true },
    cgst: Number,
    sgst: Number,
    igst: Number,
    cess: Number,
    gst: Number,
    placeOfSupply: String,
    irn: String,
    // IMS state
    imsState: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    imsActionDate: Date,
    rejectedReason: String,
    source: { type: String, enum: ["gstr2b", "ims"], default: "gstr2b" },
  },
  { timestamps: true }
);

supplierDocSchema.index(
  { companyId: 1, period: 1, supplierGstin: 1, invoiceNo: 1, docType: 1 },
  { unique: true }
);

export const SupplierDoc = mongoose.model("SupplierDoc", supplierDocSchema);