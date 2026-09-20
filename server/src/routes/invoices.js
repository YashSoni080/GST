import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { computeTaxes } from "../services/tax.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("invoices:read"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const { status, from, to, partyId } = req.query;
    const filter = { companyId: req.user.companyId };
    if (status) filter.status = status;
    if (partyId) filter.partyId = partyId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const invoices = await Invoice.find(filter).sort({ date: -1, createdAt: -1 }).limit(200).lean();
    res.json({ invoices });
  } catch (err) { next(err); }
});

router.get("/:id", can("invoices:read"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) { next(err); }
});

router.post("/", can("invoices:create"), async (req, res, next) => {
  try {
    const { Invoice, Company, Party } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(400).json({ error: "Company not found" });
    const primaryGstin = company.primaryGstin();
    if (!primaryGstin) return res.status(400).json({ error: "No GSTIN configured for company" });

    const { partyId, partyName, docType, invNo, date, placeOfSupply, items, notes } = req.body;
    if (!invNo || !items || items.length === 0) {
      return res.status(422).json({ error: "Invoice number and items required" });
    }

    let partyGstin = "", partyStateCode = "", partyState = "";
    if (partyId) {
      const party = await Party.findById(partyId);
      if (party) {
        partyGstin = party.gstin || "";
        partyStateCode = party.stateCode || "";
        partyState = party.state || "";
      }
    }

    const branchStateCode = primaryGstin.stateCode;
    const posStateCode = placeOfSupply?.slice(0, 2) || partyStateCode || branchStateCode;
    const posState = placeOfSupply?.slice(3) || partyState || primaryGstin.state;

    const taxItems = items.map((it) => {
      const taxable = Math.round((Number(it.qty) || 0) * (Number(it.rate) || 0) * (1 - (Number(it.discountPct) || 0) / 100));
      return { ...it, taxable, gstRate: Number(it.gstRate) || 0 };
    });

    const totals = computeTaxes(taxItems, { posStateCode, branchStateCode });

    const invoice = await Invoice.create({
      companyId: req.user.companyId,
      companyGstin: primaryGstin.gstin,
      gstinStateCode: branchStateCode,
      gstinState: primaryGstin.state,
      docType: docType || "invoice",
      invNo,
      series: primaryGstin.invoiceSeries,
      date: date ? new Date(date) : new Date(),
      partyId, partyName, partyGstin, partyStateCode, partyState,
      placeOfSupply: posState,
      posStateCode, posState,
      supplyType: partyGstin ? "B2B" : "B2C",
      items: taxItems,
      taxableValue: totals.taxableValue,
      cgst: totals.cgst, sgst: totals.sgst, igst: totals.igst,
      utgst: totals.utgst, cess: totals.cess,
      total: totals.total, roundOff: totals.roundOff,
      status: "draft",
      notes,
      createdBy: req.user._id,
    });

    await audit(req, "create", "invoice", invoice._id, { invNo, total: totals.total });
    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

router.patch("/:id", can("invoices:edit"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const allowed = ["partyName", "partyGstin", "date", "placeOfSupply", "items", "notes", "status"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) { next(err); }
});

router.post("/:id/cancel", can("invoices:cancel"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });
    invoice.status = "cancelled";
    invoice.cancelledAt = new Date();
    invoice.cancelDocNo = req.body.cancelDocNo || `CANCEL-${invoice.invNo}`;
    await invoice.save();
    await audit(req, "cancel", "invoice", invoice._id, { invNo: invoice.invNo });
    res.json(invoice);
  } catch (err) { next(err); }
});

export default router;
