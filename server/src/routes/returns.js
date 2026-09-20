import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

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

router.post("/", can("returns:create"), async (req, res, next) => {
  try {
    const { GSTR, Company } = req.app.locals.models;
    const company = await Company.findById(req.user.companyId);
    const primaryGstin = company?.primaryGstin();
    const { type, period } = req.body;
    if (!type || !period) {
      return res.status(422).json({ error: "Type and period are required" });
    }
    const ret = await GSTR.create({
      companyId: req.user.companyId,
      companyGstin: primaryGstin?.gstin || "",
      type, period,
      status: "draft",
      summary: {}, sections: {},
      filedBy: req.user._id,
    });
    res.status(201).json(ret);
  } catch (err) { next(err); }
});

router.post("/:id/submit", can("returns:submit"), async (req, res, next) => {
  try {
    const { GSTR } = req.app.locals.models;
    const ret = await GSTR.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!ret) return res.status(404).json({ error: "Return not found" });
    if (ret.status === "filed") return res.status(400).json({ error: "Already filed" });
    ret.status = "filed";
    ret.filedAt = new Date();
    ret.arn = `ARN${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await ret.save();
    await audit(req, "submit", "return", ret._id, { type: ret.type, period: ret.period });
    res.json(ret);
  } catch (err) { next(err); }
});

export default router;
