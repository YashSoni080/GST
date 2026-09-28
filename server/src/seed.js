import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "./config/index.js";
import { connectDB } from "./config/db.js";
import { User } from "./models/User.js";
import { Company } from "./models/Company.js";
import { Party } from "./models/Party.js";
import { HSNCode } from "./models/HSNCode.js";
import { Invoice } from "./models/Invoice.js";
import { Purchase } from "./models/Purchase.js";
import { SupplierDoc } from "./models/SupplierDoc.js";
import { GSTR } from "./models/GSTR.js";
import { ITCEntry } from "./models/ITCEntry.js";
import { Notice } from "./models/Notice.js";
import { EscrowTransaction } from "./models/EscrowTransaction.js";
import { AuditLog } from "./models/AuditLog.js";
import { ReconRun } from "./models/ReconRun.js";

async function seed() {
  await connectDB();
  console.log("Connected to MongoDB at", config.mongodbUri);

  // Clear existing collections completely to remove all dummy data
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    Party.deleteMany({}),
    HSNCode.deleteMany({}),
    Invoice.deleteMany({}),
    Purchase.deleteMany({}),
    SupplierDoc.deleteMany({}),
    GSTR.deleteMany({}),
    ITCEntry.deleteMany({}),
    Notice.deleteMany({}),
    EscrowTransaction.deleteMany({}),
    AuditLog.deleteMany({}),
    ReconRun.deleteMany({}),
  ]);

  // 1. Clean Company with Multi-GSTIN Structure
  const company = await Company.create({
    name: "Greenshine Traders Pvt. Ltd.",
    pan: "AAACG1234F",
    fiscalYear: "2025-26",
    address: "Tower B, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051",
    bankAccount: "HDFC0000123 / 50200012345678",
    gstins: [
      {
        gstin: "27AAACG1234F1Z5",
        tradeName: "Greenshine Traders (Maharashtra HO)",
        legalName: "Greenshine Traders Private Limited",
        stateCode: "27",
        state: "Maharashtra",
        city: "Mumbai",
        branch: "Head Office",
        invoiceSeries: "GI-MH",
        isPrimary: true,
        active: true,
      },
      {
        gstin: "29AAACG1234F1Z1",
        tradeName: "Greenshine Traders (Karnataka Branch)",
        legalName: "Greenshine Traders Private Limited",
        stateCode: "29",
        state: "Karnataka",
        city: "Bengaluru",
        branch: "South Region Hub",
        invoiceSeries: "GI-KA",
        isPrimary: false,
        active: true,
      },
      {
        gstin: "24AAACG1234F1Z8",
        tradeName: "Greenshine Logistics (Gujarat Unit)",
        legalName: "Greenshine Traders Private Limited",
        stateCode: "24",
        state: "Gujarat",
        city: "Ahmedabad",
        branch: "West Distribution Depot",
        invoiceSeries: "GI-GJ",
        isPrimary: false,
        active: true,
      },
    ],
  });

  // 2. Single Admin User (no dummy users)
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@greenshine.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser = await User.create({
    name: "Administrator",
    email: adminEmail,
    passwordHash,
    role: "admin",
    companyId: company._id,
    active: true,
  });

  // 3. Standard Statutory HSN / SAC Master Reference Codes
  await HSNCode.insertMany([
    { code: "8471", description: "Automatic data processing machines & units", rate: 18, type: "goods", scheme: "HSN" },
    { code: "8517", description: "Telephone sets, smartphones, routers", rate: 18, type: "goods", scheme: "HSN" },
    { code: "998315", description: "Hosting & cloud IT infrastructure management", rate: 18, type: "service", scheme: "SAC" },
    { code: "997331", description: "Licensing services for computer software", rate: 18, type: "service", scheme: "SAC" },
    { code: "8703", description: "Motor vehicles for transport of persons (Sec 17(5))", rate: 28, type: "goods", scheme: "HSN" },
    { code: "996331", description: "Food & beverage catering services (Sec 17(5))", rate: 5, type: "service", scheme: "SAC" },
  ]);

  // Initial audit log entry for system initialization
  await AuditLog.create({
    companyId: company._id,
    action: "create",
    entity: "company",
    entityId: company._id,
    changes: { name: company.name, initialSetup: true },
    userId: adminUser._id,
    ip: "127.0.0.1",
  });

  console.log("\n=======================================================");
  console.log("  GST Management System - Initialized & Clean");
  console.log("=======================================================");
  console.log("  Single Admin User:  " + adminUser.email);
  console.log("  Role:               " + adminUser.role);
  console.log("  Company:            " + company.name);
  console.log("  GSTINs Configured:  " + company.gstins.length);
  console.log("  Dummy Invoices:     0 (Removed)");
  console.log("  Dummy Purchases:    0 (Removed)");
  console.log("  Dummy Parties:      0 (Removed)");
  console.log("  Dummy Returns:      0 (Removed)");
  console.log("  Dummy Notices:      0 (Removed)");
  console.log("  Dummy Escrows:      0 (Removed)");
  console.log("  HSN Master Codes:   6 standard reference codes");
  console.log("  Status:             Ready for production use");
  console.log("=======================================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
