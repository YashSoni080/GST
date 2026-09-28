/**
 * Advanced Fuzzy Logic Reconciliation Engine & Automated Nudge Generator
 * (PRD Section 1.3 & 2.5)
 */

// Normalizes invoice numbers: strips common prefixes, non-alphanumerics, and leading zeroes
export function normalizeInvoiceNumber(invNo) {
  if (!invNo) return "";
  let clean = String(invNo).trim().toUpperCase();
  // Strip known prefix conventions (e.g., INV-, INV/, BILL/, FY25-26/, 2026/)
  clean = clean.replace(/^(?:INV|BILL|TAX|EXP|REF|FY\d{2,4}[-/]?\d{0,4})[-/_:]*/i, "");
  // Remove non-alphanumeric characters
  clean = clean.replace(/[^A-Z0-9]/g, "");
  // Strip leading zeroes (e.g. 00042 -> 42)
  clean = clean.replace(/^0+/, "");
  return clean;
}

// Levenshtein distance for string typo detection
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function invoiceSimilarity(strA, strB) {
  const normA = normalizeInvoiceNumber(strA);
  const normB = normalizeInvoiceNumber(strB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  const score = Math.max(0, (maxLen - dist) / maxLen);
  return Math.round(score * 100) / 100;
}

/**
 * 4-Way Multi-Dimensional Fuzzy Matcher:
 * Evaluates Supplier GSTIN, Invoice Number Noise, Date Variance (+/- 7 days), and Tax Discrepancy.
 */
export function fuzzyMatchInvoice(purchase, supplierDocs) {
  const pGst = Number(purchase.gst || 0);
  const pTaxable = Number(purchase.taxableValue || 0);
  const pDate = purchase.billDate ? new Date(purchase.billDate).getTime() : 0;

  let bestMatch = null;
  let highestScore = 0;

  const docList = Array.isArray(supplierDocs) ? supplierDocs : [supplierDocs].filter(Boolean);
  // Filter docs for same supplier GSTIN, or match all if vendorGstin omitted
  const candidateDocs = purchase.vendorGstin
    ? docList.filter((d) => d.supplierGstin === purchase.vendorGstin)
    : docList;

  for (const doc of candidateDocs) {
    let score = 0;
    const notes = [];

    // 1. Invoice Number Match
    const exactNo = doc.invoiceNo === purchase.billNo;
    const simNo = invoiceSimilarity(doc.invoiceNo, purchase.billNo);

    if (exactNo) {
      score += 40;
    } else if (simNo >= 0.8) {
      score += Math.round(simNo * 38);
      notes.push(`Fuzzy invoice match (${doc.invoiceNo} vs ${purchase.billNo})`);
    }

    // 2. Taxable Value & GST Match
    const docTaxable = Number(doc.taxableValue || 0);
    const docGst = Number(doc.gst || 0);
    const taxableDiff = Math.abs(docTaxable - pTaxable);
    const gstDiff = Math.abs(docGst - pGst);

    if (taxableDiff < 1 && gstDiff < 1) {
      score += 40;
    } else if (taxableDiff <= 10 && gstDiff <= 10) {
      score += 35;
      notes.push(`Round-off variance: ₹${Math.max(taxableDiff, gstDiff).toFixed(2)}`);
    } else if (taxableDiff / Math.max(1, pTaxable) < 0.05) {
      score += 25;
      notes.push(`Tax variance: ₹${gstDiff.toFixed(2)}`);
    }

    // 3. Date Variance (+/- 7 days tolerance)
    const docDate = doc.docDate ? new Date(doc.docDate).getTime() : 0;
    const diffDays = Math.abs(pDate - docDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) {
      score += 20;
    } else if (diffDays <= 7) {
      score += 15;
      notes.push(`Date variance: ${Math.round(diffDays)} days between bill and GSTR-2B`);
    } else if (diffDays <= 15) {
      score += 10;
      notes.push(`Date variance: ${Math.round(diffDays)} days`);
    }

    if (score > highestScore && score >= 50) {
      highestScore = score;
      bestMatch = { doc, score, notes, taxableDiff, gstDiff, diffDays };
    }
  }

  if (!bestMatch) {
    return {
      status: "missing",
      matchScore: 0,
      doc: null,
      notes: ["Missing in GSTR-2B: Supplier has not uploaded invoice in GSTR-1"],
    };
  }

  let status = "matched";
  if (highestScore >= 90 && bestMatch.taxableDiff < 1 && bestMatch.gstDiff < 1) {
    status = "matched";
  } else if (highestScore >= 75) {
    status = "approximate";
  } else {
    status = "mismatch";
  }

  return {
    status,
    matchScore: highestScore,
    doc: bestMatch.doc,
    taxableDiff: bestMatch.taxableDiff,
    gstDiff: bestMatch.gstDiff,
    notes: bestMatch.notes,
  };
}

/**
 * Section 2.5: Automated Vendor Communication Nudge Generator
 * Generates ready-to-dispatch WhatsApp, Email, and SMS text with clickable links.
 */
export function generateVendorNudgePayload({
  companyName = "Greenshine Traders Pvt. Ltd.",
  vendorName,
  vendorGstin,
  vendorPhone = "",
  vendorEmail = "",
  period = "2026-09",
  discrepancies = [],
}) {
  const totalTaxAtStake = discrepancies.reduce((sum, d) => sum + (Number(d.gst) || 0), 0);
  const invoiceList = discrepancies
    .map((d, i) => `${i + 1}. Inv #${d.invoiceNo} dt ${d.invoiceDate ? new Date(d.invoiceDate).toLocaleDateString("en-IN") : ""} (Taxable: ₹${Number(d.taxable || 0).toLocaleString("en-IN")}, GST: ₹${Number(d.gst || 0).toLocaleString("en-IN")}) - ${d.issue || "Missing in GSTR-2B"}`)
    .join("\n");

  const emailSubject = `URGENT: GSTR-2B ITC Mismatch Intimation for ${discrepancies.length} Invoice(s) - ${companyName}`;
  const messageBody = `Dear ${vendorName || "Partner"},\n\nDuring our GSTR-2B reconciliation for the return period ${period}, we identified discrepancies in ${discrepancies.length} invoice(s) issued by you (GSTIN: ${vendorGstin}):\n\n${invoiceList}\n\nTotal Input Tax Credit (ITC) Blocked: ₹${totalTaxAtStake.toLocaleString("en-IN")}\n\nUnder Section 16(2)(aa) of the CGST Act, our input tax credit is blocked until these invoices are reflected in GSTR-2B. Kindly upload or amend these invoices in your GSTR-1 immediately to avoid payment withholding under our Escrow terms.\n\nThank you,\n${companyName} Accounts & Tax Department`;

  const smsText = `Alert from ${companyName}: ${discrepancies.length} invoices (GST ₹${totalTaxAtStake.toLocaleString("en-IN")}) missing in GSTR-2B for ${period}. Please upload in GSTR-1 immediately to prevent payment block.`;

  // Encode for WhatsApp Web / Mobile Click-to-Chat Link
  const encodedWaText = encodeURIComponent(
    `*ITC Mismatch Alert - ${companyName}*\n\nDear ${vendorName || "Partner"},\nOur GSTR-2B reconciliation for ${period} shows ${discrepancies.length} missing/mismatched invoice(s) totaling *₹${totalTaxAtStake.toLocaleString("en-IN")}* in GST credit:\n\n${invoiceList}\n\nPlease file these in your GSTR-1 immediately so our ITC is not blocked. Thank you!`
  );

  const cleanPhone = vendorPhone.replace(/\D/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedWaText}`
    : `https://api.whatsapp.com/send?text=${encodedWaText}`;

  const mailtoUrl = `mailto:${vendorEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(messageBody)}`;

  return {
    vendorName,
    vendorGstin,
    vendorPhone,
    vendorEmail,
    period,
    totalTaxAtStake,
    totalTaxInvolved: totalTaxAtStake,
    itemCount: discrepancies.length,
    discrepancyCount: discrepancies.length,
    whatsappUrl,
    mailtoUrl,
    textBody: messageBody,
    emailSubject,
    email: {
      to: vendorEmail,
      subject: emailSubject,
      body: messageBody,
    },
    whatsapp: {
      url: whatsappUrl,
      text: decodeURIComponent(encodedWaText),
    },
    sms: {
      text: smsText,
    },
  };
}
