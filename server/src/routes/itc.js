import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";

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

export default router;
