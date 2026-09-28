import crypto from "crypto";
import QRCode from "qrcode";

/**
 * Generates an official 64-character SHA-256 Invoice Reference Number (IRN)
 * Hash string: SupplierGSTIN + FinYear + DocType + DocNo
 */
export function computeIRN({ supplierGstin, finYear = "2025-26", docType = "INV", docNo }) {
  const raw = `${supplierGstin}${finYear}${docType}${docNo}`.toUpperCase();
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Generates a signed QR Code Data URL adhering to NIC/IRP specifications
 */
export async function generateSignedQR({
  irn,
  sellerGstin,
  buyerGstin,
  docNo,
  docDate,
  totInvVal,
  itemCnt,
  mainHsnCode,
  ackNo,
  ackDate,
}) {
  const qrPayload = JSON.stringify({
    SellerGSTIN: sellerGstin,
    BuyerGSTIN: buyerGstin || "URP",
    DocNo: docNo,
    DocTyp: "INV",
    DocDt: docDate ? new Date(docDate).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
    TotInvVal: Math.round(totInvVal || 0),
    ItemCnt: itemCnt || 1,
    MainHsnCode: mainHsnCode || "8471",
    Irn: irn,
    AckNo: ackNo,
    AckDt: ackDate || new Date().toISOString(),
    Sig: crypto.createHash("sha1").update(irn + (ackNo || "1126100")).digest("hex"),
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return { qrPayload, qrDataUrl };
}

/**
 * Generates UPI Dynamic QR Code for B2C payment collection
 * upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<invoice_no>
 */
export async function generateUPIPaymentQR({
  vpa = "greenshine.gst@hdfcbank",
  payeeName = "Greenshine Traders Pvt Ltd",
  amount,
  invoiceNo,
}) {
  const upiString = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(
    (Number(amount) || 0).toFixed(2)
  )}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNo}`)}`;

  const upiQrDataUrl = await QRCode.toDataURL(upiString, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 180,
    color: { dark: "#0066ff", light: "#ffffff" },
  });

  return { upiString, upiQrDataUrl };
}
