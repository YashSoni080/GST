import { UNION_TERRITORIES } from "../config/constants.js";

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Core GST tax calculation engine.
// Intra-state (same branch + place of supply state): CGST + SGST
// Inter-state: IGST
// Supplies to a Union Territory (posStateCode in UT set): CGST + UTGST
export function computeTaxes(items, { posStateCode, branchStateCode }) {
  let taxableValue = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let utgst = 0;
  let cess = 0;

  const isUT = UNION_TERRITORIES.has(String(posStateCode));
  const intra = String(posStateCode) === String(branchStateCode) && !isUT;

  for (const it of items) {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const disc = Number(it.discountPct) || 0;
    const gstRate = Number(it.gstRate) || 0;
    const amount = qty * rate * (1 - disc / 100);
    const taxable = round(amount);
    const gst = round((taxable * gstRate) / 100);

    taxableValue = round(taxableValue + taxable);
    if (it.cessRate) {
      cess += round((gst * Number(it.cessRate)) / 100);
    }

    if (intra) {
      cgst = round(cgst + gst / 2);
      sgst = round(sgst + gst / 2);
    } else {
      igst = round(igst + gst);
    }
  }

  if (isUT && !intra) {
    // UT supply: CGST + UTGST
    const totalGst = igst;
    igst = 0;
    cgst = round(cgst + totalGst / 2);
    utgst = round(totalGst / 2);
  }

  const gross = round(taxableValue + cgst + sgst + igst + utgst + cess);
  const roundOff = round(Math.round(gross) - gross);
  const total = round(gross + roundOff);

  return {
    taxableValue,
    cgst,
    sgst,
    igst,
    utgst,
    cess,
    gross,
    roundOff,
    total,
    intra,
    isUT,
  };
}

export function money(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}