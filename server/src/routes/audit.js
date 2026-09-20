import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("audit:read"), async (req, res, next) => {
  try {
    const { AuditLog } = req.app.locals.models;
    const { entity, action, limit } = req.query;
    const filter = { companyId: req.user.companyId };
    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    const logs = await AuditLog.find(filter)
      .sort({ at: -1 })
      .limit(Number(limit) || 100)
      .lean();
    res.json({ logs });
  } catch (err) { next(err); }
});

export default router;
