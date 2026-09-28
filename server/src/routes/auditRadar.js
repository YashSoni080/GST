import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { computeDepartmentAuditRadar } from "../services/auditRadar.js";

const router = Router();
router.use(requireAuth);

// Section 4.5: Predictive Audit Radar & Anomaly Detection
router.get("/score", can("audit:read"), async (req, res, next) => {
  try {
    const { Invoice, Purchase, SupplierDoc, Party } = req.app.locals.models;
    const cid = req.user.companyId;

    const invoices = await Invoice.find({ companyId: cid }).lean();
    const purchases = await Purchase.find({ companyId: cid }).lean();
    const supplierDocs = await SupplierDoc.find({ companyId: cid }).lean();
    const parties = await Party.find({ companyId: cid }).lean();

    const radar = computeDepartmentAuditRadar({
      invoices,
      purchases,
      supplierDocs,
      parties,
    });

    res.json(radar);
  } catch (err) { next(err); }
});

export default router;
