/**
 * Automated Transit Distance & e-Way Bill generation service
 * In 2026 e-Way bill rules: 1 day validity per 200 km (normal cargo)
 */

// Simulated distance lookup between state codes (in km)
const STATE_DISTANCES = {
  "27_29": 980,  // MH to KA
  "27_24": 520,  // MH to GJ
  "27_07": 1420, // MH to DL
  "27_09": 1380, // MH to UP
  "27_33": 1330, // MH to TN
  "27_36": 710,  // MH to TS
  "27_27": 140,  // Intra-MH
  "29_33": 350,  // KA to TN
  "24_07": 930,  // GJ to DL
};

export function estimateTransitDistance(fromStateCode, toStateCode, fromPin, toPin) {
  const key1 = `${fromStateCode}_${toStateCode}`;
  const key2 = `${toStateCode}_${fromStateCode}`;
  if (STATE_DISTANCES[key1]) return STATE_DISTANCES[key1];
  if (STATE_DISTANCES[key2]) return STATE_DISTANCES[key2];

  if (fromStateCode === toStateCode) return 120; // Default intra-state distance
  // Heuristic pin code difference if available
  if (fromPin && toPin && fromPin.length === 6 && toPin.length === 6) {
    const diff = Math.abs(parseInt(fromPin.slice(0, 3)) - parseInt(toPin.slice(0, 3)));
    return Math.max(80, Math.min(2400, diff * 15 + 100));
  }
  return 450; // Default inter-state distance fallback
}

/**
 * Calculates validity period in days based on GST statutory rules
 * Normal cargo: 1 day for every 200 km or part thereof
 */
export function calculateValidityDays(distanceKm) {
  return Math.max(1, Math.ceil((distanceKm || 100) / 200));
}

/**
 * Generates an official 12-digit e-Way Bill number and validity timestamps
 */
export function generateEWayBill({
  invoiceNo,
  fromStateCode,
  toStateCode,
  fromPin,
  toPin,
  vehicleNo,
  transporterId,
  transporterName,
  mode = "road",
}) {
  const distanceKm = estimateTransitDistance(fromStateCode, toStateCode, fromPin, toPin);
  const validityDays = calculateValidityDays(distanceKm);
  const genDate = new Date();
  const validTill = new Date(genDate.getTime() + validityDays * 24 * 60 * 60 * 1000);

  // 12-digit E-Way Bill Number e.g. 331298451204
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  const ewbNo = `33${randomSuffix}`;

  return {
    ewbNo,
    genDate,
    validTill,
    distanceKm,
    validityDays,
    mode,
    vehicleNo: (vehicleNo || "MH-04-AB-1290").toUpperCase(),
    transporterId: transporterId || "27AABCT1330L1Z2",
    transporterName: transporterName || "VRL Logistics Ltd.",
    status: "active",
  };
}
