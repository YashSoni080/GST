import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { searchHSN, getHSN, validateHsnSacDigits } from "../services/hsn.js";

const router = Router();
router.use(requireAuth);

router.get("/validate", can("hsn:read"), async (req, res, next) => {
  try {
    const { code, turnover, supplyType, isExport } = req.query;
    const result = validateHsnSacDigits(code, {
      turnover: Number(turnover) || 50000000,
      supplyType: supplyType || "B2B",
      isExport: isExport === "true",
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get("/lookup/:code", can("hsn:read"), async (req, res, next) => {
  try {
    const hsn = await getHSN(req.params.code);
    if (!hsn) return res.status(404).json({ error: "HSN/SAC not found in statutory directory" });
    res.json(hsn);
  } catch (err) { next(err); }
});

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
