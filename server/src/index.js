import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/index.js";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/error.js";
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

import authRoutes from "./routes/auth.js";
import invoiceRoutes from "./routes/invoices.js";
import partyRoutes from "./routes/parties.js";
import purchaseRoutes from "./routes/purchases.js";
import returnRoutes from "./routes/returns.js";
import itcRoutes from "./routes/itc.js";
import hsnRoutes from "./routes/hsn.js";
import dashboardRoutes from "./routes/dashboard.js";
import reconRoutes from "./routes/recon.js";
import auditRoutes from "./routes/audit.js";

const app = express();

// Middleware
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// Make models available to middleware
const models = {
  User, Company, Party, Invoice, HSNCode, Purchase,
  SupplierDoc, GSTR, ReconRun, ITCEntry, AuditLog,
};
app.locals.models = models;

// Build role capability map
const roleCaps = {};
for (const [role, def] of Object.entries(ROLE_PERMISSIONS)) {
  roleCaps[role] = def.caps === "all"
    ? Object.values(ROLE_PERMISSIONS).flatMap(d => d.caps === "all" ? [] : d.caps)
    : def.caps;
}
app.locals.roleCaps = roleCaps;

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/itc", itcRoutes);
app.use("/api/hsn", hsnRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/recon", reconRoutes);
app.use("/api/audit", auditRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

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

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
