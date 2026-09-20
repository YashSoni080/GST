import { HSNCode } from "../models/HSNCode.js";

export async function searchHSN({ q = "", type = "" }) {
  const filter = {};
  if (type === "goods" || type === "service") filter.type = type;
  const s = String(q).trim();
  if (s) {
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ code: re }, { description: re }];
  }
  return HSNCode.find(filter).sort({ code: 1 }).limit(60).lean();
}

export async function getHSN(code) {
  return HSNCode.findOne({ code: String(code) }).lean();
}

export function rateFor(hsn, gstRate) {
  const r = hsn?.rate;
  if (r == null) return Number(gstRate) || 0;
  if (hsn.exempt) return 0;
  return r;
}