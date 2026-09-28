import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { fuzzyMatchInvoice, generateVendorNudgePayload } from "../services/fuzzyRecon.js";

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

router.get("/:id", can("recon:read"), async (req, res, next) => {
  try {
    const { ReconRun } = req.app.locals.models;
    const run = await ReconRun.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!run) return res.status(404).json({ error: "Recon run not found" });
    res.json(run);
  } catch (err) { next(err); }
});

// Section 3.3: Ingest GSTR-2B monthly statement (Upload or Sync from GSTN)
router.post("/ingest-2b", can("recon:run"), async (req, res, next) => {
  try {
    const { SupplierDoc } = req.app.locals.models;
    const { period, documents } = req.body;
    if (!period || !documents || !Array.isArray(documents)) {
      return res.status(422).json({ error: "Period and documents array are required" });
    }

    const docsToInsert = documents.map((d) => ({
      ...d,
      companyId: req.user.companyId,
      period,
      docDate: d.docDate || d.invoiceDate || d.date || new Date(),
      source: "gstr2b",
      gstrPeriod: period,
      filingDate: d.filingDate || new Date(),
    }));

    await SupplierDoc.insertMany(docsToInsert);
    await audit(req, "ingest_2b", "supplier_doc", null, { period, count: docsToInsert.length });

    res.status(201).json({ count: docsToInsert.length, message: "GSTR-2B documents ingested successfully" });
  } catch (err) { next(err); }
});

// Section 3.3: Automated Rule-Based Matching Algorithm (Exact, Approximate, Mismatch, Missing, Extra)
router.post("/", can("recon:run"), async (req, res, next) => {
  try {
    const { ReconRun, Purchase, SupplierDoc } = req.app.locals.models;
    const { period } = req.body;
    if (!period) return res.status(422).json({ error: "Period is required" });

    const purchases = await Purchase.find({ companyId: req.user.companyId, period }).lean();
    const docs = await SupplierDoc.find({ companyId: req.user.companyId, period }).lean();

    let matched = 0, approximate = 0, mismatched = 0, missing = 0, extra = 0;
    let itcInvolved = 0, itcEligibleClaimed = 0, itcAtRisk = 0;
    const results = [];

    const matchedDocIds = new Set();

    for (const p of purchases) {
      const pGst = Number(p.gst || 0);
      const pTaxable = Number(p.taxableValue || 0);
      itcInvolved += pGst;
      if (p.itcEligible !== "no") itcEligibleClaimed += pGst;

      // Execute Fuzzy Matching Engine (PRD Section 1.3)
      const matchResult = fuzzyMatchInvoice(p, docs);
      const doc = matchResult.doc;

      if (doc) {
        matchedDocIds.add(doc._id.toString());
        const taxableDiff = matchResult.taxableDiff;
        const gstDiff = matchResult.gstDiff;
        const status = matchResult.status;
        const matchScore = matchResult.matchScore;

        if (status === "matched") {
          matched++;
        } else if (status === "approximate") {
          approximate++;
        } else {
          mismatched++;
          itcAtRisk += pGst;
        }

        results.push({
          purchaseId: p._id,
          supplierDocId: doc._id,
          supplierGstin: p.vendorGstin,
          supplierName: p.vendorName,
          invoiceNo: p.billNo,
          invoiceDate: p.billDate,
          period: p.period,
          taxable: pTaxable,
          gst: pGst,
          docTaxable: doc.taxableValue,
          docGst: doc.gst,
          status,
          matchScore,
          variance: {
            taxableDiff: Math.round(taxableDiff * 100) / 100,
            gstDiff: Math.round(gstDiff * 100) / 100,
          },
          action: status === "matched" ? "accepted" : "pending",
        });

        // Update purchase recon status
        await Purchase.updateOne({ _id: p._id }, { $set: { reconStatus: status, matchedDocId: doc._id, matchedOn: new Date() } });
      } else {
        missing++;
        itcAtRisk += pGst;
        results.push({
          purchaseId: p._id,
          supplierGstin: p.vendorGstin,
          supplierName: p.vendorName,
          invoiceNo: p.billNo,
          invoiceDate: p.billDate,
          period: p.period,
          taxable: pTaxable,
          gst: pGst,
          docTaxable: 0,
          docGst: 0,
          status: "missing",
          matchScore: 0,
          variance: { taxableDiff: pTaxable, gstDiff: pGst },
          action: "pending",
        });

        await Purchase.updateOne({ _id: p._id }, { $set: { reconStatus: "missing" } });
      }
    }

    // Docs in 2B but not in Books
    for (const d of docs) {
      if (!matchedDocIds.has(d._id.toString())) {
        extra++;
        results.push({
          supplierDocId: d._id,
          supplierGstin: d.supplierGstin,
          supplierName: d.supplierName,
          invoiceNo: d.invoiceNo,
          invoiceDate: d.invoiceDate,
          period: d.period,
          taxable: 0,
          gst: 0,
          docTaxable: d.taxableValue || 0,
          docGst: d.gst || 0,
          status: "extra",
          matchScore: 0,
          variance: { taxableDiff: -(d.taxableValue || 0), gstDiff: -(d.gst || 0) },
          action: "pending",
        });
      }
    }

    const run = await ReconRun.create({
      companyId: req.user.companyId,
      period,
      status: "completed",
      summary: {
        docsIn2b: docs.length,
        purchases: purchases.length,
        matched,
        approximate,
        mismatched,
        missing,
        extra,
        itcInvolved: Math.round(itcInvolved),
        itcEligibleClaimed: Math.round(itcEligibleClaimed),
        itcAtRisk: Math.round(itcAtRisk),
      },
      results,
      ranBy: req.user._id,
    });

    await audit(req, "run", "recon", run._id, { period, matched, approximate, mismatched, missing, extra });
    res.status(201).json(run);
  } catch (err) { next(err); }
});

// One-Click Action Triggers: Accept, Reject, Hold, Provisional Claim
router.patch("/:runId/item/:itemId/action", can("recon:run"), async (req, res, next) => {
  try {
    const { ReconRun } = req.app.locals.models;
    const { action, note } = req.body;
    if (!["accepted", "rejected", "on_hold", "provisional_claim"].includes(action)) {
      return res.status(422).json({ error: "Invalid action" });
    }

    const run = await ReconRun.findOne({ _id: req.params.runId, companyId: req.user.companyId });
    if (!run) return res.status(404).json({ error: "Recon run not found" });

    const item = run.results.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Recon item not found" });

    item.action = action;
    item.actionNote = note || "";
    item.actionDate = new Date();

    await run.save();
    res.json(item);
  } catch (err) { next(err); }
});

// Section 3.4: Automated Discrepancy Mailer to Non-Compliant Suppliers
router.post("/:runId/notify-vendor", can("recon:run"), async (req, res, next) => {
  try {
    const { ReconRun, Purchase, Company } = req.app.locals.models;
    const { supplierGstin } = req.body;
    if (!supplierGstin) return res.status(422).json({ error: "Supplier GSTIN is required" });

    const run = await ReconRun.findOne({ _id: req.params.runId, companyId: req.user.companyId });
    if (!run) return res.status(404).json({ error: "Recon run not found" });

    const company = await Company.findById(req.user.companyId);

    const supplierItems = run.results.filter(
      (r) => r.supplierGstin === supplierGstin && (r.status === "missing" || r.status === "mismatch")
    );

    if (supplierItems.length === 0) {
      return res.status(400).json({ error: "No missing or mismatched invoices for this supplier" });
    }

    const totalBlockedTax = supplierItems.reduce((sum, i) => sum + (i.gst || 0), 0);

    // Simulated email / WhatsApp alert message
    const alertMessage = {
      recipientGstin: supplierGstin,
      recipientName: supplierItems[0]?.supplierName || "Supplier",
      subject: `Urgent: ITC Blockage Alert for ${supplierItems.length} Invoices - ${company.name}`,
      body: `Dear Partner,\n\nDuring our GSTR-2B reconciliation for period ${run.period}, we noticed that ${supplierItems.length} invoices totaling ₹${totalBlockedTax.toLocaleString("en-IN")} in GST have either not been uploaded in your GSTR-1 or contain discrepancies.\n\nPlease upload or amend these invoices in your upcoming return immediately to avoid payment withholding under our Escrow protocol.\n\nThank you,\n${company.name}`,
      items: supplierItems.map((i) => ({
        invoiceNo: i.invoiceNo,
        date: i.invoiceDate,
        taxable: i.taxable,
        gst: i.gst,
        issue: i.status === "missing" ? "Missing in GSTR-2B" : "Tax variance",
      })),
      dispatchedAt: new Date().toISOString(),
      channels: ["Email", "WhatsApp", "Supplier Dispute Portal"],
    };

    // Mark alert sent
    supplierItems.forEach((it) => {
      it.disputeAlertSent = true;
      it.disputeAlertDate = new Date();
    });
    await run.save();

    await Purchase.updateMany(
      { companyId: req.user.companyId, vendorGstin: supplierGstin, reconStatus: { $in: ["missing", "mismatch"] } },
      { $set: { disputeStatus: "discrepancy_sent", lastAlertSentAt: new Date() } }
    );

    res.json({ success: true, message: `Discrepancy alert dispatched to ${supplierItems[0]?.supplierName}`, alertMessage });
  } catch (err) { next(err); }
});

// PRD Section 2.5: Generate Automated Vendor Communication Loop ("Nudge" Preview)
router.post("/:runId/nudge-preview", can("recon:run"), async (req, res, next) => {
  try {
    const { ReconRun, Company, Party } = req.app.locals.models;
    const { supplierGstin } = req.body;
    if (!supplierGstin) return res.status(422).json({ error: "Supplier GSTIN is required" });

    const run = await ReconRun.findOne({ _id: req.params.runId, companyId: req.user.companyId });
    if (!run) return res.status(404).json({ error: "Recon run not found" });

    const company = await Company.findById(req.user.companyId);
    const party = await Party.findOne({ companyId: req.user.companyId, gstin: supplierGstin }).lean();

    const supplierItems = run.results.filter(
      (r) => r.supplierGstin === supplierGstin && (r.status === "missing" || r.status === "mismatch")
    );

    const discrepancies = supplierItems.map((i) => ({
      invoiceNo: i.invoiceNo,
      invoiceDate: i.invoiceDate,
      taxable: i.taxable,
      gst: i.gst,
      issue: i.status === "missing" ? "Missing in GSTR-2B" : "Tax/Rate variance",
    }));

    const nudge = generateVendorNudgePayload({
      companyName: company?.name || "Greenshine Traders Pvt. Ltd.",
      vendorName: party?.name || supplierItems[0]?.supplierName || "Valued Supplier",
      vendorGstin: supplierGstin,
      vendorPhone: party?.phone || "",
      vendorEmail: party?.email || "",
      period: run.period,
      discrepancies,
    });

    res.json(nudge);
  } catch (err) { next(err); }
});

export default router;
