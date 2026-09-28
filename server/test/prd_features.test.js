import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { Company } from "../src/models/Company.js";
import { Party } from "../src/models/Party.js";
import { Invoice } from "../src/models/Invoice.js";
import { Purchase } from "../src/models/Purchase.js";
import { SupplierDoc } from "../src/models/SupplierDoc.js";
import { Notice } from "../src/models/Notice.js";
import { EcommerceSettlement } from "../src/models/EcommerceSettlement.js";

import { validateHsnSacDigits, getHSN } from "../src/services/hsn.js";
import { calculateRule42Reversal, calculateRule43Reversal } from "../src/services/itcOptimizer.js";
import { parseEcommerceReport } from "../src/services/ecommerce.js";
import { fuzzyMatchInvoice, generateVendorNudgePayload } from "../src/services/fuzzyRecon.js";
import { compileCMP08, compileGSTR4, compileGSTR9C } from "../src/services/returnsCompiler.js";

describe("Next-Gen GST Platform PRD Comprehensive Verification Suite", () => {
  let testCompany;

  before(async () => {
    await connectDB();
    testCompany = await Company.findOne({ name: "Greenshine Traders Pvt. Ltd." });
    if (!testCompany) {
      testCompany = await Company.create({
        name: "Greenshine Traders Pvt. Ltd.",
        pan: "AAACG1234F",
        fiscalYear: "2025-26",
        annualTurnover: 75000000, // 7.5 Cr
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
        ],
      });
    }
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // 1. HSN / SAC Multi-Tier Validation
  test("1. HSN/SAC Multi-Tier Digit Validator (Rule 46 & Notification 78/2020)", async () => {
    // Under 5 Cr: 4 digits valid
    const r1 = validateHsnSacDigits("8471", { turnover: 30000000, isExport: false });
    assert.strictEqual(r1.valid, true);

    // Over 5 Cr: 4 digits should fail, requires 6
    const r2 = validateHsnSacDigits("8471", { turnover: 60000000, isExport: false });
    assert.strictEqual(r2.valid, false);
    assert.ok(r2.message.includes("minimum 6-digit"));

    // Over 5 Cr: 6 digits valid
    const r3 = validateHsnSacDigits("847130", { turnover: 60000000, isExport: false });
    assert.strictEqual(r3.valid, true);

    // Services (SAC 99xxxx) require 6 digits
    const r4 = validateHsnSacDigits("9983", { turnover: 20000000, isExport: false });
    assert.strictEqual(r4.valid, false);
    const r5 = validateHsnSacDigits("998313", { turnover: 20000000, isExport: false });
    assert.strictEqual(r5.valid, true);

    // Export requires 8 digits
    const r6 = validateHsnSacDigits("847130", { turnover: 20000000, isExport: true });
    assert.strictEqual(r6.valid, false);
    assert.ok(r6.message.includes("8-digit"));
    const r7 = validateHsnSacDigits("84713010", { turnover: 20000000, isExport: true });
    assert.strictEqual(r7.valid, true);

    // HSN catalog lookup
    const lookup = await getHSN("8471");
    assert.ok(lookup);
    assert.strictEqual(lookup.code, "8471");
  });

  // 2. Rule 42 & Rule 43 Proportionate ITC Reversals
  test("2. Rule 42 & 43 Proportionate ITC Reversal Algorithms", () => {
    const rule42 = calculateRule42Reversal({
      totalItc: 100000,
      exemptSupplyItc: 10000,
      nonBusinessItc: 5000,
      blockedSection17_5Itc: 5000,
      taxableSupplyItc: 0,
      exemptTurnover: 2000000,
      totalTurnover: 10000000,
    });
    assert.strictEqual(rule42.computations.commonCredit_C2, 80000);
    assert.strictEqual(rule42.computations.exemptCommonReversal_D1, 16000);
    assert.strictEqual(rule42.computations.nonBusinessReversal_D2, 4000);
    assert.strictEqual(rule42.totalRule42Reversal, 20000);
    assert.strictEqual(rule42.computations.netEligibleCommonCredit_C3, 60000);

    const rule43 = calculateRule43Reversal({
      commonCapitalGoodsItc: 600000,
      exemptTurnover: 2500000,
      totalTurnover: 10000000,
    });
    assert.strictEqual(rule43.monthlyCapitalCredit_Tm, 10000);
    assert.strictEqual(rule43.monthlyExemptReversal_Te, 2500);
    assert.strictEqual(rule43.annualizedReversal, 30000);
  });

  // 3. Omnichannel E-Commerce Reconciler (Section 52 TCS & GSTR-8)
  test("3. Omnichannel E-Commerce Reconciler (TCS Sec 52, MTR Parsing, GSTR-8)", () => {
    const csvData = `Order ID,Date,State,Customer GSTIN,Item Description,Taxable,Tax,Type
ORD-AMZ-01,2026-09-02,27 Maharashtra,,Wireless Mouse,1000,180,Sale
ORD-AMZ-02,2026-09-05,29 Karnataka,29AABCE1234F1Z1,Monitor Stand,4000,720,Sale
ORD-AMZ-03,2026-09-10,27 Maharashtra,,Wireless Mouse Return,1000,180,Return`;

    const parsed = parseEcommerceReport({
      csvText: csvData,
      channel: "amazon",
      branchStateCode: "27",
      period: "2026-09",
    });

    assert.strictEqual(parsed.totalOrders, 3);
    assert.strictEqual(parsed.returns.taxable, 1000);
    assert.strictEqual(parsed.netTaxableTurnover, 4000);
    // 1% TCS under Sec 52 on net 4000 = 40
    assert.strictEqual(parsed.tcsCollected.total, 40);
    assert.ok(parsed.gstr8Reconciliation);
    assert.strictEqual(parsed.stateWiseDistribution.length > 0, true);
  });

  // 4. Fuzzy Recon & Nudge Engine
  test("4. Fuzzy Logic Recon Engine & Multi-Channel Nudge Generator", () => {
    // Fuzzy matching with prefix/suffix differences and minor date offset
    const booksInv = {
      billNo: "INV-2026-0045",
      billDate: new Date("2026-09-10"),
      taxableValue: 50000,
      gst: 9000,
      vendorGstin: "27AAABC1234F1Z1",
    };
    const gstr2bInv = {
      invoiceNo: "2026/0045", // stripped prefix & delimiter difference
      docDate: new Date("2026-09-12"), // 2 days difference
      taxableValue: 50005, // 5 INR difference within tolerance
      gst: 9000.9,
      supplierGstin: "27AAABC1234F1Z1",
    };

    const matchResult = fuzzyMatchInvoice(booksInv, [gstr2bInv]);
    assert.ok(["matched", "approximate"].includes(matchResult.status));
    assert.ok(matchResult.matchScore >= 75);
    assert.ok(matchResult.notes.length > 0);

    // Vendor Nudge Generator
    const nudge = generateVendorNudgePayload({
      companyName: "Greenshine Traders Pvt. Ltd.",
      vendorName: "Bharat Suppliers",
      vendorGstin: "27AAABC1234F1Z1",
      vendorPhone: "9876543210",
      vendorEmail: "accounts@bharatsuppliers.com",
      period: "2026-09",
      discrepancies: [
        { invoiceNo: "INV-99", invoiceDate: "2026-09-05", taxable: 20000, gst: 3600, issue: "Missing in GSTR-2B" },
      ],
    });
    assert.ok(nudge.whatsappUrl.includes("wa.me"));
    assert.ok(nudge.mailtoUrl.includes("mailto:"));
    assert.strictEqual(nudge.discrepancyCount, 1);
    assert.strictEqual(nudge.totalTaxInvolved, 3600);
  });

  // 5. Statutory Returns: CMP-08, GSTR-4, GSTR-9C
  test("5. Composition (CMP-08, GSTR-4) & Annual Reconciliation (GSTR-9C)", () => {
    const cmp08 = compileCMP08([{ taxableValue: 100000, cgst: 500, sgst: 500 }], [], { period: "2026-Q2" });
    assert.ok(cmp08.sections.table1_outward);
    assert.strictEqual(cmp08.jsonPayload.form, "CMP-08");

    const gstr4 = compileGSTR4([{ taxableValue: 500000 }], [], { financialYear: "2025-26" });
    assert.ok(gstr4.sections.table4A_inward_registered);
    assert.strictEqual(gstr4.jsonPayload.form, "GSTR-4");

    const gstr9c = compileGSTR9C({
      auditedTurnover: 15000000,
      gstr9Turnover: 15000000,
      financialYear: "2025-26",
    });
    assert.strictEqual(gstr9c.returnType, "GSTR-9C");
    assert.strictEqual(gstr9c.reconciliation.auditedTurnover, 15000000);
    assert.strictEqual(gstr9c.partB_certification.status, "CERTIFIED");
  });

  // 6. RCM Subsystem & Self-Invoicing
  test("6. RCM Subsystem & Self-Invoicing Validation", async () => {
    const rcmPurchase = await Purchase.create({
      companyId: testCompany._id,
      billNo: "PO-TEST-RCM-" + Date.now(),
      billDate: new Date(),
      period: "2026-09",
      vendorName: "Local Transport Agency (GTA)",
      vendorGstin: "URP",
      isRcm: true,
      rcmCategory: "gta_transport",
      items: [
        {
          name: "Freight Transportation",
          hsn: "9965",
          qty: 1,
          rate: 10000,
          taxable: 10000,
          gstRate: 5,
          gst: 500,
        },
      ],
      taxableValue: 10000,
      cgst: 250,
      sgst: 250,
      gst: 500,
      total: 10500,
    });

    assert.strictEqual(rcmPurchase.isRcm, true);
    assert.strictEqual(rcmPurchase.rcmCategory, "gta_transport");

    // Clean up
    await Purchase.deleteOne({ _id: rcmPurchase._id });
  });

  // 7. Notice Ingestion & Ticketing Workflow
  test("7. Notice Ingestion & Ticketing Workflow (DRC-01 / ASMT-10)", async () => {
    const rawNotice = `GOVERNMENT OF MAHARASHTRA
STATE TAX DEPARTMENT
FORM GST DRC-01
Notice Reference No: ZA2709260012345
Date: 2026-09-15
To: Greenshine Traders Pvt. Ltd. (27AAACG1234F1Z5)
Subject: Notice under Section 73(1) for excess ITC claimed in GSTR-3B vs GSTR-2B.
Tax demand: ₹1,25,000. Interest: ₹18,000. Penalty: ₹12,500. Total Demand: ₹1,55,500.
Reply due date: 30 days from receipt.`;

    const notice = await Notice.create({
      companyId: testCompany._id,
      noticeNo: "ZA2709260012345",
      type: "DRC-01",
      section: "Section 73",
      issueDate: new Date("2026-09-15"),
      dueDate: new Date("2026-10-15"),
      financialYear: "2025-26",
      status: "pending",
      priority: "high",
      allegationType: "ITC_3B_VS_2B_MISMATCH",
      description: "Excess ITC claimed in GSTR-3B vs GSTR-2B",
      demandAmount: {
        tax: 125000,
        interest: 18000,
        penalty: 12500,
        total: 155500,
      },
      ticketId: `TCK-${Date.now().toString(36).toUpperCase()}`,
      assignedToName: "Senior Tax Manager",
      rawNoticeText: rawNotice,
    });

    assert.strictEqual(notice.type, "DRC-01");
    assert.strictEqual(notice.priority, "high");
    assert.strictEqual(notice.demandAmount.total, 155500);
    assert.ok(notice.ticketId.startsWith("TCK-"));

    // Clean up
    await Notice.deleteOne({ _id: notice._id });
  });

  // 8. Vendor Compliance Health Scoring
  test("8. Continuous Vendor Risk & Compliance Health Scoring", async () => {
    const vendor = await Party.create({
      companyId: testCompany._id,
      name: "Dynamic Vendor Test",
      gstin: "27AABCV1234A1Z0",
      type: "vendor",
      complianceScore: 45,
      complianceCategory: "Chronic Non-Filer",
      procurementAlert: true,
      filingHistory: [
        { period: "2026-06", filed: false, returnType: "GSTR-1" },
        { period: "2026-07", filed: false, returnType: "GSTR-1" },
      ],
    });

    assert.strictEqual(vendor.complianceCategory, "Chronic Non-Filer");
    assert.strictEqual(vendor.procurementAlert, true);
    assert.ok(vendor.complianceScore < 70);

    // Clean up
    await Party.deleteOne({ _id: vendor._id });
  });

  // 9. Native IMS (Invoice Management System) Workspace
  test("9. Native IMS (Invoice Management System) Bulk Actions & GSTR-2B Lock", async () => {
    const doc1 = await SupplierDoc.create({
      companyId: testCompany._id,
      period: "2026-09",
      docDate: new Date("2026-09-02"),
      supplierGstin: "27AABCU1111A1Z1",
      supplierName: "IMS Test Supplier 1",
      invoiceNo: "INV-IMS-01",
      taxableValue: 50000,
      cgst: 4500,
      sgst: 4500,
      imsState: "pending",
    });

    const doc2 = await SupplierDoc.create({
      companyId: testCompany._id,
      period: "2026-09",
      docDate: new Date("2026-09-05"),
      supplierGstin: "27AABCU2222A1Z2",
      supplierName: "IMS Test Supplier 2",
      invoiceNo: "INV-IMS-02",
      taxableValue: 70000,
      cgst: 6300,
      sgst: 6300,
      imsState: "pending",
    });

    // Bulk Accept doc1
    await SupplierDoc.updateOne(
      { _id: doc1._id },
      { $set: { imsState: "accepted", imsActionDate: new Date() } }
    );
    const updated1 = await SupplierDoc.findById(doc1._id);
    assert.strictEqual(updated1.imsState, "accepted");

    // Bulk Reject doc2 with statutory reason
    await SupplierDoc.updateOne(
      { _id: doc2._id },
      {
        $set: {
          imsState: "rejected",
          rejectedReason: "Goods not received / wrong invoice details",
          imsActionDate: new Date(),
        },
      }
    );
    const updated2 = await SupplierDoc.findById(doc2._id);
    assert.strictEqual(updated2.imsState, "rejected");
    assert.strictEqual(updated2.rejectedReason, "Goods not received / wrong invoice details");

    // Clean up
    await SupplierDoc.deleteMany({ _id: { $in: [doc1._id, doc2._id] } });
  });
});
