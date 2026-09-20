import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("recon:read"), async (req, res, next) => {
  try {
    const { ReconRun } = req.app.locals.models;
    const { period } = req.query;
    const filter = { companyId: req.user.companyId };
    if (period) filter.period = period;
    const runs = await ReconRun.find(filter).sort({ runAt: -1 }).limit(20).lean();
    res.json({ runs });
  } catch (err) { next(err); }
});

router.post("/", can("recon:run"), async (req, res, next) => {
  try {
    const { ReconRun, Purchase, SupplierDoc } = req.app.locals.models;
    const { period } = req.body;
    if (!period) return res.status(422).json({ error: "Period is required" });

    const purchases = await Purchase.find({ companyId: req.user.companyId, period }).lean();
    const docs = await SupplierDoc.find({ companyId: req.user.companyId, period }).lean();

    let matched = 0, mismatched = 0, missing = 0, extra = 0;
    const results = [];

    for (const p of purchases) {
      const doc = docs.find(d =>
        d.supplierGstin === p.vendorGstin && d.invoiceNo === p.billNo
      );
      if (doc) {
        const taxMatch = Math.abs((doc.taxableValue || 0) - (p.taxableValue || 0)) < 1;
        const status = taxMatch ? "matched" : "mismatch";
        if (status === "matched") matched++; else mismatched++;
        results.push({
          purchaseId: p._id, supplierGstin: p.vendorGstin,
          supplierName: p.vendorName, invoiceNo: p.billNo,
          period: p.period, taxable: p.taxableValue, gst: p.gst, status,
        });
      } else {
        missing++;
        results.push({
          purchaseId: p._id, supplierGstin: p.vendorGstin,
          supplierName: p.vendorName, invoiceNo: p.billNo,
          period: p.period, taxable: p.taxableValue, gst: p.gst, status: "missing",
        });
      }
    }

    for (const d of docs) {
      if (!purchases.find(p => p.vendorGstin === d.supplierGstin && p.billNo === d.invoiceNo)) {
        extra++;
        results.push({
          supplierGstin: d.supplierGstin, supplierName: d.supplierName,
          invoiceNo: d.invoiceNo, period: d.period,
          taxable: d.taxableValue, gst: d.gst, status: "extra",
        });
      }
    }

    const run = await ReconRun.create({
      companyId: req.user.companyId, period, status: "completed",
      summary: { docsIn2b: docs.length, purchases: purchases.length, matched, mismatched, missing, extra, itcInvolved: 0 },
      results, ranBy: req.user._id,
    });
    await audit(req, "run", "recon", run._id, { period, matched, mismatched, missing, extra });
    res.status(201).json(run);
  } catch (err) { next(err); }
});

export default router;
