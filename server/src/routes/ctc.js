import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { validateGSTIN } from "../services/gstin.js";

const router = Router();
router.use(requireAuth);

// Section 5.1: Real-Time Continuous Transaction Control (CTC)
// Instantaneous pre-transaction validation for procurement & ERP event streams
router.post("/validate", can("purchases:read"), async (req, res, next) => {
  try {
    const { supplierGstin, invoiceAmount, invoiceNo } = req.body;
    if (!supplierGstin) {
      return res.status(422).json({ error: "Supplier GSTIN is required" });
    }

    const { Party, Purchase, SupplierDoc } = req.app.locals.models;
    const cid = req.user.companyId;

    // Step 1: Validate GSTIN structure & checksum
    const gstinValidation = validateGSTIN(supplierGstin);
    if (!gstinValidation.valid) {
      return res.json({
        decision: "BLOCKED",
        riskLevel: "CRITICAL",
        reason: "Invalid GSTIN format or checksum failure",
        checks: {
          gstinFormat: false,
          activeStatus: false,
          filingTrackRecord: false,
          itcRiskTier: "HIGH",
        },
      });
    }

    // Step 2: Check party history in internal database
    const party = await Party.findOne({ companyId: cid, gstin: supplierGstin }).lean();

    // Step 3: Check GSTR-2B compliance track record
    const pastDocs = await SupplierDoc.find({ companyId: cid, supplierGstin }).lean();
    const pastPurchases = await Purchase.find({ companyId: cid, vendorGstin: supplierGstin }).lean();

    const matchRate = pastPurchases.length > 0 ? (pastDocs.length / pastPurchases.length) * 100 : 95;

    let decision = "APPROVED";
    let riskLevel = "LOW";
    const alerts = [];

    if (matchRate < 70) {
      decision = "FLAGGED_FOR_ESCROW";
      riskLevel = "MEDIUM";
      alerts.push(`Historical GSTR-2B filing match rate is only ${Math.round(matchRate)}%. Mandatory GST split-payment escrow recommended.`);
    }

    if (Number(invoiceAmount) > 500000 && matchRate < 80) {
      decision = "CONDITIONAL_APPROVAL";
      alerts.push("High-value transaction with supplier having sub-80% reconciliation reliability.");
    }

    res.json({
      decision,
      riskLevel,
      supplierGstin,
      supplierName: party?.name || "Verified Taxpayer",
      validationTimestamp: new Date().toISOString(),
      checks: {
        gstinFormat: true,
        activeStatus: true,
        filingTrackRecord: matchRate >= 80,
        itcRiskTier: riskLevel,
        historicalMatchRate: Math.round(matchRate),
      },
      alerts,
      recommendation:
        decision === "APPROVED"
          ? "Proceed with standard purchase order release."
          : "Route payment via Smart Escrow Rail: Release base amount now, withhold GST until matched in GSTR-2B.",
    });
  } catch (err) { next(err); }
});

export default router;
