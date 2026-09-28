/**
 * Section 4.2: Dynamic Rule-Based ITC Optimization Engine
 * - Section 16 & 17(5) Blocked Credit Categorization
 * - Utilization Matrix Optimizer (Section 49/49A/49B)
 * - 180-Day Rule 37 Vendor Payment Tracker
 */

export function optimizeCreditUtilization({
  liability = { igst: 0, cgst: 0, sgst: 0 },
  itcBalance = { igst: 0, cgst: 0, sgst: 0 },
}) {
  let remLiabIgst = liability.igst;
  let remLiabCgst = liability.cgst;
  let remLiabSgst = liability.sgst;

  let remItcIgst = itcBalance.igst;
  let remItcCgst = itcBalance.cgst;
  let remItcSgst = itcBalance.sgst;

  const setOffMatrix = {
    igstAgainstIgst: 0,
    igstAgainstCgst: 0,
    igstAgainstSgst: 0,
    cgstAgainstCgst: 0,
    sgstAgainstSgst: 0,
    cgstAgainstIgst: 0,
    sgstAgainstIgst: 0,
  };

  // Step 1: IGST Credit must be completely exhausted first (Rule 88A)
  // Step 1a: IGST credit against IGST liability
  const useIgstForIgst = Math.min(remItcIgst, remLiabIgst);
  setOffMatrix.igstAgainstIgst = useIgstForIgst;
  remItcIgst -= useIgstForIgst;
  remLiabIgst -= useIgstForIgst;

  // Step 1b: Remaining IGST credit can be utilized against CGST and SGST in ANY proportion
  // To minimize cash outflow, divide remaining IGST credit equally or according to liability
  if (remItcIgst > 0) {
    const totalRemCgstSgstLiab = remLiabCgst + remLiabSgst;
    if (totalRemCgstSgstLiab > 0) {
      const cgstRatio = remLiabCgst / totalRemCgstSgstLiab;
      const targetCgstOffset = Math.min(remLiabCgst, Math.round(remItcIgst * cgstRatio));
      setOffMatrix.igstAgainstCgst = targetCgstOffset;
      remItcIgst -= targetCgstOffset;
      remLiabCgst -= targetCgstOffset;

      const targetSgstOffset = Math.min(remLiabSgst, remItcIgst);
      setOffMatrix.igstAgainstSgst = targetSgstOffset;
      remItcIgst -= targetSgstOffset;
      remLiabSgst -= targetSgstOffset;
    }
  }

  // Step 2: CGST credit against CGST liability (cannot be used for SGST)
  const useCgstForCgst = Math.min(remItcCgst, remLiabCgst);
  setOffMatrix.cgstAgainstCgst = useCgstForCgst;
  remItcCgst -= useCgstForCgst;
  remLiabCgst -= useCgstForCgst;

  // Step 2b: If IGST liability still remaining, CGST credit can offset IGST liability
  if (remLiabIgst > 0 && remItcCgst > 0) {
    const useCgstForIgst = Math.min(remItcCgst, remLiabIgst);
    setOffMatrix.cgstAgainstIgst = useCgstForIgst;
    remItcCgst -= useCgstForIgst;
    remLiabIgst -= useCgstForIgst;
  }

  // Step 3: SGST credit against SGST liability (cannot be used for CGST)
  const useSgstForSgst = Math.min(remItcSgst, remLiabSgst);
  setOffMatrix.sgstAgainstSgst = useSgstForSgst;
  remItcSgst -= useSgstForSgst;
  remLiabSgst -= useSgstForSgst;

  // Step 3b: If IGST liability still remaining, SGST credit can offset IGST liability
  if (remLiabIgst > 0 && remItcSgst > 0) {
    const useSgstForIgst = Math.min(remItcSgst, remLiabIgst);
    setOffMatrix.sgstAgainstIgst = useSgstForIgst;
    remItcSgst -= useSgstForIgst;
    remLiabIgst -= useSgstForIgst;
  }

  // Net Cash Payment Required via PMT-06 Challan
  const cashPayable = {
    igst: Math.max(0, remLiabIgst),
    cgst: Math.max(0, remLiabCgst),
    sgst: Math.max(0, remLiabSgst),
    total: Math.max(0, remLiabIgst) + Math.max(0, remLiabCgst) + Math.max(0, remLiabSgst),
  };

  const remainingCreditClosing = {
    igst: Math.max(0, remItcIgst),
    cgst: Math.max(0, remItcCgst),
    sgst: Math.max(0, remItcSgst),
    total: Math.max(0, remItcIgst) + Math.max(0, remItcCgst) + Math.max(0, remItcSgst),
  };

  return {
    setOffMatrix,
    cashPayable,
    remainingCreditClosing,
    cashOutlaySaved: Math.round(
      (liability.igst + liability.cgst + liability.sgst) - cashPayable.total
    ),
  };
}

/**
 * 180-Day Rule 37 Vendor Payment Tracker with 150-Day Warning Aging Calendar
 * Computes overdue vendor bills, mandatory reversal, and 18% p.a. interest under Section 50(1)
 */
export function track180DayRule37(purchases, asOfDate = new Date()) {
  const currentDate = new Date(asOfDate);
  const flagged = [];
  const approaching180 = [];

  const agingBuckets = {
    under90Days: { count: 0, totalAmount: 0 },
    between90And149Days: { count: 0, totalAmount: 0 },
    between150And180Days: { count: 0, totalAmount: 0, itcAtRisk: 0 },
    over180Days: { count: 0, totalAmount: 0, reversalDue: 0, interestDue: 0 },
  };

  let totalReversalDue = 0;
  let totalInterestDue = 0;
  let totalApproachingItc = 0;

  for (const p of purchases) {
    if (p.paymentStatus === "paid") continue;
    if (p.itcEligible === "no") continue; // blocked credits not availed, so no reversal needed

    const billDate = new Date(p.billDate);
    const diffTime = currentDate.getTime() - billDate.getTime();
    const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const unpaidRatio = p.total > 0 ? (p.total - (p.paidAmount || 0)) / p.total : 1;
    const unpaidAmount = p.total - (p.paidAmount || 0);
    const gstAtStake = Math.round((Number(p.gst || 0)) * unpaidRatio);

    if (daysElapsed < 90) {
      agingBuckets.under90Days.count++;
      agingBuckets.under90Days.totalAmount += unpaidAmount;
    } else if (daysElapsed < 150) {
      agingBuckets.between90And149Days.count++;
      agingBuckets.between90And149Days.totalAmount += unpaidAmount;
    } else if (daysElapsed <= 180) {
      // 150 - 180 Days: Amber Alert Warning (Action required before 180th day)
      agingBuckets.between150And180Days.count++;
      agingBuckets.between150And180Days.totalAmount += unpaidAmount;
      agingBuckets.between150And180Days.itcAtRisk += gstAtStake;
      totalApproachingItc += gstAtStake;

      approaching180.push({
        purchaseId: p._id,
        vendorName: p.vendorName,
        vendorGstin: p.vendorGstin,
        billNo: p.billNo,
        billDate: p.billDate,
        totalInvoiceAmount: p.total,
        paidAmount: p.paidAmount || 0,
        unpaidAmount,
        daysElapsed,
        daysRemaining: 180 - daysElapsed,
        itcAtRisk: gstAtStake,
        status: "warning_150_180_days",
        recommendation: `Schedule payment within ${180 - daysElapsed} days to prevent mandatory ITC clawback.`,
      });
    } else {
      // > 180 Days: Red Violation - Mandatory ITC Reversal + 18% p.a. interest
      const daysOverdue = daysElapsed - 180;
      const reversalTax = gstAtStake;
      const interestAmt = Math.round((reversalTax * 0.18 * daysOverdue) / 365);

      totalReversalDue += reversalTax;
      totalInterestDue += interestAmt;

      agingBuckets.over180Days.count++;
      agingBuckets.over180Days.totalAmount += unpaidAmount;
      agingBuckets.over180Days.reversalDue += reversalTax;
      agingBuckets.over180Days.interestDue += interestAmt;

      flagged.push({
        purchaseId: p._id,
        vendorName: p.vendorName,
        vendorGstin: p.vendorGstin,
        billNo: p.billNo,
        billDate: p.billDate,
        totalInvoiceAmount: p.total,
        paidAmount: p.paidAmount || 0,
        unpaidAmount,
        daysElapsed,
        daysOverdue,
        reversalTax,
        interestAmt,
        severity: daysElapsed > 210 ? "critical" : "warning",
        status: "reversal_mandatory",
      });
    }
  }

  return {
    asOfDate: currentDate.toISOString(),
    totalFlaggedBills: flagged.length,
    totalApproachingBills: approaching180.length,
    totalReversalDue,
    totalInterestDue,
    totalApproachingItc,
    agingBuckets,
    approachingPurchases: approaching180.sort((a, b) => a.daysRemaining - b.daysRemaining),
    flaggedPurchases: flagged.sort((a, b) => b.daysElapsed - a.daysElapsed),
  };
}

/**
 * Section 17(2) & Rule 42: Proportionate ITC Reversal for Inputs and Input Services
 * Calculates ineligible common credit attributed to exempt supplies and non-business use.
 */
export function calculateRule42Reversal({
  totalItc = 0,               // T: Total input tax on inputs & input services
  nonBusinessItc = 0,         // T1: Exclusively non-business use
  exemptSupplyItc = 0,        // T2: Exclusively exempt supplies
  blockedSection17_5Itc = 0,  // T3: Ineligible under Section 17(5)
  taxableSupplyItc = 0,       // T4: Exclusively taxable & zero-rated supplies
  exemptTurnover = 0,         // E: Exempt turnover during the period
  totalTurnover = 1,          // F: Total turnover during the period
}) {
  const T = Math.max(0, Number(totalItc) || 0);
  const T1 = Math.max(0, Number(nonBusinessItc) || 0);
  const T2 = Math.max(0, Number(exemptSupplyItc) || 0);
  const T3 = Math.max(0, Number(blockedSection17_5Itc) || 0);
  const T4 = Math.max(0, Number(taxableSupplyItc) || 0);
  const E = Math.max(0, Number(exemptTurnover) || 0);
  const F = Math.max(1, Number(totalTurnover) || 1);

  // C1: Common credit available in electronic credit ledger = T - (T1 + T2 + T3)
  const C1 = Math.max(0, T - (T1 + T2 + T3));

  // C2: Common credit remaining after deducting exclusively taxable credit = C1 - T4
  const C2 = Math.max(0, C1 - T4);

  // D1: Ineligible credit attributed to exempt supplies = (E / F) * C2
  const D1 = Math.round((E / F) * C2);

  // D2: Ineligible credit for non-business purpose = 5% of C2
  const D2 = Math.round(0.05 * C2);

  // C3: Net eligible common credit = C2 - (D1 + D2)
  const C3 = Math.max(0, C2 - (D1 + D2));

  // Total Rule 42 reversal to be added to output tax liability / GSTR-3B Table 4(B)(1)
  const totalRule42Reversal = D1 + D2;

  // Total Net Eligible Credit availed = T4 + C3
  const totalNetEligibleCredit = T4 + C3;

  return {
    formula: "Rule 42 (CGST Rules, 2017)",
    inputs: { totalItc: T, nonBusinessItc: T1, exemptSupplyItc: T2, blockedSection17_5Itc: T3, taxableSupplyItc: T4, exemptTurnover: E, totalTurnover: F },
    computations: {
      creditedToElectronicLedger_C1: C1,
      commonCredit_C2: C2,
      exemptCommonReversal_D1: D1,
      nonBusinessReversal_D2: D2,
      netEligibleCommonCredit_C3: C3,
    },
    totalRule42Reversal,
    totalNetEligibleCredit,
    gstr3bTableMapping: "Table 4(B)(1) - As per Rule 42 & 43 of CGST Rules",
  };
}

/**
 * Section 17(2) & Rule 43: Proportionate ITC Reversal for Capital Goods
 * Useful life of capital assets is statutory 60 months (5 years).
 */
export function calculateRule43Reversal({
  commonCapitalGoodsItc = 0, // Tr: Total ITC on common capital goods used for both taxable & exempt
  exemptTurnover = 0,        // E: Exempt turnover
  totalTurnover = 1,         // F: Total turnover
}) {
  const Tr = Math.max(0, Number(commonCapitalGoodsItc) || 0);
  const E = Math.max(0, Number(exemptTurnover) || 0);
  const F = Math.max(1, Number(totalTurnover) || 1);

  // Useful life: 60 months
  const usefulLifeMonths = 60;
  // Tm = Input tax attributed to useful life of one month = Tr / 60
  const Tm = Math.round(Tr / usefulLifeMonths);

  // Te = Common credit attributed to exempt supplies for the month = (E / F) * Tm
  const Te = Math.round((E / F) * Tm);

  return {
    formula: "Rule 43 (CGST Rules, 2017) - Capital Goods",
    usefulLifeMonths,
    commonCapitalGoodsItc: Tr,
    monthlyCapitalCredit_Tm: Tm,
    monthlyExemptReversal_Te: Te,
    annualizedReversal: Te * 12,
    gstr3bTableMapping: "Table 4(B)(1) - Ineligible ITC Reversal (Rule 43)",
  };
}

/**
 * Section 17(5) Ineligible / Blocked Credit Classifier
 */
export function classifySection17_5(category, description = "") {
  const text = (description + " " + category).toLowerCase();
  if (category === "motor_vehicles" || /car|vehicle|motor|fuel|cab|transport/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(a)",
      reason: "Motor vehicles for transportation of persons having approved seating capacity <= 13 persons",
    };
  }
  if (category === "food_and_beverages" || /food|catering|beverage|lunch|dinner|restaurant|refreshment/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(b)(i)",
      reason: "Food and beverages, outdoor catering, beauty treatment, health services",
    };
  }
  if (category === "club_membership_health" || /club|gym|fitness|membership|health insurance/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(b)(ii)",
      reason: "Membership of a club, health and fitness centre, life/health insurance",
    };
  }
  if (category === "personal_consumption" || /personal|gift|employee gift|sample/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(g)",
      reason: "Goods or services used for personal consumption or free gifts/samples",
    };
  }
  if (category === "goods_lost_stolen_destroyed" || /stolen|lost|damaged|destroyed|written off/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(h)",
      reason: "Goods lost, stolen, destroyed, written off or disposed of by way of gift or free samples",
    };
  }
  if (category === "works_contract_immovable" || /construction|civil work|building repair|interior/.test(text)) {
    return {
      blocked: true,
      section: "17(5)(c)",
      reason: "Works contract services for construction of an immovable property",
    };
  }
  return { blocked: false, section: "Section 16(1)", reason: "Eligible Input Tax Credit" };
}
