import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { computeTaxes } from "../src/services/tax.js";
import { computeIRN, generateSignedQR, generateUPIPaymentQR } from "../src/services/irn.js";
import { generateEWayBill, estimateTransitDistance, calculateValidityDays } from "../src/services/eway.js";
import { compileGSTR1, compileGSTR3B, compileGSTR9 } from "../src/services/returnsCompiler.js";
import { optimizeCreditUtilization, track180DayRule37, classifySection17_5 } from "../src/services/itcOptimizer.js";
import { computeDepartmentAuditRadar, computeSupplierHealthScores } from "../src/services/auditRadar.js";
import { parseInvoiceWithIDP, draftNoticeLegalReply, processNaturalLanguageQuery } from "../src/services/aiAssistant.js";
import { validateGSTIN, parseGSTIN } from "../src/services/gstin.js";

import { Company } from "../src/models/Company.js";
import { Invoice } from "../src/models/Invoice.js";
import { Purchase } from "../src/models/Purchase.js";
import { ITCEntry } from "../src/models/ITCEntry.js";
import { GSTR } from "../src/models/GSTR.js";
import { Notice } from "../src/models/Notice.js";
import { Party } from "../src/models/Party.js";

describe("2026 GST Feature Roadmap Comprehensive Test Suite", () => {
  before(async () => {
    try {
      await connectDB();
    } catch (_) {
      // Unit tests in this suite do not require an active database connection
    }
  });

  after(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });

  test("Tier 1: Dynamic GSTIN Lookup and Validation", () => {
    const valid = validateGSTIN("27AAACG1234F1Z5");
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.state, "Maharashtra");

    const parsed = parseGSTIN("27AAACG1234F1Z5");
    assert.strictEqual(parsed.pan, "AAACG1234F");
    assert.strictEqual(parsed.stateCode, "27");

    const invalid = validateGSTIN("INVALID_GSTIN");
    assert.strictEqual(invalid.valid, false);
  });

  test("Tier 1 & 2: Invoicing, Tax Engine, IRN & e-Way Bill", async () => {
    const items = [
      { name: "Server", hsn: "8471", qty: 2, rate: 50000, discountPct: 0, gstRate: 18 },
    ];
    // Intra-state supply (27 to 27) -> CGST + SGST
    const taxes = computeTaxes(items, { posStateCode: "27", branchStateCode: "27" });
    assert.strictEqual(taxes.taxableValue, 100000);
    assert.strictEqual(taxes.cgst, 9000);
    assert.strictEqual(taxes.sgst, 9000);
    assert.strictEqual(taxes.igst, 0);
    assert.strictEqual(taxes.total, 118000);

    // Compute IRN
    const irn = computeIRN({ supplierGstin: "27AAACG1234F1Z5", finYear: "2025-26", docNo: "TEST-001" });
    assert.strictEqual(irn.length, 64);

    // Generate Signed QR Code
    const qrResult = await generateSignedQR({
      irn,
      sellerGstin: "27AAACG1234F1Z5",
      docNo: "TEST-001",
      totInvVal: 118000,
    });
    assert.ok(qrResult.qrDataUrl.startsWith("data:image/png;base64,"));

    // Dynamic UPI QR Code
    const upiResult = await generateUPIPaymentQR({ amount: 118000, invoiceNo: "TEST-001" });
    assert.ok(upiResult.upiString.includes("upi://pay"));
    assert.ok(upiResult.upiQrDataUrl.startsWith("data:image/png;base64,"));

    // E-Way Bill Generation & Distance calculation
    const distance = estimateTransitDistance("27", "29");
    assert.ok(distance > 0);
    const validityDays = calculateValidityDays(distance);
    assert.ok(validityDays >= 1);

    const ewb = generateEWayBill({ invoiceNo: "TEST-001", fromStateCode: "27", toStateCode: "29" });
    assert.ok(ewb.ewbNo.startsWith("33"));
    assert.strictEqual(ewb.status, "active");
  });

  test("Tier 1 & 3: Statutory Returns Compiler (GSTR-1, GSTR-3B, GSTR-9)", () => {
    const mockInvoices = [
      {
        invNo: "INV-1",
        docType: "invoice",
        date: new Date(),
        supplyType: "B2B",
        partyGstin: "27AABCA1234A1Z5",
        partyName: "Acme",
        posStateCode: "27",
        gstinStateCode: "27",
        taxableValue: 100000,
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        total: 118000,
        items: [{ name: "Hardware", hsn: "8471", qty: 1, taxable: 100000, gstRate: 18 }],
      },
    ];

    const mockPurchases = [
      {
        vendorName: "Sterling",
        vendorGstin: "24AABCS9999C1Z0",
        billNo: "SE-101",
        billDate: new Date(),
        cgst: 5000,
        sgst: 5000,
        igst: 0,
        gst: 10000,
        itcEligible: "yes",
        section17_5Category: "none",
      },
    ];

    const gstr1 = compileGSTR1(mockInvoices, { period: "2026-09", gstin: "27AAACG1234F1Z5" });
    assert.strictEqual(gstr1.summary.totalInvoices, 1);
    assert.strictEqual(gstr1.summary.taxableValue, 100000);
    assert.strictEqual(gstr1.sections.b2b.length, 1);

    const gstr3b = compileGSTR3B(mockInvoices, mockPurchases, { period: "2026-09", gstin: "27AAACG1234F1Z5" });
    assert.strictEqual(gstr3b.summary.outwardTurnover, 100000);
    assert.strictEqual(gstr3b.summary.cashTaxPayable, 8000); // 18000 liability - 10000 ITC = 8000

    const gstr9 = compileGSTR9({ invoices: mockInvoices, purchases: mockPurchases, financialYear: "2025-26" });
    assert.strictEqual(gstr9.table4_outward.totalTaxable, 100000);
    assert.strictEqual(gstr9.table6_itc.table6A_totalFrom3B, 10000);
  });

  test("Tier 3: Dynamic ITC Optimization & Rule 37 180-Day Tracker", () => {
    // Credit utilization matrix: Section 49A/49B
    const opt = optimizeCreditUtilization({
      liability: { igst: 10000, cgst: 15000, sgst: 15000 },
      itcBalance: { igst: 20000, cgst: 5000, sgst: 5000 },
    });
    // IGST credit (20k) pays 10k IGST, remaining 10k splits across CGST & SGST (5k each),
    // then CGST/SGST credit (5k each) pays 5k each of remaining CGST & SGST -> Total cash payable: 10,000 (saving 30,000)
    assert.strictEqual(opt.cashPayable.total, 10000);
    assert.strictEqual(opt.cashOutlaySaved, 30000);


    // Section 17(5) classification
    const vehicle = classifySection17_5("motor_vehicles", "Purchase of corporate car");
    assert.strictEqual(vehicle.blocked, true);
    assert.strictEqual(vehicle.section, "17(5)(a)");

    // Rule 37 180-day tracker
    const oldBill = {
      vendorName: "Old Supplier",
      vendorGstin: "27AAAAA0000A1Z1",
      billNo: "OLD-1",
      billDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days old
      total: 118000,
      gst: 18000,
      paymentStatus: "unpaid",
      itcEligible: "yes",
    };
    const rule37 = track180DayRule37([oldBill]);
    assert.strictEqual(rule37.totalFlaggedBills, 1);
    assert.strictEqual(rule37.totalReversalDue, 18000);
    assert.ok(rule37.totalInterestDue > 0);
  });

  test("Tier 3: Risk Assessment & Predictive Audit Radar", () => {
    const radar = computeDepartmentAuditRadar({
      invoices: [{ status: "cancelled" }, { status: "cancelled" }, { status: "valid" }],
      purchases: [{ vendorGstin: "27A", billNo: "1", gst: 50000, taxableValue: 100000 }],
      supplierDocs: [],
    });
    assert.ok(radar.overallRiskScore > 20);
    assert.ok(radar.anomalies.length > 0);
  });

  test("Tier 3: AI Legal Notice Reply Drafting Assistant", () => {
    const notice = {
      noticeNo: "ASMT10/2026/01",
      allegationType: "ITC_3B_VS_2B_MISMATCH",
      demandAmount: { tax: 50000 },
      financialYear: "2025-26",
      issueDate: new Date(),
    };
    const reply = draftNoticeLegalReply(notice, { name: "Greenshine Traders" });
    assert.ok(reply.legalCitations.some((c) => c.includes("183/15/2022-GST")));
    assert.ok(reply.content.includes("Greenshine Traders"));
  });

  test("Tier 4: AI IDP Invoice Parser with Math Verification", () => {
    const raw = `
      Invoice from: Tech Corp
      GSTIN: 27AABCT1234M1Z8
      Inv No: TC-8891
      Date: 2026-09-15
      Network Switches 8517 2 25000
    `;
    const parsed = parseInvoiceWithIDP(raw);
    assert.strictEqual(parsed.vendorGstin, "27AABCT1234M1Z8");
    assert.strictEqual(parsed.billNo, "TC-8891");
    assert.strictEqual(parsed.taxableValue, 50000);
    assert.strictEqual(parsed.mathValidation.passed, true);
  });

  test("Tier 4: Conversational Compliance Assistant (processNaturalLanguageQuery)", async () => {
    const mockModels = {
      Invoice: {
        find: () => ({ lean: async () => [{ invNo: "INV-1", taxableValue: 100000, cgst: 9000, sgst: 9000, igst: 0, total: 118000, status: "valid" }] }),
        countDocuments: async () => 1,
      },
      Purchase: {
        find: () => ({ lean: async () => [] }),
        countDocuments: async () => 0,
      },
      ITCEntry: {
        find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ type: "availed", cgst: 5000, sgst: 5000, igst: 10000 }] }) }) }),
      },
      Notice: {
        find: () => ({ lean: async () => [] }),
        countDocuments: async () => 0,
      },
      Party: {
        find: () => ({ lean: async () => [] }),
        countDocuments: async () => 0,
      },
      GSTR: {
        find: () => ({ lean: async () => [] }),
        countDocuments: async () => 0,
      },
    };

    // Test greeting
    const greeting = await processNaturalLanguageQuery("hello copilot", mockModels, "comp1");
    assert.ok(greeting.answer.includes("AI GST Compliance Copilot"));

    // Test IGST balance (Suggestion #1)
    const balance = await processNaturalLanguageQuery("What is our unutilized IGST balance as of today?", mockModels, "comp1");
    assert.ok(balance.answer.includes("IGST"));
    assert.strictEqual(balance.metrics[0].label, "Unutilized IGST");

    // Test Blocked Credit Section 17(5) (Suggestion #2)
    const sec17 = await processNaturalLanguageQuery("Show all vendors with blocked credit under Section 17(5)", mockModels, "comp1");
    assert.ok(sec17.answer.includes("Section 17(5)"));

    // Test Rule 37 180 days (Suggestion #3)
    const rule37 = await processNaturalLanguageQuery("Are there any unpaid vendor bills older than 180 days under Rule 37?", mockModels, "comp1");
    assert.ok(rule37.answer.includes("Rule 37"));

    // Test Pending IRN (Suggestion #4)
    const irn = await processNaturalLanguageQuery("What invoices are currently pending IRN generation?", mockModels, "comp1");
    assert.ok(irn.answer.includes("IRN") || irn.answer.includes("compliant"));

    // Test Audit Risk Score (Suggestion #5)
    const risk = await processNaturalLanguageQuery("What is our current Department Audit Risk Score and notices status?", mockModels, "comp1");
    assert.ok(risk.answer.includes("Department Audit Risk Score"));
    assert.ok(risk.metrics.some((m) => m.label === "Audit Risk Score"));

    // Test Turnover
    const turnover = await processNaturalLanguageQuery("What is our turnover?", mockModels, "comp1");
    assert.ok(turnover.answer.includes("turnover"));
    assert.strictEqual(turnover.metrics[0].label, "Taxable Turnover");

    // Test E-Way bills
    const eway = await processNaturalLanguageQuery("What is the E-Way bill threshold?", mockModels, "comp1");
    assert.ok(eway.answer.includes("50,000"));
  });
});

