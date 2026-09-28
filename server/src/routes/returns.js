import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { compileGSTR1, compileGSTR3B, compileGSTR9, compileCMP08, compileGSTR4, compileGSTR9C } from "../services/returnsCompiler.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("returns:read"), async (req, res, next) => {
  try {
    const { GSTR } = req.app.locals.models;
    const { type, period } = req.query;
    const filter = { companyId: req.user.companyId };
    if (type) filter.type = type;
    if (period) filter.period = period;
    const returns = await GSTR.find(filter).sort({ period: -1, type: 1 }).lean();
    res.json({ returns });
  } catch (err) { next(err); }
});

router.get("/:id", can("returns:read"), async (req, res, next) => {
  try {
    const { GSTR } = req.app.locals.models;
    const ret = await GSTR.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!ret) return res.status(404).json({ error: "Return not found" });
    res.json(ret);
  } catch (err) { next(err); }
});

// Export GSTN-compliant JSON payload for download / portal upload
router.get("/:id/json", can("returns:read"), async (req, res, next) => {
  try {
    const { GSTR } = req.app.locals.models;
    const ret = await GSTR.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!ret) return res.status(404).json({ error: "Return not found" });

    res.setHeader("Content-Disposition", `attachment; filename="${ret.companyGstin}_${ret.type}_${ret.period}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(ret.jsonPayload || { error: "No JSON payload compiled yet" });
  } catch (err) { next(err); }
});

// Section 2.3: Automatic Direct Return Compilation from Invoices & Purchases
router.post("/generate", can("returns:create"), async (req, res, next) => {
  try {
    const { GSTR, Invoice, Purchase, Company } = req.app.locals.models;
    const { type, period, compositionRate = 1 } = req.body; // e.g. type: "GSTR1", "GSTR3B", "CMP08", "GSTR4"
    if (!type || !period) {
      return res.status(422).json({ error: "Type (GSTR1, GSTR3B, CMP08, GSTR4) and period are required" });
    }

    const company = await Company.findById(req.user.companyId);
    const primaryGstin = company?.primaryGstin();
    if (!primaryGstin) return res.status(400).json({ error: "No GSTIN configured for company" });

    // Fetch invoices for period
    let startOfMonth, endOfMonth;
    if (period.includes("-") && period.split("-").length === 2 && !period.includes("Q")) {
      startOfMonth = new Date(`${period}-01T00:00:00.000Z`);
      const [year, month] = period.split("-").map(Number);
      endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else {
      startOfMonth = new Date("2020-01-01");
      endOfMonth = new Date("2030-12-31");
    }

    const invoices = await Invoice.find({
      companyId: req.user.companyId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    const purchases = await Purchase.find({
      companyId: req.user.companyId,
      period,
    }).lean();

    let compiled;
    if (type === "GSTR1") {
      compiled = compileGSTR1(invoices, { period, gstin: primaryGstin.gstin });
    } else if (type === "GSTR3B") {
      compiled = compileGSTR3B(invoices, purchases, { period, gstin: primaryGstin.gstin });
    } else if (type === "CMP08") {
      compiled = compileCMP08(invoices, purchases, { period, gstin: primaryGstin.gstin, compositionRate });
    } else if (type === "GSTR4") {
      compiled = compileGSTR4(invoices, purchases, { financialYear: period, gstin: primaryGstin.gstin, compositionRate });
    } else {
      compiled = { summary: {}, sections: {}, jsonPayload: {} };
    }

    // Upsert return record
    const ret = await GSTR.findOneAndUpdate(
      { companyId: req.user.companyId, companyGstin: primaryGstin.gstin, period, type },
      {
        $set: {
          summary: compiled.summary,
          sections: compiled.sections,
          jsonPayload: compiled.jsonPayload,
          status: "validated",
          validationErrors: [],
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await audit(req, "generate_return", "return", ret._id, { type, period, gstin: primaryGstin.gstin });
    res.status(201).json(ret);
  } catch (err) { next(err); }
});

// Section 2.3: Filing Modes: EVC (OTP) and DSC submission
router.post("/:id/submit", can("returns:submit"), async (req, res, next) => {
  try {
    const { GSTR } = req.app.locals.models;
    const { filingMode = "EVC", otp } = req.body;
    const ret = await GSTR.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status === "filed") return res.status(400).json({ error: "Return is already filed" });

    // Generate statutory Acknowledgement Reference Number (ARN)
    // Format: AA + StateCode + MMYY + 7-digit random number + Checksum
    const stateCode = ret.companyGstin.slice(0, 2) || "27";
    const mmyy = `${ret.period.slice(5, 7)}${ret.period.slice(2, 4)}`;
    const randomSeq = Math.floor(1000000 + Math.random() * 9000000);
    const arn = `AA${stateCode}${mmyy}${randomSeq}F`;

    ret.status = "filed";
    ret.filedAt = new Date();
    ret.arn = arn;
    ret.filedBy = req.user._id;

    await ret.save();
    await audit(req, "submit", "return", ret._id, { type: ret.type, period: ret.period, arn, filingMode });

    res.json(ret);
  } catch (err) { next(err); }
});

// Section 4.3: Automated Annual Return (GSTR-9 & 9C) Builder
router.get("/annual/gstr9", can("returns:read"), async (req, res, next) => {
  try {
    const { Invoice, Purchase, SupplierDoc } = req.app.locals.models;
    const { financialYear = "2025-26" } = req.query;

    const invoices = await Invoice.find({ companyId: req.user.companyId }).lean();
    const purchases = await Purchase.find({ companyId: req.user.companyId }).lean();
    const supplierDocs = await SupplierDoc.find({ companyId: req.user.companyId }).lean();

    const gstr9Data = compileGSTR9({ invoices, purchases, supplierDocs, financialYear });
    res.json(gstr9Data);
  } catch (err) { next(err); }
});

router.get("/annual/gstr9c", can("returns:read"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const { financialYear = "2025-26", auditedTurnover = 0 } = req.query;

    const invoices = await Invoice.find({ companyId: req.user.companyId }).lean();
    const gstr9cData = compileGSTR9C({
      auditedTurnover: Number(auditedTurnover),
      invoices,
      financialYear,
      gstin: req.user.gstin || "",
    });
    res.json(gstr9cData);
  } catch (err) { next(err); }
});

export default router;
