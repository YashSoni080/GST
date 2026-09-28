import { HSNCode } from "../models/HSNCode.js";

// Standard statutory rate mapping for common HSN/SAC prefixes
export const STATUTORY_HSN_DIRECTORY = {
  // Agricultural & basic foods (0% / 5%)
  "0401": { desc: "Milk and dairy produce", rate: 0, type: "goods" },
  "0701": { desc: "Potatoes, fresh or chilled", rate: 0, type: "goods" },
  "0901": { desc: "Coffee, whether or not roasted", rate: 5, type: "goods" },
  "1001": { desc: "Wheat and meslin", rate: 0, type: "goods" },
  "1006": { desc: "Rice", rate: 5, type: "goods" },
  "1511": { desc: "Palm oil and its fractions", rate: 5, type: "goods" },
  // Manufactured items, textiles & chemicals (5% / 12% / 18%)
  "3004": { desc: "Medicaments formulated for therapeutic uses", rate: 12, type: "goods" },
  "3923": { desc: "Articles for conveyance or packing of plastics", rate: 18, type: "goods" },
  "5208": { desc: "Woven fabrics of cotton", rate: 5, type: "goods" },
  "6109": { desc: "T-shirts, singlets and other vests, knitted", rate: 12, type: "goods" },
  "7208": { desc: "Flat-rolled products of iron or non-alloy steel", rate: 18, type: "goods" },
  "8471": { desc: "Automatic data processing machines & computers", rate: 18, type: "goods" },
  "8517": { desc: "Telephone sets, smartphones, transmission apparatus", rate: 18, type: "goods" },
  "8703": { desc: "Motor cars and other motor vehicles", rate: 28, type: "goods" },
  "8708": { desc: "Parts and accessories of motor vehicles", rate: 28, type: "goods" },
  // Services (SAC - starting with 99)
  "9954": { desc: "General construction services", rate: 18, type: "service" },
  "9965": { desc: "Goods transport services (GTA)", rate: 5, type: "service" },
  "9972": { desc: "Real estate services", rate: 18, type: "service" },
  "9982": { desc: "Legal and accounting services", rate: 18, type: "service" },
  "9983": { desc: "Information technology, consulting & software services", rate: 18, type: "service" },
  "9984": { desc: "Telecommunications and internet services", rate: 18, type: "service" },
  "9985": { desc: "Support services including office administration", rate: 18, type: "service" },
};

/**
 * Validates HSN/SAC code against statutory multi-tier requirements:
 * - 4-digits: Allowed for B2B supplies if annual turnover <= 5 Cr.
 * - 6-digits: Mandatory for turnover > 5 Cr, or all SAC service codes (99xxxx).
 * - 8-digits: Mandatory for exports/imports and notified chemical/pharma goods.
 */
export function validateHsnSacDigits(code, { turnover = 50000000, supplyType = "B2B", isExport = false } = {}) {
  const clean = String(code || "").trim().replace(/\s+/g, "");
  if (!clean || !/^\d+$/.test(clean)) {
    return {
      valid: false,
      tier: "invalid",
      message: "HSN/SAC must consist solely of numeric digits (4, 6, or 8 digits)",
      statutoryRate: null,
    };
  }

  const len = clean.length;
  if (![4, 6, 8].includes(len)) {
    return {
      valid: false,
      tier: `${len}-digit`,
      message: `Invalid digit length (${len}). Under GST Notification 78/2020, codes must be exactly 4, 6, or 8 digits.`,
      statutoryRate: null,
    };
  }

  // Services: SAC codes must start with 99 and be 6 digits
  if (clean.startsWith("99")) {
    if (len !== 6) {
      return {
        valid: false,
        tier: "SAC",
        message: "Service Accounting Codes (SAC) starting with 99 must be exactly 6 digits.",
        statutoryRate: null,
      };
    }
    const prefix4 = clean.slice(0, 4);
    const lookup = STATUTORY_HSN_DIRECTORY[prefix4] || STATUTORY_HSN_DIRECTORY[clean];
    return {
      valid: true,
      tier: "SAC-6-digit",
      type: "service",
      description: lookup?.desc || "Statutory Service Accounting Code",
      statutoryRate: lookup?.rate ?? 18,
      message: "Valid 6-digit SAC service code.",
    };
  }

  // Export / Import mandates 8 digits
  if (isExport && len < 8) {
    return {
      valid: false,
      tier: `${len}-digit`,
      message: "Mandatory 8-digit HSN code required for Export, SEZ, or Deemed Export transactions under Customs/Foreign Trade Policy.",
      statutoryRate: null,
    };
  }

  // Turnover > 5 Cr mandates minimum 6 digits
  if (turnover > 50000000 && len < 6) {
    return {
      valid: false,
      tier: "4-digit",
      message: "Enterprises with aggregate turnover exceeding ₹5 Crores must report minimum 6-digit HSN codes (Notification 78/2020-Central Tax).",
      statutoryRate: null,
    };
  }

  const prefix4 = clean.slice(0, 4);
  const lookup = STATUTORY_HSN_DIRECTORY[clean] || STATUTORY_HSN_DIRECTORY[prefix4];

  return {
    valid: true,
    tier: `${len}-digit`,
    type: "goods",
    description: lookup?.desc || "Standard Goods Commodity",
    statutoryRate: lookup?.rate ?? null,
    message: `Compliant ${len}-digit HSN classification.`,
  };
}

export async function searchHSN({ q = "", type = "" }) {
  const filter = {};
  if (type === "goods" || type === "service") filter.type = type;
  const s = String(q).trim();
  if (s) {
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ code: re }, { description: re }];
  }
  const dbResults = await HSNCode.find(filter).sort({ code: 1 }).limit(60).lean();
  
  // If query is provided and db results are few, supplement with static directory
  if (dbResults.length < 5 && s) {
    const staticMatches = [];
    for (const [code, meta] of Object.entries(STATUTORY_HSN_DIRECTORY)) {
      if (code.includes(s) || meta.desc.toLowerCase().includes(s.toLowerCase())) {
        if (!dbResults.some((d) => d.code === code)) {
          staticMatches.push({
            code,
            description: meta.desc,
            type: meta.type,
            rate: meta.rate,
            exempt: meta.rate === 0,
          });
        }
      }
    }
    return [...dbResults, ...staticMatches];
  }
  return dbResults;
}

export async function getHSN(code) {
  const fromDb = await HSNCode.findOne({ code: String(code) }).lean();
  if (fromDb) return fromDb;
  const clean = String(code || "").trim();
  const meta = STATUTORY_HSN_DIRECTORY[clean] || STATUTORY_HSN_DIRECTORY[clean.slice(0, 4)];
  if (meta) {
    return {
      code: clean,
      description: meta.desc,
      type: meta.type,
      rate: meta.rate,
      exempt: meta.rate === 0,
    };
  }
  return null;
}

export function rateFor(hsn, gstRate) {
  const r = hsn?.rate;
  if (r == null) return Number(gstRate) || 0;
  if (hsn.exempt) return 0;
  return r;
}