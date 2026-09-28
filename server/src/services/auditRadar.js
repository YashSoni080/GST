/**
 * Section 4.5: Risk Assessment & Predictive Audit Radar
 * Simulates Tax Department (DGARM / BIFA) risk scoring models,
 * circular trading heuristics, and supplier health grading.
 */

export function computeDepartmentAuditRadar({
  invoices = [],
  purchases = [],
  supplierDocs = [],
  parties = [],
}) {
  const anomalies = [];
  let riskScore = 10; // Baseline low risk

  // 1. Check Invoice Cancellation Rate
  const totalInvoices = invoices.length;
  const cancelledInvoices = invoices.filter((i) => i.status === "cancelled").length;
  const cancellationRate = totalInvoices > 0 ? (cancelledInvoices / totalInvoices) * 100 : 0;
  if (cancellationRate > 10) {
    riskScore += 25;
    anomalies.push({
      metric: "High Invoice Cancellation Rate",
      value: `${cancellationRate.toFixed(1)}% (Threshold: 10%)`,
      severity: "high",
      detail: `${cancelledInvoices} out of ${totalInvoices} invoices cancelled. High cancellation triggers automatic scrutiny for potential circular billing or revenue suppression.`,
      action: "Review cancellation reasons and maintain credit notes instead of outright cancellation.",
    });
  }

  // 2. Check ITC Mismatch (Books Claim vs 2B Ingestion)
  const totalBooksGst = purchases.reduce((sum, p) => sum + (Number(p.gst) || 0), 0);
  const total2bGst = supplierDocs.reduce((sum, d) => sum + (Number(d.gst) || 0), 0);
  const itcVariance = totalBooksGst - total2bGst;
  const itcVariancePct = total2bGst > 0 ? (itcVariance / total2bGst) * 100 : 0;

  if (itcVariancePct > 5) {
    riskScore += 30;
    anomalies.push({
      metric: "Excess ITC Availed Over GSTR-2B",
      value: `+₹${Math.round(itcVariance).toLocaleString("en-IN")} (${itcVariancePct.toFixed(1)}% excess)`,
      severity: "critical",
      detail: `Input Tax Credit claimed in books exceeds GSTR-2B statements. Triggers ASMT-10 or DRC-01 scrutiny under Section 16(2)(aa).`,
      action: "Disallow provisional claims exceeding statutory tolerance and dispatch vendor follow-ups.",
    });
  }

  // 3. E-Way Bill vs Invoice Date Anomaly (e.g. Non-working days or delayed generation)
  const weekendEwbs = invoices.filter((i) => {
    if (!i.ewb?.genDate) return false;
    const day = new Date(i.ewb.genDate).getDay();
    return day === 0; // Sunday
  });
  if (weekendEwbs.length > 2) {
    riskScore += 10;
    anomalies.push({
      metric: "Unusual Weekend / Holiday E-Way Bill Generation",
      value: `${weekendEwbs.length} e-way bills generated on non-working days`,
      severity: "medium",
      detail: "Frequent generation of e-way bills on Sunday nights is a red flag in department fraud heuristics.",
      action: "Audit dispatch logs and transport weighbridge receipts for weekend movement.",
    });
  }

  // 4. Circular Trading & Pass-Through Entity Heuristics
  // Check if any party acts as both customer and vendor with similar values
  const customers = new Set(invoices.map((i) => i.partyGstin).filter(Boolean));
  const vendors = new Set(purchases.map((p) => p.vendorGstin).filter(Boolean));
  const overlappingGstins = [...customers].filter((g) => vendors.has(g));

  const circularSuspects = [];
  for (const gstin of overlappingGstins) {
    const salesToParty = invoices
      .filter((i) => i.partyGstin === gstin)
      .reduce((acc, i) => acc + (Number(i.taxableValue) || 0), 0);
    const purchasesFromParty = purchases
      .filter((p) => p.vendorGstin === gstin)
      .reduce((acc, p) => acc + (Number(p.taxableValue) || 0), 0);

    const diffRatio = Math.abs(salesToParty - purchasesFromParty) / Math.max(salesToParty, purchasesFromParty, 1);
    if (diffRatio < 0.15 && salesToParty > 50000) {
      circularSuspects.push({ gstin, salesToParty, purchasesFromParty, diffRatio });
    }
  }

  if (circularSuspects.length > 0) {
    riskScore += 35;
    anomalies.push({
      metric: "Circular Trading Heuristic Triggered",
      value: `${circularSuspects.length} entities involved in reciprocal buy-sell cycles`,
      severity: "critical",
      detail: `Detected reciprocal trading loops with matching taxable volumes and nominal margin difference (<15%). Triggers Section 132 fake invoice investigation.`,
      action: "Initiate immediate physical verification of goods movement and bill-to ship-to documentation.",
    });
  }

  // Clamp risk score to 0 - 100
  riskScore = Math.min(100, Math.max(5, riskScore));

  const riskBand =
    riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MEDIUM" : "LOW";

  // 5. Supplier Health Scoring
  const supplierHealth = computeSupplierHealthScores(purchases, supplierDocs, parties);

  return {
    overallRiskScore: riskScore,
    riskBand,
    auditLikelihood: riskScore >= 60 ? "Very High (Next 60 Days)" : riskScore >= 35 ? "Moderate" : "Low",
    anomalies,
    circularTradingSuspects: circularSuspects,
    metrics: {
      totalInvoices,
      cancelledInvoices,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      totalPurchases: purchases.length,
      itcVariance: Math.round(itcVariance),
      overlappingParties: overlappingGstins.length,
    },
    supplierHealth,
  };
}

export function computeSupplierHealthScores(purchases = [], supplierDocs = [], parties = []) {
  const vendorMap = {};

  for (const p of purchases) {
    const g = p.vendorGstin || "UNKNOWN";
    if (!vendorMap[g]) {
      vendorMap[g] = {
        name: p.vendorName,
        gstin: g,
        totalPurchases: 0,
        totalGst: 0,
        matchedIn2B: 0,
        missingIn2B: 0,
      };
    }
    vendorMap[g].totalPurchases++;
    vendorMap[g].totalGst += Number(p.gst || 0);

    const doc = supplierDocs.find((d) => d.supplierGstin === g && d.invoiceNo === p.billNo);
    if (doc) {
      vendorMap[g].matchedIn2B++;
    } else {
      vendorMap[g].missingIn2B++;
    }
  }

  return Object.values(vendorMap).map((v) => {
    const complianceRate = v.totalPurchases > 0 ? (v.matchedIn2B / v.totalPurchases) * 100 : 0;
    let grade = "A+";
    let risk = "low";
    if (complianceRate < 50) {
      grade = "D";
      risk = "high";
    } else if (complianceRate < 75) {
      grade = "C";
      risk = "medium";
    } else if (complianceRate < 90) {
      grade = "B";
      risk = "low";
    }

    return {
      ...v,
      complianceRate: Math.round(complianceRate),
      grade,
      risk,
    };
  });
}
