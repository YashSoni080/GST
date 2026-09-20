import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("purchases:read"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const { period, itcEligible, reconStatus } = req.query;
    const filter = { companyId: req.user.companyId };
    if (period) filter.period = period;
    if (itcEligible) filter.itcEligible = itcEligible;
    if (reconStatus) filter.reconStatus = reconStatus;
    const purchases = await Purchase.find(filter).sort({ billDate: -1 }).limit(200).lean();
    res.json({ purchases });
  } catch (err) { next(err); }
});

router.post("/", can("purchases:create"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const { vendorName, vendorGstin, billNo, billDate, taxableValue, cgst, sgst, igst } = req.body;
    if (!vendorName || !billNo || !billDate) {
      return res.status(422).json({ error: "Vendor name, bill number and date are required" });
    }
    const gst = (Number(cgst) || 0) + (Number(sgst) || 0) + (Number(igst) || 0);
    const total = (Number(taxableValue) || 0) + gst;
    const period = billDate ? billDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
    const purchase = await Purchase.create({
      companyId: req.user.companyId,
      vendorName, vendorGstin, billNo,
      billDate: new Date(billDate), period,
      taxableValue: Number(taxableValue) || 0,
      cgst: Number(cgst) || 0, sgst: Number(sgst) || 0,
      igst: Number(igst) || 0, gst, total,
      itcEligible: "yes", itcEligibleAmount: total,
      reconStatus: "pending",
      createdBy: req.user._id,
    });
    await audit(req, "create", "purchase", purchase._id, { vendorName, billNo, total });
    res.status(201).json(purchase);
  } catch (err) { next(err); }
});

export default router;
