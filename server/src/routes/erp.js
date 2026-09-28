import { Router } from "express";
import { requireAuth, can } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();
router.use(requireAuth);

// Section 3.2: Two-Way ERP & Accounting Connectors
// Get standard import templates and supported connectors
router.get("/connectors", can("purchases:read"), async (req, res) => {
  res.json({
    connectors: [
      { id: "tally", name: "Tally Prime 4.0 / 5.0", status: "Connected", syncMode: "Bidirectional XML/ODBC", lastSync: "2026-09-25 10:30" },
      { id: "zoho", name: "Zoho Books", status: "Ready", syncMode: "REST Webhook", lastSync: "2026-09-24 18:00" },
      { id: "sap", name: "SAP S/4HANA Cloud", status: "Configured", syncMode: "OData v4 API", lastSync: "2026-09-25 08:15" },
      { id: "busy", name: "Busy Accounting", status: "Ready", syncMode: "Batch File Export", lastSync: "Never" },
    ],
    sampleHeaders: {
      invoices: ["invNo", "date", "partyName", "partyGstin", "placeOfSupply", "item_name", "item_hsn", "item_qty", "item_rate", "item_gstRate"],
      purchases: ["billNo", "billDate", "vendorName", "vendorGstin", "taxableValue", "cgst", "sgst", "igst", "itcEligible"],
    },
  });
});

// Bulk Import Purchases from ERP
router.post("/import/purchases", can("purchases:create"), async (req, res, next) => {
  try {
    const { Purchase } = req.app.locals.models;
    const { records = [], connector = "CSV" } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(422).json({ error: "No purchase records provided" });
    }

    const docs = records.map((r) => {
      const taxable = Number(r.taxableValue || 0);
      const cgst = Number(r.cgst || 0);
      const sgst = Number(r.sgst || 0);
      const igst = Number(r.igst || 0);
      const gst = cgst + sgst + igst;
      const date = r.billDate ? new Date(r.billDate) : new Date();
      const period = r.period || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      return {
        companyId: req.user.companyId,
        vendorName: r.vendorName || "ERP Imported Vendor",
        vendorGstin: r.vendorGstin || "",
        billNo: r.billNo || `BILL-${Date.now().toString().slice(-6)}`,
        billDate: date,
        period,
        taxableValue: taxable,
        cgst,
        sgst,
        igst,
        gst,
        total: taxable + gst,
        itcEligible: r.itcEligible || "yes",
        nature: "erp_import",
        notes: `Imported via ${connector}`,
        createdBy: req.user._id,
      };
    });

    const inserted = await Purchase.insertMany(docs);
    await audit(req, "erp_import", "purchase", null, { connector, count: inserted.length });

    res.status(201).json({ success: true, count: inserted.length, records: inserted });
  } catch (err) { next(err); }
});

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Export Invoices in Tally XML Format
router.get("/export/tally-xml", can("invoices:read"), async (req, res, next) => {
  try {
    const { Invoice } = req.app.locals.models;
    const invoices = await Invoice.find({ companyId: req.user.companyId, status: { $ne: "cancelled" } }).lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDATA>\n`;

    for (const inv of invoices) {
      const dt = new Date(inv.date);
      const dateStr = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
      xml += `          <VOUCHER VCHTYPE="Sales" ACTION="Create">\n`;
      xml += `            <DATE>${dateStr}</DATE>\n`;
      xml += `            <VOUCHERNUMBER>${escapeXml(inv.invNo)}</VOUCHERNUMBER>\n`;
      xml += `            <PARTYLEDGERNAME>${escapeXml(inv.partyName)}</PARTYLEDGERNAME>\n`;
      xml += `            <AMOUNT>-${Number(inv.total) || 0}</AMOUNT>\n`;
      if (inv.irn) xml += `            <IRN>${escapeXml(inv.irn)}</IRN>\n`;
      if (inv.ewb?.no) xml += `            <EWAYBILLNO>${escapeXml(inv.ewb.no)}</EWAYBILLNO>\n`;
      xml += `          </VOUCHER>\n`;
      xml += `        </TALLYMESSAGE>\n`;
    }

    xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;

    res.setHeader("Content-Disposition", 'attachment; filename="tally_sales_export.xml"');
    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) { next(err); }
});

export default router;
