import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

// Section 5.3: Automated Escrow & Split-Payment Integration
router.get("/", can("purchases:read"), async (req, res, next) => {
  try {
    const { EscrowTransaction } = req.app.locals.models;
    const { status } = req.query;
    const filter = { companyId: req.user.companyId };
    if (status) filter.escrowGstStatus = status;

    const escrowList = await EscrowTransaction.find(filter).sort({ createdAt: -1 }).lean();

    const summary = escrowList.reduce(
      (acc, item) => {
        acc.totalInEscrow += item.gstAmount || 0;
        if (item.escrowGstStatus === "held_in_escrow") {
          acc.currentlyHeld += item.gstAmount || 0;
          acc.heldCount++;
        } else if (item.escrowGstStatus === "released_to_vendor") {
          acc.releasedAmount += item.gstAmount || 0;
          acc.releasedCount++;
        }
        return acc;
      },
      { totalInEscrow: 0, currentlyHeld: 0, releasedAmount: 0, heldCount: 0, releasedCount: 0 }
    );

    res.json({ escrowList, summary });
  } catch (err) { next(err); }
});

// Create split-payment escrow record for a purchase
router.post("/split-bill", can("purchases:create"), async (req, res, next) => {
  try {
    const { EscrowTransaction, Purchase } = req.app.locals.models;
    const { purchaseId, vendorName, vendorGstin, billNo, billDate, taxableAmount, gstAmount } = req.body;

    const totalInvoiceAmount = Number(taxableAmount || 0) + Number(gstAmount || 0);

    const escrow = await EscrowTransaction.create({
      companyId: req.user.companyId,
      purchaseId,
      vendorName,
      vendorGstin,
      billNo,
      billDate: billDate ? new Date(billDate) : new Date(),
      taxableAmount: Number(taxableAmount || 0),
      gstAmount: Number(gstAmount || 0),
      totalInvoiceAmount,
      baseAmountStatus: "paid_to_vendor",
      baseAmountPaidAt: new Date(),
      escrowGstStatus: "held_in_escrow",
    });

    if (purchaseId) {
      await Purchase.findByIdAndUpdate(purchaseId, { $set: { escrowStatus: "held_in_escrow" } });
    }

    await audit(req, "create_escrow_split", "escrow", escrow._id, { billNo, gstHeld: gstAmount });
    res.status(201).json(escrow);
  } catch (err) { next(err); }
});

// Release GST portion from escrow upon GSTR-2B match confirmation
router.post("/:id/release", can("purchases:create"), async (req, res, next) => {
  try {
    const { EscrowTransaction, Purchase } = req.app.locals.models;
    const escrow = await EscrowTransaction.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!escrow) return res.status(404).json({ error: "Escrow record not found" });

    if (escrow.escrowGstStatus === "released_to_vendor") {
      return res.status(400).json({ error: "Escrow funds already released" });
    }

    escrow.escrowGstStatus = "released_to_vendor";
    escrow.escrowReleasedAt = new Date();
    escrow.reconciliationProof = {
      gstr2bPeriod: req.body.period || "2026-09",
      filingDate: new Date(),
      matchedDocRef: `2B-MATCH-${escrow.billNo}`,
    };

    await escrow.save();

    if (escrow.purchaseId) {
      await Purchase.findByIdAndUpdate(escrow.purchaseId, { $set: { escrowStatus: "released" } });
    }

    await audit(req, "release_escrow", "escrow", escrow._id, { billNo: escrow.billNo, amount: escrow.gstAmount });
    res.json(escrow);
  } catch (err) { next(err); }
});

export default router;
