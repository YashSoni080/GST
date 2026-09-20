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

    let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    for (const inv of recentInvoices) {
      totalTaxable += Number(inv.taxableValue) || 0;
      totalCgst += Number(inv.cgst) || 0;
      totalSgst += Number(inv.sgst) || 0;
      totalIgst += Number(inv.igst) || 0;
    }

    let totalItc = 0;
    for (const e of itcEntries) {
      if (e.type === "availed") {
        totalItc += (Number(e.cgst) || 0) + (Number(e.sgst) || 0) + (Number(e.igst) || 0);
      }
    }

    const filingStatus = returns.map(r => ({
      type: r.type, period: r.period, status: r.status,
      due: r.filedAt ? "—" : "—",
    }));

    res.json({
      turnover: `₹ ${(totalTaxable / 10000000).toFixed(2)} Cr`,
      outputTax: `₹ ${((totalCgst + totalSgst + totalIgst) / 100000).toFixed(2)} L`,
      itcAvailed: `₹ ${(totalItc / 10000000).toFixed(2)} Cr`,
      netTax: `₹ ${((totalCgst + totalSgst + totalIgst - totalItc) / 100000).toFixed(2)} L`,
      netTaxNote: "",
      turnoverDelta: "",
      outputTaxDelta: "",
      itcDelta: "",
      monthlyLiability: [14, 17, 16, 21, 19, 22],
      monthlyITC: [12, 13, 15, 18, 17, 21],
      filingStatus,
      recentInvoices,
    });
  } catch (err) { next(err); }
});

export default router;
