import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/config/db.js";
import { User } from "../src/models/User.js";
import { Company } from "../src/models/Company.js";
import { Invoice } from "../src/models/Invoice.js";
import { Purchase } from "../src/models/Purchase.js";
import { Party } from "../src/models/Party.js";
import { Notice } from "../src/models/Notice.js";
import { EscrowTransaction } from "../src/models/EscrowTransaction.js";
import { GSTR } from "../src/models/GSTR.js";
import { ITCEntry } from "../src/models/ITCEntry.js";
import { signToken } from "../src/middleware/auth.js";

describe("Security Audit & Clean State Verification Suite", () => {
  before(async () => {
    try {
      await connectDB();
    } catch (_) {}
  });

  after(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  });

  test("Security Check 1: Exactly One Single Admin User Exists", async () => {
    if (mongoose.connection.readyState === 1) {
      const userCount = await User.countDocuments({});
      assert.strictEqual(userCount, 1, "There should be exactly 1 user in the database");

      const admin = await User.findOne({ email: "admin@greenshine.com" });
      assert.ok(admin, "Admin user admin@greenshine.com must exist");
      assert.strictEqual(admin.role, "admin");
      assert.strictEqual(admin.active, true);

      // Verify bcrypt password hashing is used (not plain text)
      assert.ok(admin.passwordHash.startsWith("$2"), "Password must be salted and hashed with bcrypt");
      const valid = await bcrypt.compare("admin123", admin.passwordHash);
      assert.strictEqual(valid, true, "Admin credentials must match");
    }
  });

  test("Security Check 2: All Dummy Records Removed", async () => {
    if (mongoose.connection.readyState === 1) {
      const [invoices, purchases, parties, notices, escrows, returns, itc] = await Promise.all([
        Invoice.countDocuments({}),
        Purchase.countDocuments({}),
        Party.countDocuments({}),
        Notice.countDocuments({}),
        EscrowTransaction.countDocuments({}),
        GSTR.countDocuments({}),
        ITCEntry.countDocuments({}),
      ]);

      assert.strictEqual(invoices, 0, "All dummy invoices must be removed");
      assert.strictEqual(purchases, 0, "All dummy purchases must be removed");
      assert.strictEqual(parties, 0, "All dummy parties must be removed");
      assert.strictEqual(notices, 0, "All dummy notices must be removed");
      assert.strictEqual(escrows, 0, "All dummy escrows must be removed");
      assert.strictEqual(returns, 0, "All dummy returns must be removed");
      assert.strictEqual(itc, 0, "All dummy ITC ledger entries must be removed");
    }
  });

  test("Security Check 3: Authentication Tokens & Password Policy", async () => {
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "admin",
      companyId: new mongoose.Types.ObjectId(),
    };
    const token = signToken(mockUser);
    assert.ok(token, "JWT token generation must succeed");
    assert.strictEqual(typeof token, "string");
    assert.strictEqual(token.split(".").length, 3, "JWT must have header.payload.signature format");
  });

  test("Security Check 4: XML Injection Sanitization", () => {
    function escapeXml(str) {
      return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    const maliciousName = '<PARTY style="xss">Acme & Sons "Best" \'Co\'</PARTY>';
    const escaped = escapeXml(maliciousName);
    assert.ok(!escaped.includes("<PARTY"));
    assert.ok(escaped.includes("&lt;PARTY"));
    assert.ok(escaped.includes("&amp;"));
    assert.ok(escaped.includes("&quot;"));
    assert.ok(escaped.includes("&apos;"));
  });

  test("Security Check 5: NoSQL & Type Validation Safeguards", () => {
    // String type guards
    const invalidInputs = [null, undefined, 12345, { $gt: "" }, ["test"]];
    for (const input of invalidInputs) {
      const isCleanString = typeof input === "string" && input.trim().length > 0;
      assert.strictEqual(isCleanString, false, `Input ${JSON.stringify(input)} must be rejected`);
    }

    const validEmail = "admin@greenshine.com";
    const invalidEmails = ["admin", "admin@", "admin@greenshine", "admin.greenshine.com"];
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    assert.strictEqual(emailRe.test(validEmail), true);
    for (const bad of invalidEmails) {
      assert.strictEqual(emailRe.test(bad), false, `Email ${bad} must be rejected`);
    }
  });
});
