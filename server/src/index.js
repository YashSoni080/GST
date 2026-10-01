import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/index.js";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { ROLE_PERMISSIONS } from "./config/constants.js";

import { User } from "./models/User.js";
import { Company } from "./models/Company.js";
import { Party } from "./models/Party.js";
import { Invoice } from "./models/Invoice.js";
import { HSNCode } from "./models/HSNCode.js";
import { Purchase } from "./models/Purchase.js";
import { SupplierDoc } from "./models/SupplierDoc.js";
import { GSTR } from "./models/GSTR.js";
import { ReconRun } from "./models/ReconRun.js";
import { ITCEntry } from "./models/ITCEntry.js";
import { AuditLog } from "./models/AuditLog.js";
import { Notice } from "./models/Notice.js";
import { EscrowTransaction } from "./models/EscrowTransaction.js";
import { EcommerceSettlement } from "./models/EcommerceSettlement.js";

import authRoutes from "./routes/auth.js";
import companyRoutes from "./routes/company.js";
import invoiceRoutes from "./routes/invoices.js";
import partyRoutes from "./routes/parties.js";
import purchaseRoutes from "./routes/purchases.js";
import returnRoutes from "./routes/returns.js";
import itcRoutes from "./routes/itc.js";
import hsnRoutes from "./routes/hsn.js";
import dashboardRoutes from "./routes/dashboard.js";
import reconRoutes from "./routes/recon.js";
import auditRoutes from "./routes/audit.js";
import noticeRoutes from "./routes/notices.js";
import auditRadarRoutes from "./routes/auditRadar.js";
import ctcRoutes from "./routes/ctc.js";
import escrowRoutes from "./routes/escrow.js";
import assistantRoutes from "./routes/assistant.js";
import idpRoutes from "./routes/idp.js";
import erpRoutes from "./routes/erp.js";
import ecommerceRoutes from "./routes/ecommerce.js";
import imsRoutes from "./routes/ims.js";

const app = express();

// Security hardening
app.disable("x-powered-by");
if (process.env.VERCEL) app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Middleware
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// Ensure DB connection for serverless & local requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Make models available to middleware
const models = {
  User,
  Company,
  Party,
  Invoice,
  HSNCode,
  Purchase,
  SupplierDoc,
  GSTR,
  ReconRun,
  ITCEntry,
  AuditLog,
  Notice,
  EscrowTransaction,
  EcommerceSettlement,
};
app.locals.models = models;

// Build role capability map
const roleCaps = {};
for (const [role, def] of Object.entries(ROLE_PERMISSIONS)) {
  roleCaps[role] =
    def.caps === "all"
      ? Object.values(ROLE_PERMISSIONS).flatMap((d) => (d.caps === "all" ? [] : d.caps))
      : def.caps;
}
app.locals.roleCaps = roleCaps;

// Coarse API rate ceiling (credential endpoints have their own stricter limiter)
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/itc", itcRoutes);
app.use("/api/hsn", hsnRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/recon", reconRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/audit-radar", auditRadarRoutes);
app.use("/api/ctc", ctcRoutes);
app.use("/api/escrow", escrowRoutes);
app.use("/api/assistant", assistantRoutes);
app.use("/api/idp", idpRoutes);
app.use("/api/erp", erpRoutes);
app.use("/api/ecommerce", ecommerceRoutes);
app.use("/api/ims", imsRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, version: "2026.1" }));

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
async function start() {
  await connectDB();
  console.log("MongoDB connected");
  app.listen(config.port, () => {
    console.log(`GST Manager server running on port ${config.port}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
