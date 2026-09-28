import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { processNaturalLanguageQuery } from "../services/aiAssistant.js";

const router = Router();
router.use(requireAuth);

const MAX_HISTORY_ITEMS = 40;

// Section 5.2: Conversational Compliance Assistant (Natural Language Tax Query Copilot)
router.post("/query", can("dashboard:read"), async (req, res, next) => {
  try {
    const { query, apiKey, provider, history } = req.body || {};

    if (typeof query !== "string" || !query.trim()) {
      return res.status(422).json({ error: "Query must be a non-empty text string" });
    }
    if (query.length > 4000) {
      return res.status(422).json({ error: "Query must be 4000 characters or fewer" });
    }
    if (apiKey != null && typeof apiKey !== "string") {
      return res.status(422).json({ error: "apiKey must be a string" });
    }
    if (provider != null && typeof provider !== "string") {
      return res.status(422).json({ error: "provider must be a string" });
    }
    if (history != null && !Array.isArray(history)) {
      return res.status(422).json({ error: "history must be an array of chat turns" });
    }

    const cleanHistory = Array.isArray(history)
      ? history.slice(-MAX_HISTORY_ITEMS).map((turn) => ({
          role: turn?.role === "assistant" ? "assistant" : "user",
          content: typeof turn?.content === "string" ? turn.content.slice(0, 2000) : "",
        }))
      : [];

    const response = await processNaturalLanguageQuery(
      query,
      req.app.locals.models,
      req.user.companyId,
      { apiKey: typeof apiKey === "string" ? apiKey.trim().slice(0, 256) : "", provider, history: cleanHistory }
    );
    res.json(response);
  } catch (err) { next(err); }
});

export default router;
