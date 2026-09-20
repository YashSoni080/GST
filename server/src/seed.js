import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "./config/index.js";
import { User } from "./models/User.js";
import { Company } from "./models/Company.js";
import { Party } from "./models/Party.js";
import { HSNCode } from "./models/HSNCode.js";
import { Invoice } from "./models/Invoice.js";

async function seed() {
  await mongoose.connect(config.mongodbUri);
  console.log("Connected to MongoDB");

  await User.deleteMany({});
  await Company.deleteMany({});
  await Party.deleteMany({});
  await HSNCode.deleteMany({});
  await Invoice.deleteMany({});

  const company = await Company.create({
    name: "Greenshine Traders Pvt. Ltd.",
    pan: "AAACG1234F",
    fiscalYear: "2025-26",
    address: "Mumbai, Maharashtra",
    gstins: [
      {
        gstin: "29AAACG1234F1Z5",
        tradeName: "Greenshine Traders",
        legalName: "Greenshine Traders Private Limited",
        stateCode: "27",
        state: "Maharashtra",
        city: "Mumbai",
        branch: "Head Office",
        invoiceSeries: "GI",
        isPrimary: true,
        active: true,
      },
    ],
  });

  const passwordHash = await bcrypt.hash("admin123", 10);
  const user = await User.create({
    name: "Admin User",
    email: "admin@greenshine.com",
    passwordHash,
    role: "admin",
    companyId: company._id,
  });

  const parties = await Party.insertMany([
    {
      companyId: company._id, name: "Akshaya Retailers", gstin: "29AABCD1234E1Z5",
      stateCode: "29", state: "Karnataka", type: "customer", gstType: "registered",
    },
    {
      companyId: company._id, name: "Venus Electronics", gstin: "27AABCE5678K1Z2",
      stateCode: "27", state: "Maharashtra", type: "customer", gstType: "registered",
    },
    {
      companyId: company._id, name: "MegaMart Wholesale", gstin: "07AAICD9090R1Z9",
      stateCode: "07", state: "Delhi", type: "customer", gstType: "registered",
    },
    {
      companyId: company._id, name: "Zephyr Exports", gstin: "24AAACZ4444E1Z3",
      stateCode: "24", state: "Gujarat", type: "customer", gstType: "export",
    },
  ]);

  await HSNCode.insertMany([
    { code: "8539", description: "LED lamps and light fittings", type: "goods", rate: 18 },
    { code: "8541", description: "Semiconductor devices", type: "goods", rate: 18 },
    { code: "8504", description: "Electrical transformers", type: "goods", rate: 18 },
    { code: "8211", description: "Hand tools", type: "goods", rate: 12 },
    { code: "9983", description: "Consulting services", type: "service", scheme: "SAC", rate: 18 },
  ]);

  const invoices = [
    {
      companyId: company._id, companyGstin: "29AAACG1234F1Z5",
      gstinStateCode: "27", gstinState: "Maharashtra",
      invNo: "GI/2026/1024", series: "GI", date: new Date("2026-09-18"),
      partyId: parties[0]._id, partyName: "Akshaya Retailers",
      partyGstin: "29AABCD1234E1Z5", partyStateCode: "29", partyState: "Karnataka",
      placeOfSupply: "29-Karnataka", posStateCode: "29", posState: "Karnataka",
      supplyType: "B2B",
      items: [
        { name: "LED Bulb 9W", hsn: "8539", qty: 100, rate: 85, gstRate: 18, taxable: 8500 },
        { name: "LED Panel 12W", hsn: "8539", qty: 40, rate: 640, gstRate: 18, taxable: 25600 },
      ],
      taxableValue: 34100, cgst: 3069, sgst: 3069, igst: 0, total: 40238,
      status: "valid", irn: "IRN20260918DEMO",
    },
    {
      companyId: company._id, companyGstin: "29AAACG1234F1Z5",
      gstinStateCode: "27", gstinState: "Maharashtra",
      invNo: "GI/2026/1023", series: "GI", date: new Date("2026-09-17"),
      partyId: parties[0]._id, partyName: "Akshaya Retailers",
      partyGstin: "29AABCD1234E1Z5", partyStateCode: "29", partyState: "Karnataka",
      placeOfSupply: "29-Karnataka", posStateCode: "29", posState: "Karnataka",
      supplyType: "B2B",
      items: [
        { name: "LED Bulb 9W", hsn: "8539", qty: 250, rate: 85, gstRate: 18, taxable: 21250 },
        { name: "LED Panel 12W", hsn: "8539", qty: 60, rate: 640, gstRate: 18, taxable: 38400 },
      ],
      taxableValue: 214800, cgst: 19332, sgst: 19332, igst: 0, total: 253464,
      status: "IRN_GENERATED", irn: "IRN20260917DEMO",
    },
    {
      companyId: company._id, companyGstin: "29AAACG1234F1Z5",
      gstinStateCode: "27", gstinState: "Maharashtra",
      invNo: "GI/2026/1022", series: "GI", date: new Date("2026-09-16"),
      partyId: parties[1]._id, partyName: "Venus Electronics",
      partyGstin: "27AABCE5678K1Z2", partyStateCode: "27", partyState: "Maharashtra",
      placeOfSupply: "27-Maharashtra", posStateCode: "27", posState: "Maharashtra",
      supplyType: "B2B",
      items: [
        { name: "LED Panel 12W", hsn: "8539", qty: 100, rate: 640, gstRate: 18, taxable: 64000 },
      ],
      taxableValue: 64000, cgst: 5760, sgst: 5760, igst: 0, total: 75520,
      status: "pushed", irn: "IRN20260916DEMO",
    },
    {
      companyId: company._id, companyGstin: "29AAACG1234F1Z5",
      gstinStateCode: "27", gstinState: "Maharashtra",
      invNo: "GI/2026/1021", series: "GI", date: new Date("2026-09-14"),
      partyId: parties[2]._id, partyName: "MegaMart Wholesale",
      partyGstin: "07AAICD9090R1Z9", partyStateCode: "07", partyState: "Delhi",
      placeOfSupply: "07-Delhi", posStateCode: "07", posState: "Delhi",
      supplyType: "B2B",
      items: [
        { name: "LED Bulb 9W", hsn: "8539", qty: 500, rate: 85, gstRate: 18, taxable: 42500 },
        { name: "LED Panel 12W", hsn: "8539", qty: 100, rate: 640, gstRate: 18, taxable: 64000 },
        { name: "Transformer 10kVA", hsn: "8504", qty: 10, rate: 15000, gstRate: 18, taxable: 150000 },
      ],
      taxableValue: 450120, cgst: 0, sgst: 0, igst: 81022, total: 531142,
      status: "draft",
    },
    {
      companyId: company._id, companyGstin: "29AAACG1234F1Z5",
      gstinStateCode: "27", gstinState: "Maharashtra",
      invNo: "GI/2026/1020", series: "GI", date: new Date("2026-09-12"),
      partyId: parties[3]._id, partyName: "Zephyr Exports",
      partyGstin: "24AAACZ4444E1Z3", partyStateCode: "24", partyState: "Gujarat",
      placeOfSupply: "24-Gujarat", posStateCode: "24", posState: "Gujarat",
      supplyType: "Export",
      items: [
        { name: "LED Bulb 9W", hsn: "8539", qty: 200, rate: 85, gstRate: 0, taxable: 17000 },
        { name: "LED Panel 12W", hsn: "8539", qty: 200, rate: 640, gstRate: 0, taxable: 128000 },
      ],
      taxableValue: 188000, cgst: 0, sgst: 0, igst: 0, total: 188000,
      status: "pushed", irn: "IRN20260912DEMO",
    },
  ];

  await Invoice.insertMany(invoices);

  console.log("\nSeed complete!");
  console.log("─────────────────────────────────────────");
  console.log("  Email:    admin@greenshine.com");
  console.log("  Password: admin123");
  console.log("─────────────────────────────────────────");
  console.log(`  Company:  ${company.name}`);
  console.log(`  GSTIN:    29AAACG1234F1Z5`);
  console.log(`  Parties:  ${parties.length}`);
  console.log(`  Invoices: ${invoices.length}`);
  console.log("─────────────────────────────────────────\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
