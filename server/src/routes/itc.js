import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import {
  optimizeCreditUtilization,
  track180DayRule37,
  calculateRule42Reversal,
  calculateRule43Reversal,
} from "../services/itcOptimizer.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("itc:read"), async (req, res, next) => {
  try {
    const { ITCEntry } = req.app.locals.models;
    const { period, type } = req.query;
    const filter = { companyId: req.user.companyId };
    if (period) filter.period = period;
    if (type) filter.type = type;
    const entries = await ITCEntry.find(filter).sort({ period: -1 }).limit(200).lean();
    res.json({ entries });
  } catch (err) { next(err); }
});

router.post("/", can("itc:action"), async (req, res, next) => {
  try {
    const { ITCEntry } = req.app.locals.models;
    const entry = await ITCEntry.create({
      ...req.body,
      companyId: req.user.companyId,
      createdBy: req.user._id,
    });
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// Section 4.2: Dynamic Credit Utilization Matrix Optimizer (Section 49A/49B)
router.get("/optimizer", can("itc:read"), async (req, res, next) => {
  try {
    const { Invoice, ITCEntry, Purchase } = req.app.locals.models;
    const { period } = req.query;

    // Calculate outward liabilities from invoices
    const invFilter = { companyId: req.user.companyId, status: { $ne: "cancelled" } };
    const invoices = await Invoice.find(invFilter).lean();

    let outwardIgst = 0, outwardCgst = 0, outwardSgst = 0;
    for (const inv of invoices) {
      outwardIgst += Number(inv.igst || 0);
      outwardCgst += Number(inv.cgst || 0);
      outwardSgst += Number(inv.sgst || 0);
    }

    // Calculate available ITC balance
    const itcEntries = await ITCEntry.find({ companyId: req.user.companyId }).lean();
    let itcIgst = 0, itcCgst = 0, itcSgst = 0;
    for (const e of itcEntries) {
      if (e.type === "availed") {
        itcIgst += Number(e.igst || 0);
        itcCgst += Number(e.cgst || 0);
        itcSgst += Number(e.sgst || 0);
      } else if (e.type === "utilized" || e.type === "reversed") {
        itcIgst -= Number(e.igst || 0);
        itcCgst -= Number(e.cgst || 0);
        itcSgst -= Number(e.sgst || 0);
      }
    }

    // Add eligible purchases not yet claimed in ledger
    const purchases = await Purchase.find({ companyId: req.user.companyId, itcEligible: "yes" }).lean();
    for (const p of purchases) {
      itcIgst += Number(p.igst || 0);
      itcCgst += Number(p.cgst || 0);
      itcSgst += Number(p.sgst || 0);
    }

    const optimization = optimizeCreditUtilization({
      liability: { igst: outwardIgst, cgst: outwardCgst, sgst: outwardSgst },
      itcBalance: { igst: Math.max(0, itcIgst), cgst: Math.max(0, itcCgst), sgst: Math.max(0, itcSgst) },
    });

    res.json({
      period: period || "Current",
      liability: { igst: outwardIgst, cgst: outwardCgst, sgst: outwardSgst, total: outwardIgst + outwardCgst + outwardSgst },
      itcBalance: { igst: Math.max(0, itcIgst), cgst: Math.max(0, itcCgst), sgst: Math.max(0, itcSgst), total: Math.max(0, itcIgst) + Math.max(0, itcCgst) + Math.max(0, itcSgst) },
      ...optimization,
    });
  } catch (err) { next(err); }
});

// Section 4.2: 180-Day Rule 37 Vendor Payment Tracker
router.get("/rule37-tracker", can("itc:read"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const purchases = await Purchase.find({ companyId: req.user.companyId }).lean();
    const result = track180DayRule37(purchases);
    res.json(result);
  } catch (err) { next(err); }
});

// Section 4.2: Section 17(5) Blocked Credits Ledger
router.get("/section17-5", can("itc:read"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const purchases = await Purchase.find({
      companyId: req.user.companyId,
      $or: [{ itcEligible: "no" }, { section17_5Category: { $ne: "none" } }],
    }).lean();

    const totalBlocked = purchases.reduce((sum, p) => sum + (Number(p.gst) || 0), 0);
    res.json({
      count: purchases.length,
      totalBlockedGst: totalBlocked,
      blockedPurchases: purchases,
    });
  } catch (err) { next(err); }
});

// Section 4.2: Rule 42 Proportionate Reversal Calculation
router.post("/rule42", can("itc:read"), async (req, res, next) => {
  try {
    const {
      totalItc,
      nonBusinessItc,
      exemptSupplyItc,
      blockedSection17_5Itc,
      taxableSupplyItc,
      exemptTurnover,
      totalTurnover,
    } = req.body;

    const result = calculateRule42Reversal({
      totalItc,
      nonBusinessItc,
      exemptSupplyItc,
      blockedSection17_5Itc,
      taxableSupplyItc,
      exemptTurnover,
      totalTurnover,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Section 4.2: Rule 43 Capital Goods Reversal Calculation
router.post("/rule43", can("itc:read"), async (req, res, next) => {
  try {
    const { commonCapitalGoodsItc, exemptTurnover, totalTurnover } = req.body;
    const result = calculateRule43Reversal({
      commonCapitalGoodsItc,
      exemptTurnover,
      totalTurnover,
    });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
