import { AuditLog } from "../models/AuditLog.js";

export async function audit(req, action, entity, entityId, details = {}) {
  try {
    await AuditLog.create({
      companyId: req.user?.companyId || null,
      user: req.user?._id || null,
      userEmail: req.user?.email || "system",
      role: req.user?.role || "system",
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      details,
      ip: req.ip,
      at: new Date(),
    });
  } catch (err) {
    // audit must never break the request flow
    console.error("audit write failed:", err.message);
  }
}