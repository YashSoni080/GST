import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { parseInvoiceWithIDP } from "../services/aiAssistant.js";

const router = Router();
router.use(requireAuth);

// Section 4.1: AI-Powered Intelligent Document Processing (IDP)
router.post("/parse", can("purchases:create"), async (req, res, next) => {
  try {
    const { rawText, fileName } = req.body;
    if (typeof rawText !== "string" || !rawText.trim()) {
      return res.status(422).json({ error: "Raw invoice text or OCR data string is required" });
    }

    const parsed = parseInvoiceWithIDP(rawText);
    res.json({
      success: true,
      fileName: fileName || "scanned_invoice.pdf",
      data: parsed,
    });
  } catch (err) { next(err); }
});

export default router;
