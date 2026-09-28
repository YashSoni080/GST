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
    if (typeof period === "string" && period) filter.period = period;
    if (typeof itcEligible === "string" && itcEligible) filter.itcEligible = itcEligible;
    if (typeof reconStatus === "string" && reconStatus) filter.reconStatus = reconStatus;
    const purchases = await Purchase.find(filter).sort({ billDate: -1 }).limit(200).lean();
    res.json({ purchases });
  } catch (err) { next(err); }
});

router.post("/", can("purchases:create"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const {
      vendorName,
      vendorGstin,
      vendorStateCode,
      billNo,
      billDate,
      taxableValue,
      cgst,
      sgst,
      igst,
      isRcm = false,
      rcmCategory = "none",
      itcEligible = "yes",
      itcEligibleAmount,
      section17_5Category = "none",
      paymentStatus = "unpaid",
      notes,
      items,
      period: customPeriod,
    } = req.body;

    if (!vendorName || !billNo || !billDate) {
      return res.status(422).json({ error: "Vendor name, bill number and date are required" });
    }
    const gst = (Number(cgst) || 0) + (Number(sgst) || 0) + (Number(igst) || 0);
    const total = (Number(taxableValue) || 0) + gst;
    const period = customPeriod || (billDate ? String(billDate).slice(0, 7) : new Date().toISOString().slice(0, 7));

    // Automated RCM Identification (Section 9(3) / 9(4))
    const cleanGstin = vendorGstin ? vendorGstin.trim().toUpperCase() : "";
    let finalIsRcm = Boolean(isRcm);
    let finalRcmCategory = rcmCategory || "none";

    // Auto-detect RCM if vendor is unregistered and tax is applicable, or specific category flagged
    if (!cleanGstin && (gst > 0 || finalIsRcm)) {
      finalIsRcm = true;
      if (finalRcmCategory === "none") finalRcmCategory = "unregistered_supplier";
    } else if (finalRcmCategory !== "none") {
      finalIsRcm = true;
    }

    let selfInvoiceNo = null;
    let selfInvoiceDate = null;
    let paymentVoucherNo = null;

    if (finalIsRcm) {
      const stamp = Date.now().toString().slice(-4);
      selfInvoiceNo = `SI-${period.replace("-", "")}-${stamp}`;
      selfInvoiceDate = new Date(billDate);
      paymentVoucherNo = `PV-${period.replace("-", "")}-${stamp}`;
    }

    // Determine eligible ITC amount (tax only, not total invoice value)
    let computedEligibleAmount = gst;
    if (itcEligible === "no" || (section17_5Category && section17_5Category !== "none")) {
      computedEligibleAmount = 0;
    } else if (itcEligible === "partial" && itcEligibleAmount !== undefined) {
      computedEligibleAmount = Math.min(gst, Math.max(0, Number(itcEligibleAmount) || 0));
    }

    const isBlocked = itcEligible === "no" || (section17_5Category && section17_5Category !== "none");
    const purchase = await Purchase.create({
      companyId: req.user.companyId,
      vendorName,
      vendorGstin: cleanGstin,
      vendorStateCode,
      billNo,
      billDate: new Date(billDate),
      period,
      taxableValue: Number(taxableValue) || 0,
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      igst: Number(igst) || 0,
      gst,
      total,
      items: Array.isArray(items) ? items : [],
      isRcm: finalIsRcm,
      rcmCategory: finalRcmCategory,
      selfInvoiceNo,
      selfInvoiceDate,
      paymentVoucherNo,
      itcEligible: isBlocked ? "no" : itcEligible,
      itcEligibleAmount: computedEligibleAmount,
      section17_5Category: section17_5Category || "none",
      paymentStatus: paymentStatus || "unpaid",
      notes: notes || "",
      reconStatus: "pending",
      createdBy: req.user._id,
    });
    await audit(req, "create", "purchase", purchase._id, { vendorName, billNo, total, isRcm: finalIsRcm });
    res.status(201).json(purchase);
  } catch (err) { next(err); }
});

router.get("/:id/self-invoice", can("purchases:read"), async (req, res, next) => {
  try {
    const { Purchase, Company } = req.app.locals.models;
    const purchase = await Purchase.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!purchase) return res.status(404).json({ error: "Purchase record not found" });
    if (!purchase.isRcm) return res.status(400).json({ error: "Purchase is not liable under Reverse Charge Mechanism" });
    const company = await Company.findById(req.user.companyId).lean();
    res.json({
      selfInvoiceNo: purchase.selfInvoiceNo,
      selfInvoiceDate: purchase.selfInvoiceDate,
      paymentVoucherNo: purchase.paymentVoucherNo,
      recipient: company,
      supplier: {
        name: purchase.vendorName,
        gstin: purchase.vendorGstin || "UNREGISTERED",
      },
      rcmCategory: purchase.rcmCategory,
      taxableValue: purchase.taxableValue,
      cgst: purchase.cgst,
      sgst: purchase.sgst,
      igst: purchase.igst,
      totalTax: purchase.gst,
      totalAmount: purchase.total,
      statutoryDeclaration: "Tax on reverse charge basis is payable by the recipient under Section 9(3) / 9(4) of the CGST Act, 2017.",
    });
  } catch (err) { next(err); }
});

export default router;
