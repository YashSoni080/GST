import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    companyId: mongoose.Types.ObjectId,
    user: mongoose.Types.ObjectId,
    userEmail: String,
    role: String,
    action: String,
    entity: String,
    entityId: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditSchema.index({ companyId: 1, at: -1 });
auditSchema.index({ userEmail: 1 });

export const AuditLog = mongoose.model("AuditLog", auditSchema);