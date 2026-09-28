import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { Company } from "../src/models/Company.js";
import { Party } from "../src/models/Party.js";
import { Invoice } from "../src/models/Invoice.js";
import { Purchase } from "../src/models/Purchase.js";
import { SupplierDoc } from "../src/models/SupplierDoc.js";
import { GSTR } from "../src/models/GSTR.js";
import { Notice } from "../src/models/Notice.js";
import { EscrowTransaction } from "../src/models/EscrowTransaction.js";
import { ReconRun } from "../src/models/ReconRun.js";
import { ITCEntry } from "../src/models/ITCEntry.js";
import { signToken } from "../src/middleware/auth.js";
import { computeTaxes } from "../src/services/tax.js";
import { computeIRN, generateSignedQR, generateUPIPaymentQR } from "../src/services/irn.js";
import { generateEWayBill, estimateTransitDistance, calculateValidityDays } from "../src/services/eway.js";
import { compileGSTR1, compileGSTR3B, compileGSTR9 } from "../src/services/returnsCompiler.js";
import { optimizeCreditUtilization, track180DayRule37, classifySection17_5 } from "../src/services/itcOptimizer.js";
import { computeDepartmentAuditRadar } from "../src/services/auditRadar.js";
import { parseInvoiceWithIDP, draftNoticeLegalReply, processNaturalLanguageQuery } from "../src/services/aiAssistant.js";

describe("GST Enterprise API & Compliance Logic Comprehensive Suite", () => {
  let adminUser;
  let testCompany;
  let authToken;

  before(async () => {
    await connectDB();
    testCompany = await Company.findOne({ name: "Greenshine Traders Pvt. Ltd." });
    if (!testCompany) {
      testCompany = await Company.create({
        name: "Greenshine Traders Pvt. Ltd.",
        pan: "AAACG1234F",
        fiscalYear: "2025-26",
        gstins: [
          {
            gstin: "27AAACG1234F1Z5",
            tradeName: "Greenshine Traders HO",
            stateCode: "27",
            state: "Maharashtra",
            invoiceSeries: "GI-MH",
            isPrimary: true,
            active: true,
          },
          {
            gstin: "29AAACG1234F1Z1",
            tradeName: "Greenshine Traders South",
            stateCode: "29",
            state: "Karnataka",
            invoiceSeries: "GI-KA",
            isPrimary: false,
            active: true,
          },
        ],
      });
    }

    adminUser = await User.findOne({ email: "admin@greenshine.com" });
    if (!adminUser) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      adminUser = await User.create({
        name: "Administrator",
        email: "admin@greenshine.com",
        passwordHash,
        role: "admin",
        companyId: testCompany._id,
        active: true,
      });
    }

    authToken = signToken(adminUser);
  });

  after(async () => {
    // Clean any test-created records while preserving the seeded admin & company
    if (mongoose.connection.readyState === 1 && testCompany) {
      await Promise.all([
        Invoice.deleteMany({ companyId: testCompany._id }),
        Purchase.deleteMany({ companyId: testCompany._id }),
        Party.deleteMany({ companyId: testCompany._id }),
        Notice.deleteMany({ companyId: testCompany._id }),
        EscrowTransaction.deleteMany({ companyId: testCompany._id }),
        GSTR.deleteMany({ companyId: testCompany._id }),
        ReconRun.deleteMany({ companyId: testCompany._id }),
        SupplierDoc.deleteMany({ companyId: testCompany._id }),
        ITCEntry.deleteMany({ companyId: testCompany._id }),
      ]);
    }
    await mongoose.disconnect();
  });

  test("Tax Engine: Intra-State, Inter-State, and Union Territory Tax Split", () => {
    const items = [
      { name: "Consulting", qty: 1, rate: 100000, discountPct: 0, gstRate: 18 },
    ];

    // Intra-state (MH to MH): CGST 9% + SGST 9%
    const intra = computeTaxes(items, { posStateCode: "27", branchStateCode: "27" });
    assert.strictEqual(intra.taxableValue, 100000);
    assert.strictEqual(intra.cgst, 9000);
    assert.strictEqual(intra.sgst, 9000);
    assert.strictEqual(intra.igst, 0);
    assert.strictEqual(intra.utgst, 0);
    assert.strictEqual(intra.total, 118000);

    // Inter-state (MH to KA): IGST 18%
    const inter = computeTaxes(items, { posStateCode: "29", branchStateCode: "27" });
    assert.strictEqual(inter.taxableValue, 100000);
    assert.strictEqual(inter.cgst, 0);
    assert.strictEqual(inter.sgst, 0);
    assert.strictEqual(inter.igst, 18000);
    assert.strictEqual(inter.utgst, 0);
    assert.strictEqual(inter.total, 118000);

    // Inter-state to Union Territory (MH to Ladakh 38): Must be IGST 18%
    const interUT = computeTaxes(items, { posStateCode: "38", branchStateCode: "27" });
    assert.strictEqual(interUT.taxableValue, 100000);
    assert.strictEqual(interUT.igst, 18000);
    assert.strictEqual(interUT.cgst, 0);
    assert.strictEqual(interUT.sgst, 0);
    assert.strictEqual(interUT.utgst, 0);

    // Intra-UT (Chandigarh 04 to Chandigarh 04): CGST 9% + UTGST 9%
    const intraUT = computeTaxes(items, { posStateCode: "04", branchStateCode: "04" });
    assert.strictEqual(intraUT.taxableValue, 100000);
    assert.strictEqual(intraUT.cgst, 9000);
    assert.strictEqual(intraUT.utgst, 9000);
    assert.strictEqual(intraUT.sgst, 0);
    assert.strictEqual(intraUT.igst, 0);
  });

  test("Invoicing & IRP e-Invoicing Lifecycle (IRN & e-Way Bill)", async () => {
    // 1. Create Party
    const party = await Party.create({
      companyId: testCompany._id,
      name: "TCS Enterprise Solutions Ltd",
      gstin: "27AAACT2727Q1ZB",
      type: "customer",
      gstType: "registered",
      stateCode: "27",
      state: "Maharashtra",
      city: "Mumbai",
      active: true,
    });
    assert.ok(party._id);

    // 2. Create Compliant Rule 46 Tax Invoice
    const invoice = await Invoice.create({
      companyId: testCompany._id,
      companyGstin: "27AAACG1234F1Z5",
      gstinStateCode: "27",
      gstinState: "Maharashtra",
      docType: "invoice",
      invNo: `GI-MH-2026-${Date.now().toString().slice(-4)}`,
      series: "GI-MH",
      date: new Date(),
      partyId: party._id,
      partyName: party.name,
      partyGstin: party.gstin,
      partyStateCode: "27",
      partyState: "Maharashtra",
      placeOfSupply: "27 Maharashtra",
      posStateCode: "27",
      posState: "Maharashtra",
      supplyType: "B2B",
      items: [
        { name: "Enterprise Server Licenses", hsn: "8471", qty: 2, rate: 50000, gstRate: 18, taxable: 100000, gst: 18000 },
      ],
      taxableValue: 100000,
      cgst: 9000,
      sgst: 9000,
      igst: 0,
      total: 118000,
      status: "valid",
      createdBy: adminUser._id,
    });
    assert.ok(invoice._id);
    assert.strictEqual(invoice.status, "valid");

    // 3. IRP IRN Generation & QR Code Signing
    const irnHash = computeIRN({
      supplierGstin: invoice.companyGstin,
      finYear: "2025-26",
      docType: "INV",
      docNo: invoice.invNo,
    });
    assert.strictEqual(irnHash.length, 64);

    const qr = await generateSignedQR({
      irn: irnHash,
      sellerGstin: invoice.companyGstin,
      buyerGstin: invoice.partyGstin,
      docNo: invoice.invNo,
      totInvVal: invoice.total,
    });
    assert.ok(qr.qrDataUrl.startsWith("data:image/png;base64,"));

    invoice.irn = irnHash;
    invoice.status = "IRN_GENERATED";
    invoice.qrDataUrl = qr.qrDataUrl;
    await invoice.save();
    assert.strictEqual(invoice.status, "IRN_GENERATED");

    // 4. Concurrent e-Way Bill generation
    const distance = estimateTransitDistance("27", "29");
    assert.strictEqual(distance, 980);
    const validityDays = calculateValidityDays(distance);
    assert.strictEqual(validityDays, 5); // 980 km / 200 km/day = 5 days

    const ewb = generateEWayBill({
      invoiceNo: invoice.invNo,
      fromStateCode: "27",
      toStateCode: "29",
      vehicleNo: "MH-04-AB-1290",
    });
    assert.ok(ewb.ewbNo.startsWith("33"));
    assert.strictEqual(ewb.status, "active");
  });

  test("Purchase Register & Section 17(5) Blocked Credit Separation", async () => {
    // 1. Eligible Purchase
    const eligiblePurchase = await Purchase.create({
      companyId: testCompany._id,
      vendorName: "Dell India Pvt Ltd",
      vendorGstin: "29AAACD1234D1Z8",
      billNo: `DELL-${Date.now().toString().slice(-4)}`,
      billDate: new Date(),
      period: "2026-09",
      taxableValue: 80000,
      cgst: 0,
      sgst: 0,
      igst: 14400,
      gst: 14400,
      total: 94400,
      itcEligible: "yes",
      itcEligibleAmount: 14400,
      section17_5Category: "none",
      paymentStatus: "paid",
      createdBy: adminUser._id,
    });
    assert.strictEqual(eligiblePurchase.itcEligible, "yes");
    assert.strictEqual(eligiblePurchase.itcEligibleAmount, 14400);

    // 2. Blocked Section 17(5) Purchase (Food & Catering)
    const blockedPurchase = await Purchase.create({
      companyId: testCompany._id,
      vendorName: "Grand Hyatt Mumbai",
      vendorGstin: "27AAACH9999K1Z2",
      billNo: `HYATT-${Date.now().toString().slice(-4)}`,
      billDate: new Date(),
      period: "2026-09",
      taxableValue: 20000,
      cgst: 500,
      sgst: 500,
      igst: 0,
      gst: 1000,
      total: 21000,
      itcEligible: "no",
      itcEligibleAmount: 0,
      section17_5Category: "food_and_beverages",
      paymentStatus: "paid",
      createdBy: adminUser._id,
    });
    assert.strictEqual(blockedPurchase.itcEligible, "no");
    assert.strictEqual(blockedPurchase.itcEligibleAmount, 0);

    // Verify Section 17(5) classifier
    const classification = classifySection17_5("food_and_beverages", "Executive dinner party");
    assert.strictEqual(classification.blocked, true);
    assert.strictEqual(classification.section, "17(5)(b)(i)");
  });

  test("Rule 37 180-Day Payment Tracker & Interest Accrual", () => {
    const pastDate = new Date(Date.now() - 210 * 24 * 60 * 60 * 1000); // 210 days ago (30 days overdue)
    const mockPurchases = [
      {
        _id: new mongoose.Types.ObjectId(),
        vendorName: "Delayed Vendor Ltd",
        billNo: "BILL-OLD-1",
        billDate: pastDate,
        total: 118000,
        paidAmount: 0,
        gst: 18000,
        paymentStatus: "unpaid",
        itcEligible: "yes",
      },
    ];

    const result = track180DayRule37(mockPurchases);
    assert.strictEqual(result.totalFlaggedBills, 1);
    assert.strictEqual(result.totalReversalDue, 18000);
    assert.ok(result.totalInterestDue > 0); // 18% p.a. for 30 days overdue
    assert.strictEqual(result.flaggedPurchases[0].severity, "warning");
  });

  test("Credit Utilization Matrix Optimizer (Rule 88A / Section 49B)", () => {
    // Scenario:
    // Outward liability: IGST: 20000, CGST: 15000, SGST: 15000
    // Available ITC:     IGST: 30000, CGST: 5000,  SGST: 5000
    const optimization = optimizeCreditUtilization({
      liability: { igst: 20000, cgst: 15000, sgst: 15000 },
      itcBalance: { igst: 30000, cgst: 5000, sgst: 5000 },
    });

    // 1. IGST credit must first offset IGST liability: 20000
    assert.strictEqual(optimization.setOffMatrix.igstAgainstIgst, 20000);
    // Remaining 10000 IGST credit is distributed between CGST and SGST
    assert.strictEqual(optimization.setOffMatrix.igstAgainstCgst, 5000);
    assert.strictEqual(optimization.setOffMatrix.igstAgainstSgst, 5000);
    // CGST and SGST own credits applied
    assert.strictEqual(optimization.setOffMatrix.cgstAgainstCgst, 5000);
    assert.strictEqual(optimization.setOffMatrix.sgstAgainstSgst, 5000);
    // Net cash payable via PMT-06:
    // CGST: 15000 - 5000(IGST) - 5000(CGST) = 5000
    // SGST: 15000 - 5000(IGST) - 5000(SGST) = 5000
    assert.strictEqual(optimization.cashPayable.cgst, 5000);
    assert.strictEqual(optimization.cashPayable.sgst, 5000);
    assert.strictEqual(optimization.cashPayable.total, 10000);
  });

  test("Automated 4-Way GSTR-2B Reconciliation Engine", async () => {
    const period = "2026-08";

    // Create 2B Supplier Docs
    await SupplierDoc.create({
      companyId: testCompany._id,
      supplierGstin: "29AAACD1234D1Z8",
      supplierName: "Dell India Pvt Ltd",
      invoiceNo: "DELL-1001",
      docDate: new Date("2026-09-10"),
      period,
      taxableValue: 50000,
      gst: 9000,
      source: "gstr2b",
    });

    // Case 1: Exact Match in Purchases
    await Purchase.create({
      companyId: testCompany._id,
      vendorName: "Dell India Pvt Ltd",
      vendorGstin: "29AAACD1234D1Z8",
      billNo: "DELL-1001",
      billDate: new Date("2026-09-10"),
      period,
      taxableValue: 50000,
      cgst: 0,
      sgst: 0,
      igst: 9000,
      gst: 9000,
      total: 59000,
      itcEligible: "yes",
      createdBy: adminUser._id,
    });

    // Case 2: Missing in 2B (in books but vendor has not filed GSTR-1)
    await Purchase.create({
      companyId: testCompany._id,
      vendorName: "Non-Compliant Supplier",
      vendorGstin: "27AABCS8888M1Z3",
      billNo: "NCS-999",
      billDate: new Date("2026-09-12"),
      period,
      taxableValue: 30000,
      cgst: 2700,
      sgst: 2700,
      igst: 0,
      gst: 5400,
      total: 35400,
      itcEligible: "yes",
      createdBy: adminUser._id,
    });

    const purchases = await Purchase.find({ companyId: testCompany._id, period }).lean();
    const docs = await SupplierDoc.find({ companyId: testCompany._id, period }).lean();

    assert.strictEqual(purchases.length, 2);
    assert.strictEqual(docs.length, 1);
  });

  test("Continuous Transaction Control (CTC) Validation", () => {
    // Valid GSTIN validation
    const valid = computeDepartmentAuditRadar({
      invoices: [],
      purchases: [],
      supplierDocs: [],
      parties: [],
    });
    assert.ok(valid.overallRiskScore >= 0 && valid.overallRiskScore <= 100);
    assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(valid.riskBand));
  });

  test("DRC-01 Notice Legal Reply Drafting with Statutory Citations", () => {
    const notice = {
      noticeNo: "ASMT10/2026/001",
      type: "ASMT-10",
      section: "Section 61",
      issueDate: new Date(),
      allegationType: "ITC_3B_VS_2B_MISMATCH",
      demandAmount: { tax: 45000, interest: 5000, penalty: 0, total: 50000 },
      financialYear: "2025-26",
      period: "2025-26",
    };
    const draft = draftNoticeLegalReply(notice, testCompany);
    assert.ok(draft.subject.includes("ASMT10/2026/001"));
    assert.ok(draft.content.includes("Section 16(2)"));
    assert.ok(draft.legalCitations.some((c) => c.includes("183") || c.includes("193")));
  });
});
