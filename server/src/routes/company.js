import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("company:read"), async (req, res, next) => {
  try {
    const { Company } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (err) { next(err); }
});

router.patch("/", can("company:edit"), async (req, res, next) => {
  try {
    const { Company } = req.app.locals.models;
    const allowed = ["name", "pan", "fiscalYear", "address", "bankAccount"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const company = await Company.findByIdAndUpdate(req.user.companyId, { $set: updates }, { new: true });
    await audit(req, "update", "company", company._id, updates);
    res.json(company);
  } catch (err) { next(err); }
});

// Multi-GSTIN & Branch Management (Section 2.1)
router.post("/gstins", can("company:edit"), async (req, res, next) => {
  try {
    const { Company } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const { gstin, tradeName, legalName, stateCode, state, city, branch, invoiceSeries, isPrimary } = req.body;
    if (typeof gstin !== "string" || !gstin.trim() || typeof stateCode !== "string" || !stateCode.trim() || typeof state !== "string" || !state.trim()) {
      return res.status(422).json({ error: "Valid GSTIN, state code, and state strings are required" });
    }

    if (isPrimary) {
      company.gstins.forEach((g) => { g.isPrimary = false; });
    }

    company.gstins.push({
      gstin: gstin.toUpperCase(),
      tradeName: tradeName || company.name,
      legalName: legalName || company.name,
      stateCode,
      state,
      city: city || "",
      branch: branch || "Branch",
      invoiceSeries: invoiceSeries || "INV",
      isPrimary: Boolean(isPrimary || company.gstins.length === 0),
      active: true,
    });

    await company.save();
    await audit(req, "create", "gstin_branch", company._id, { gstin });
    res.status(201).json(company);
  } catch (err) { next(err); }
});

router.patch("/gstins/:id/set-primary", can("company:edit"), async (req, res, next) => {
  try {
    const { Company } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const branch = company.gstins.id(req.params.id);
    if (!branch) return res.status(404).json({ error: "Branch GSTIN not found" });

    company.gstins.forEach((g) => { g.isPrimary = false; });
    branch.isPrimary = true;
    await company.save();

    await audit(req, "update", "gstin_primary", company._id, { gstin: branch.gstin });
    res.json(company);
  } catch (err) { next(err); }
});

export default router;
