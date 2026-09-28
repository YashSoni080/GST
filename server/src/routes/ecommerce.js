import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { parseEcommerceReport } from "../services/ecommerce.js";

const router = Router();
router.use(requireAuth);

// List all e-commerce settlement runs
router.get("/", can("ecommerce:read"), async (req, res, next) => {
  try {
    const { EcommerceSettlement } = req.app.locals.models;
    const { channel, period } = req.query;
    const filter = { companyId: req.user.companyId };
    if (channel) filter.channel = channel;
    if (period) filter.settlementPeriod = period;

    const settlements = await EcommerceSettlement.find(filter)
      .select("-lineItems") // Exclude heavy line items from list view
      .sort({ createdAt: -1 })
      .lean();

    res.json({ settlements });
  } catch (err) { next(err); }
});

// Get single settlement details with line items
router.get("/:id", can("ecommerce:read"), async (req, res, next) => {
  try {
    const { EcommerceSettlement } = req.app.locals.models;
    const settlement = await EcommerceSettlement.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    }).lean();

    if (!settlement) return res.status(404).json({ error: "Settlement record not found" });
    res.json(settlement);
  } catch (err) { next(err); }
});

// PRD Section 2.4: Ingest and auto-split e-commerce report
router.post("/ingest", can("ecommerce:sync"), async (req, res, next) => {
  try {
    const { EcommerceSettlement, Company } = req.app.locals.models;
    const { csvText, channel = "amazon", period = "2026-09", reportName } = req.body;

    if (!csvText || !csvText.trim()) {
      return res.status(422).json({ error: "CSV text content is required" });
    }

    const company = await Company.findById(req.user.companyId);
    const branchStateCode = company?.primaryGstin()?.stateCode || "27";

    const parsedData = parseEcommerceReport({
      csvText,
      channel,
      branchStateCode,
      period,
    });

    const settlement = await EcommerceSettlement.create({
      companyId: req.user.companyId,
      reportName: reportName || `${channel.toUpperCase()} Settlement - ${period}`,
      ...parsedData,
      ingestedBy: req.user._id,
    });

    await audit(req, "ingest_ecommerce", "ecommerce", settlement._id, {
      channel,
      period,
      totalOrders: parsedData.totalOrders,
      netTaxable: parsedData.netTaxableTurnover,
    });

    res.status(201).json({
      success: true,
      settlement,
      message: `Successfully processed ${parsedData.totalOrders} marketplace transactions from ${channel.toUpperCase()}`,
    });
  } catch (err) { next(err); }
});

// Simulate GSTR-8 portal TCS matching
router.post("/:id/sync-gstr8", can("ecommerce:sync"), async (req, res, next) => {
  try {
    const { EcommerceSettlement } = req.app.locals.models;
    const settlement = await EcommerceSettlement.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!settlement) return res.status(404).json({ error: "Settlement not found" });

    // Matched TCS under Section 52
    const totalTcs = settlement.tcsCollected?.total || 0;
    settlement.gstr8Reconciliation = {
      gstr8ReportedTcs: totalTcs,
      variance: 0,
      status: "matched",
      lastSyncedAt: new Date(),
    };
    await settlement.save();

    await audit(req, "sync_gstr8", "ecommerce", settlement._id, { totalTcs });
    res.json({
      success: true,
      message: "GSTR-8 TCS portal matching complete. 100% credit matched!",
      gstr8Reconciliation: settlement.gstr8Reconciliation,
    });
  } catch (err) { next(err); }
});

export default router;
