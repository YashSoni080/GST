import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
import { draftNoticeLegalReply } from "../services/aiAssistant.js";

const router = Router();
router.use(requireAuth);

router.get("/", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const { status, type } = req.query;
    const filter = { companyId: req.user.companyId };
    if (typeof status === "string" && status) filter.status = status;
    if (typeof type === "string" && type) filter.type = type;
    const notices = await Notice.find(filter).sort({ issueDate: -1 }).lean();
    res.json({ notices });
  } catch (err) { next(err); }
});

router.get("/:id", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const notice = await Notice.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!notice) return res.status(404).json({ error: "Notice not found" });
    res.json(notice);
  } catch (err) { next(err); }
});

router.post("/", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const notice = await Notice.create({
      ...req.body,
      companyId: req.user.companyId,
    });
    await audit(req, "create", "notice", notice._id, { noticeNo: notice.noticeNo, type: notice.type });
    res.status(201).json(notice);
  } catch (err) { next(err); }
});

// Section 4.4: AI Legal Response Drafting Assistant
router.post("/:id/draft-reply", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice, Company, Purchase, GSTR } = req.app.locals.models;
    const notice = await Notice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!notice) return res.status(404).json({ error: "Notice not found" });

    const company = await Company.findById(req.user.companyId);

    const draft = draftNoticeLegalReply(notice, company);
    notice.aiDraftedReply = draft;
    notice.status = "drafting";
    await notice.save();

    await audit(req, "draft_reply", "notice", notice._id, { noticeNo: notice.noticeNo });
    res.json({ notice, draft });
  } catch (err) { next(err); }
});

// Record DRC-03 voluntary payment or settle notice
router.post("/:id/settle-drc03", can("returns:submit"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const { amountPaid, cause = "Voluntary payment under Section 73(5)" } = req.body;
    const notice = await Notice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!notice) return res.status(404).json({ error: "Notice not found" });

    const arn = `DRC03-${Date.now().toString().slice(-6)}`;
    notice.status = "settled_drc03";
    notice.drc03Details = {
      arn,
      date: new Date(),
      amountPaid: Number(amountPaid) || notice.demandAmount?.tax || 0,
      cause,
    };
    await notice.save();

    await audit(req, "settle_drc03", "notice", notice._id, { noticeNo: notice.noticeNo, arn, amountPaid });
    res.json(notice);
  } catch (err) { next(err); }
});

// PRD Section 2.3: Notice Ingestion & Automated Text Parsing / Ticketing
router.post("/ingest", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const { rawText, source = "portal_api" } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(422).json({ error: "Raw notice text or document extract is required" });
    }

    const text = String(rawText);

    // 1. Extract Notice Type
    let type = "ASMT-10";
    if (/DRC-?01A/i.test(text)) type = "DRC-01A";
    else if (/DRC-?01/i.test(text)) type = "DRC-01";
    else if (/ASMT-?10/i.test(text)) type = "ASMT-10";
    else if (/SCN|Show Cause/i.test(text)) type = "SCN";
    else if (/GSTR-?3A/i.test(text)) type = "GSTR-3A";

    // 2. Extract Section
    let section = "Section 61";
    if (/Section 74/i.test(text)) section = "Section 74";
    else if (/Section 73/i.test(text)) section = "Section 73";
    else if (/Section 61/i.test(text)) section = "Section 61";
    else if (/Section 129/i.test(text)) section = "Section 129";

    // 3. Extract Notice Reference Number
    const refMatch = text.match(/(?:Ref No|Notice No|Reference No)[:.\s]+([A-Z0-9\/-]+)/i) ||
                     text.match(/([A-Z]{2,4}\/[A-Z0-9\/-]+)/);
    const noticeNo = refMatch ? refMatch[1].trim() : `NOT-${Date.now().toString().slice(-6)}`;

    // 4. Extract Tax Demands
    const taxMatch = text.match(/(?:Tax Demand|Tax Amount|Tax Payable)[:.\s₹Rs]+([\d,]+)/i);
    const interestMatch = text.match(/(?:Interest)[:.\s₹Rs]+([\d,]+)/i);
    const penaltyMatch = text.match(/(?:Penalty)[:.\s₹Rs]+([\d,]+)/i);

    const parseNum = (m) => (m ? Number(m[1].replace(/,/g, "")) : 0);
    const tax = parseNum(taxMatch) || 45000;
    const interest = parseNum(interestMatch) || Math.round(tax * 0.18 * (45 / 365));
    const penalty = parseNum(penaltyMatch) || (section === "Section 74" ? tax : Math.max(10000, Math.round(tax * 0.1)));
    const total = tax + interest + penalty;

    // 5. Extract Allegation Type
    let allegationType = "ITC_3B_VS_2B_MISMATCH";
    if (/2B|GSTR-?2B|excess ITC/i.test(text)) allegationType = "ITC_3B_VS_2B_MISMATCH";
    else if (/GSTR-?1.*3B|turnover difference|outward mismatch/i.test(text)) allegationType = "GSTR1_VS_3B_TURNOVER";
    else if (/17\(5\)|ineligible|motor vehicle/i.test(text)) allegationType = "SECTION_17_5_INELIGIBLE_CLAIM";
    else if (/Rule 37|180 days/i.test(text)) allegationType = "RULE_37_180_DAYS_NON_REVERSAL";
    else if (/E-?way bill|EWB/i.test(text)) allegationType = "EWB_VS_GSTR1_DISCREPANCY";
    else if (/cancelled supplier/i.test(text)) allegationType = "CANCELLED_SUPPLIER_ITC";

    // 6. Dates & Deadlines
    const issueDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30-day statutory response window

    const ticketId = `TKT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const notice = await Notice.create({
      companyId: req.user.companyId,
      noticeNo,
      type,
      section,
      ticketId,
      assignedToName: "Tax Compliance Lead",
      priority: total > 100000 || section === "Section 74" ? "critical" : "high",
      issueDate,
      dueDate,
      financialYear: "2025-26",
      period: "2026-08",
      allegationType,
      rawNoticeText: text,
      ingestionSource: source,
      description: text.slice(0, 300).trim() || `Discrepancy notice issued under ${section}`,
      demandAmount: { tax, interest, penalty, total },
      status: "pending",
      comments: [
        {
          author: "System (Portal Ingestion)",
          text: `Auto-ingested notice via ${source}. Extracted ${type} under ${section} with total liability of ₹${total.toLocaleString("en-IN")}.`,
          createdAt: new Date(),
        },
      ],
    });

    await audit(req, "ingest_notice", "notice", notice._id, { noticeNo, type, ticketId });
    res.status(201).json({ success: true, notice, message: `Created Ticket ${ticketId} for Notice ${noticeNo}` });
  } catch (err) { next(err); }
});

// Update ticket status, priority or assignee
router.patch("/:id/ticket", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const { status, priority, assignedToName } = req.body;
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (assignedToName) update.assignedToName = assignedToName;

    const notice = await Notice.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: update },
      { new: true }
    );
    if (!notice) return res.status(404).json({ error: "Notice ticket not found" });
    res.json(notice);
  } catch (err) { next(err); }
});

// Add comment to notice ticket thread
router.post("/:id/comments", can("audit:read"), async (req, res, next) => {
  try {
    const { Notice } = req.app.locals.models;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(422).json({ error: "Comment text required" });

    const notice = await Notice.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!notice) return res.status(404).json({ error: "Notice ticket not found" });

    notice.comments.push({
      author: req.user.name || "User",
      text: text.trim(),
      createdAt: new Date(),
    });
    await notice.save();

    res.json(notice);
  } catch (err) { next(err); }
});

export default router;
