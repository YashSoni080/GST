import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { searchHSN } from "../services/hsn.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("hsn:read"), async (req, res, next) => {
  try {
    const { q, type } = req.query;
    const hsnCodes = await searchHSN({ q, type });
    res.json({ hsnCodes });
  } catch (err) { next(err); }
});

router.post("/", can("hsn:edit"), async (req, res, next) => {
  try {
    const { HSNCode } = req.app.locals.models;
    const hsn = await HSNCode.findOneAndUpdate(
      { code: req.body.code },
      { $set: req.body },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json(hsn);
  } catch (err) { next(err); }
});

export default router;
