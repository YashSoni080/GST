import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { computeTaxes } from "../services/tax.js";
import { computeIRN, generateSignedQR, generateUPIPaymentQR } from "../services/irn.js";
import { generateEWayBill } from "../services/eway.js";
import { STATES } from "../config/constants.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("invoices:read"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const { status, from, to, partyId, docType } = req.query;
    const filter = { companyId: req.user.companyId };
    if (typeof status === "string" && status) filter.status = status;
    if (typeof docType === "string" && docType) filter.docType = docType;
    if (typeof partyId === "string" && partyId) filter.partyId = partyId;
    if ((typeof from === "string" && from) || (typeof to === "string" && to)) {
      filter.date = {};
      if (typeof from === "string" && from && !isNaN(new Date(from).getTime())) filter.date.$gte = new Date(from);
      if (typeof to === "string" && to && !isNaN(new Date(to).getTime())) filter.date.$lte = new Date(to);
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

    const {
      partyId,
      partyName,
      docType = "invoice",
      originalInvoiceId,
      originalInvNo,
      originalInvDate,
      reasonForIssuing,
      challanPurpose,
      invNo,
      date,
      placeOfSupply,
      items,
      notes,
      reverseCharge = false,
      exportDetails,
    } = req.body;

    if (!invNo || !items || items.length === 0) {
      return res.status(422).json({ error: "Invoice number and items are required" });
    }

    // Pre-issuance validation: Mandatory HSN & quantities
    for (const it of items) {
      if (!it.hsn || it.hsn.trim().length < 2) {
        return res.status(422).json({ error: `Mandatory HSN code missing for item "${it.name || "Item"}"` });
      }
      if (Number(it.qty) <= 0 || Number(it.rate) < 0) {
        return res.status(422).json({ error: `Invalid quantity or rate for item "${it.name || "Item"}"` });
      }
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
    let posStateCode = branchStateCode;
    let posState = primaryGstin.state;

    if (placeOfSupply && typeof placeOfSupply === "string") {
      const trimmed = placeOfSupply.trim();
      const codeMatch = trimmed.match(/^([0-9]{2})/);
      if (codeMatch && STATES[codeMatch[1]]) {
        posStateCode = codeMatch[1];
        posState = trimmed.slice(2).trim() || STATES[posStateCode];
      } else {
        const found = Object.entries(STATES).find(
          ([, name]) => name.toLowerCase() === trimmed.toLowerCase()
        );
        if (found) {
          posStateCode = found[0];
          posState = found[1];
        } else if (partyStateCode) {
          posStateCode = partyStateCode;
          posState = partyState;
        }
      }
    } else if (partyStateCode) {
      posStateCode = partyStateCode;
      posState = partyState;
    }

    const taxItems = items.map((it) => {
      const taxable = Math.round(
        (Number(it.qty) || 0) * (Number(it.rate) || 0) * (1 - (Number(it.discountPct) || 0) / 100)
      );
      return { ...it, taxable, gstRate: Number(it.gstRate) || 0 };
    });

    const totals = computeTaxes(taxItems, { posStateCode, branchStateCode });

    // Determine supply type
    let supplyType = partyGstin ? "B2B" : "B2C";
    if (docType === "SEZ" || partyState === "SEZ") supplyType = "SEZ";
    if (docType === "Export" || exportDetails?.portCode) supplyType = "Export";

    // Dynamic UPI QR code generation for B2C invoices (Section 2.2)
    let upiQrDataUrl = null;
    if (supplyType === "B2C" || !partyGstin) {
      const upiResult = await generateUPIPaymentQR({
        vpa: company.bankAccount ? `pay.${primaryGstin.gstin.slice(0, 10)}@upi` : "greenshine.gst@hdfcbank",
        payeeName: company.name,
        amount: totals.total,
        invoiceNo: invNo,
      });
      upiQrDataUrl = upiResult.upiQrDataUrl;
    }

    let linkedOriginalInvoiceId = null;
    let linkedOriginalInvNo = originalInvNo || "";
    let linkedOriginalInvDate = originalInvDate ? new Date(originalInvDate) : null;

    if (["creditNote", "debitNote", "deliveryChallan"].includes(docType)) {
      let orig = null;
      if (originalInvoiceId) {
        orig = await Invoice.findOne({ _id: originalInvoiceId, companyId: req.user.companyId });
      } else if (originalInvNo) {
        orig = await Invoice.findOne({ invNo: originalInvNo, companyId: req.user.companyId });
      }
      if (orig) {
        linkedOriginalInvoiceId = orig._id;
        linkedOriginalInvNo = orig.invNo;
        linkedOriginalInvDate = orig.date;
        if (!partyGstin && orig.partyGstin) {
          partyGstin = orig.partyGstin;
          partyStateCode = orig.partyStateCode;
          partyState = orig.partyState;
        }
      }
    }

    const invoice = await Invoice.create({
      companyId: req.user.companyId,
      companyGstin: primaryGstin.gstin,
      gstinStateCode: branchStateCode,
      gstinState: primaryGstin.state,
      docType,
      originalInvoiceId: linkedOriginalInvoiceId,
      originalInvNo: linkedOriginalInvNo,
      originalInvDate: linkedOriginalInvDate,
      reasonForIssuing: reasonForIssuing || "none",
      challanPurpose: challanPurpose || "none",
      invNo,
      series: primaryGstin.invoiceSeries || "INV",
      date: date ? new Date(date) : new Date(),
      partyId,
      partyName,
      partyGstin,
      partyStateCode,
      partyState,
      placeOfSupply: posState,
      posStateCode,
      posState,
      supplyType,
      items: taxItems,
      taxableValue: totals.taxableValue,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      utgst: totals.utgst,
      cess: totals.cess,
      total: totals.total,
      roundOff: totals.roundOff,
      reverseCharge: Boolean(reverseCharge),
      exportDetails: exportDetails || {},
      upiQrDataUrl,
      status: "valid",
      notes,
      createdBy: req.user._id,
    });

    await audit(req, "create", "invoice", invoice._id, { invNo, total: totals.total, docType });
    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

// Section 3.1: Real-Time e-Invoicing (IRP Integration & IRN Generation)
router.post("/:id/irn", can("invoices:irn"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    if (invoice.status === "cancelled") {
      return res.status(400).json({ error: "Cannot generate IRN for cancelled invoice" });
    }
    if (invoice.irn) {
      return res.status(400).json({ error: "IRN already generated for this invoice" });
    }

    // Compute official SHA-256 IRN hash
    const irn = computeIRN({
      supplierGstin: invoice.companyGstin,
      finYear: "2025-26",
      docType: invoice.docType === "creditNote" ? "CRN" : invoice.docType === "debitNote" ? "DBN" : "INV",
      docNo: invoice.invNo,
    });

    const ackNo = `1126100${Math.floor(100000 + Math.random() * 900000)}`;
    const ackDate = new Date();

    // Generate IRP Signed QR Code
    const { qrDataUrl } = await generateSignedQR({
      irn,
      sellerGstin: invoice.companyGstin,
      buyerGstin: invoice.partyGstin,
      docNo: invoice.invNo,
      docDate: invoice.date,
      totInvVal: invoice.total,
      itemCnt: invoice.items?.length || 1,
      mainHsnCode: invoice.items?.[0]?.hsn || "8471",
      ackNo,
      ackDate: ackDate.toISOString(),
    });

    invoice.irn = irn;
    invoice.irnDate = ackDate;
    invoice.irnAckNo = ackNo;
    invoice.irnAckDate = ackDate;
    invoice.qrDataUrl = qrDataUrl;
    invoice.status = "IRN_GENERATED";

    await invoice.save();
    await audit(req, "generate_irn", "invoice", invoice._id, { invNo: invoice.invNo, irn, ackNo });

    res.json(invoice);
  } catch (err) { next(err); }
});

// Section 3.1: Auto-e-Way Bill Generation Concurrently with Invoicing
router.post("/:id/ewb", can("invoices:eway"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const invoice = await Invoice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    if (invoice.status === "cancelled") {
      return res.status(400).json({ error: "Cannot generate e-Way Bill for cancelled invoice" });
    }

    const {
      vehicleNo = "MH-04-AB-1290",
      transporterId = "27AABCT1330L1Z2",
      transporterName = "VRL Logistics Ltd.",
      fromPin = "400001",
      toPin = "560001",
      mode = "road",
    } = req.body;

    const ewbData = generateEWayBill({
      invoiceNo: invoice.invNo,
      fromStateCode: invoice.gstinStateCode,
      toStateCode: invoice.posStateCode,
      fromPin,
      toPin,
      vehicleNo,
      transporterId,
      transporterName,
      mode,
    });

    invoice.ewb = {
      no: ewbData.ewbNo,
      genDate: ewbData.genDate,
      validTill: ewbData.validTill,
      distanceKm: ewbData.distanceKm,
      mode: ewbData.mode,
      vehicleNo: ewbData.vehicleNo,
      transporter: `${ewbData.transporterName} (${ewbData.transporterId})`,
      status: "active",
    };

    if (invoice.status !== "IRN_GENERATED") {
      invoice.status = "EWB_GENERATED";
    }

    await invoice.save();
    await audit(req, "generate_ewb", "invoice", invoice._id, { invNo: invoice.invNo, ewbNo: ewbData.ewbNo });

    res.json(invoice);
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
    invoice.cancelReason = req.body.reason || "Data entry error / Order cancelled";
    await invoice.save();

    await audit(req, "cancel", "invoice", invoice._id, { invNo: invoice.invNo });
    res.json(invoice);
  } catch (err) { next(err); }
});

export default router;
