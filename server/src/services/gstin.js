import { STATES, GSTIN_RE, gstinChecksumValid } from "../config/constants.js";

export { STATES };

export function parseGSTIN(gstin) {
  if (!gstin) return null;
  const s = String(gstin).replace(/\s+/g, "").toUpperCase();
  if (!GSTIN_RE.test(s)) return null;
  const stateCode = s.slice(0, 2);
  return {
    gstin: s,
    stateCode,
    state: STATES[stateCode] || `State ${stateCode}`,
    pan: s.slice(2, 12),
    entity: s.slice(12, 13),
    checksumOk: gstinChecksumValid(s),
    valid: true,
  };
}

// Full validation with per-failure diagnostics (used by smart-error-validation)
export function validateGSTIN(gstin) {
  const r = parseGSTIN(gstin);
  if (!r) {
    return { valid: false, errors: ["Invalid GSTIN format. Expected 2 digit state + 10 char PAN + entity + Z + checksum."] };
  }
  const errors = [];
  if (!r.checksumOk) errors.push("Checksum character mismatch (15th char).");
  if (!STATES[r.stateCode] || r.stateCode === "96") {
    errors.push(`Unknown state code '${r.stateCode}' in GSTIN.`);
  }
  return { valid: errors.length === 0, errors, stateCode: r.stateCode, state: r.state };
}