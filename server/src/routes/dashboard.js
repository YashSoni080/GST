import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("dashboard:read"), async (req, res, next) => {
  try {
    const { Invoice, GSTR, ITCEntry } = req.app.locals.models;
    const cid = req.user.companyId;

    const invoiceCount = await Invoice.countDocuments({ companyId: cid });
    const recentInvoices = await Invoice.find({ companyId: cid })
      .sort({ date: -1 }).limit(5).lean();

    const returns = await GSTR.find({ companyId: cid }).sort({ period: -1 }).limit(10).lean();
    const itcEntries = await ITCEntry.find({ companyId: cid }).sort({ period: -1 }).limit(50).lean();

    // Compute aggregate turnover & output tax across ALL valid invoices
    const allInvoices = await Invoice.find({ companyId: cid, status: { $ne: "cancelled" } }).lean();
    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    for (const inv of allInvoices) {
      totalTaxable += Number(inv.taxableValue) || 0;
      totalCgst += Number(inv.cgst) || 0;
      totalSgst += Number(inv.sgst) || 0;
      totalIgst += Number(inv.igst) || 0;
    }

    let totalItc = 0;
    for (const e of itcEntries) {
      if (e.type === "availed") {
        totalItc += (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.igst) || 0);
      } else if (e.type === "utilized" || e.type === "reversed") {
        totalItc -= (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.igst) || 0);
      }
    }

    const { Purchase } = req.app.locals.models;
    // Also include eligible purchases in total ITC if no manual ledger entries exist yet
    if (totalItc === 0 && Purchase) {
      const eligiblePurchases = await Purchase.find({ companyId: cid, itcEligible: { $ne: "no" } }).lean();
      for (const p of eligiblePurchases) {
        totalItc += Number(p.gst || 0);
      }
    }

    const filingStatus = returns.map((r) => ({
      type: r.type,
      period: r.period,
      status: r.status,
      due: r.arn || (r.status === "filed" ? "ARN Generated" : "Pending"),
    }));

    // Dynamic 6-month historical calculations
    const now = new Date();
    const monthlyLiability = [0, 0, 0, 0, 0, 0];
    const monthlyITC = [0, 0, 0, 0, 0, 0];
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [periodInvoices, periodPurchases] = await Promise.all([
      Invoice.find({ companyId: cid, date: { $gte: sixMonthsAgo }, status: { $ne: "cancelled" } }).lean(),
      Purchase ? Purchase.find({ companyId: cid, billDate: { $gte: sixMonthsAgo } }).lean() : [],
    ]);

    for (const inv of periodInvoices) {
      const d = new Date(inv.date);
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        const gst = (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0) + (Number(inv.igst) || 0);
        monthlyLiability[idx] = Number((monthlyLiability[idx] + gst / 100000).toFixed(2));
      }
    }

    for (const p of periodPurchases) {
      const d = new Date(p.billDate);
      const diffMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        const gst = Number(p.gst) || 0;
        monthlyITC[idx] = Number((monthlyITC[idx] + gst / 100000).toFixed(2));
      }
    }

    const formatCurrency = (val) => {
      if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
      if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} L`;
      return `₹ ${Math.round(val).toLocaleString("en-IN")}`;
    };

    const netTaxVal = Math.max(0, (totalCgst + totalSgst + totalIgst) - totalItc);

    res.json({
      turnover: totalTaxable > 0 ? formatCurrency(totalTaxable) : "₹ 0.00",
      outputTax: formatCurrency(totalCgst + totalSgst + totalIgst),
      itcAvailed: formatCurrency(totalItc),
      netTax: formatCurrency(netTaxVal),
      netTaxNote: "Optimized via Rule 88A",
      turnoverDelta: "",
      outputTaxDelta: "IGST + CGST + SGST",
      itcDelta: "Eligible Inward Tax Credit",
      monthlyLiability,
      monthlyITC,
      filingStatus,
      recentInvoices,
    });
  } catch (err) { next(err); }
});

export default router;
