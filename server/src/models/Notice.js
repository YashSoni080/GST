import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: "Company", required: true },
    noticeNo: { type: String, required: true },
    type: {
      type: String,
      enum: ["ASMT-10", "DRC-01", "DRC-01A", "SCN", "REG-17", "GSTR-3A"],
      required: true,
    },
    section: { type: String, required: true }, // e.g. "Section 61", "Section 73", "Section 74"
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    financialYear: { type: String, required: true }, // e.g. "2025-26"
    period: String, // e.g. "2026-08"
    issuingAuthority: { type: String, default: "Deputy Commissioner of State Tax, Range II" },
    allegationType: {
      type: String,
      enum: [
        "GSTR1_VS_3B_TURNOVER",
        "ITC_3B_VS_2B_MISMATCH",
        "EWB_VS_GSTR1_DISCREPANCY",
        "SECTION_17_5_INELIGIBLE_CLAIM",
        "RULE_37_180_DAYS_NON_REVERSAL",
        "CANCELLED_SUPPLIER_ITC",
      ],
      required: true,
    },
    description: { type: String, required: true },
    demandAmount: {
      tax: { type: Number, default: 0 },
      interest: { type: Number, default: 0 },
      penalty: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    // Ticketing & Workflow Management (PRD Section 2.3)
    ticketId: { type: String },
    assignedTo: { type: mongoose.Types.ObjectId, ref: "User" },
    assignedToName: { type: String, default: "Tax Compliance Lead" },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    rawNoticeText: String,
    ingestionSource: {
      type: String,
      enum: ["manual", "portal_api", "pdf_ocr", "email_scrape"],
      default: "portal_api",
    },
    comments: [
      {
        author: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "under_review", "drafting", "replied", "adjudicated", "settled_drc03", "closed"],
      default: "pending",
    },
    aiDraftedReply: {
      subject: String,
      content: String,
      legalCitations: [String],
      annexuresAttached: [String],
      draftedAt: Date,
    },
    drc03Details: {
      arn: String,
      date: Date,
      amountPaid: Number,
      cause: String,
    },
    replySubmissionDate: Date,
  },
  { timestamps: true }
);

noticeSchema.index({ companyId: 1, noticeNo: 1 }, { unique: true });
noticeSchema.index({ companyId: 1, status: 1 });

export const Notice = mongoose.model("Notice", noticeSchema);
