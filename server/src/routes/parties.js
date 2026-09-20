import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("parties:read"), async (req, res, next) => {
  try {
    const { Party } = req.app.locals.models;
    const { q, type, status } = req.query;
    const filter = { companyId: req.user.companyId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { gstin: re }, { city: re }];
    }
    const parties = await Party.find(filter).sort({ name: 1 }).limit(200).lean();
    res.json({ parties });
  } catch (err) { next(err); }
});

router.get("/:id", can("parties:read"), async (req, res, next) => {
  try {
    const { Party } = req.app.locals.models;
    const party = await Party.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!party) return res.status(404).json({ error: "Party not found" });
    res.json(party);
  } catch (err) { next(err); }
});

router.post("/", can("parties:create"), async (req, res, next) => {
  try {
    const { Party } = req.app.locals.models;
    const party = await Party.create({ ...req.body, companyId: req.user.companyId });
    await audit(req, "create", "party", party._id, { name: party.name, gstin: party.gstin });
    res.status(201).json(party);
  } catch (err) { next(err); }
});

router.patch("/:id", can("parties:edit"), async (req, res, next) => {
  try {
    const { Party } = req.app.locals.models;
    const party = await Party.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!party) return res.status(404).json({ error: "Party not found" });
    res.json(party);
  } catch (err) { next(err); }
});

export default router;
