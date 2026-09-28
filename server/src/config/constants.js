export const STATES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Andaman & Nicobar",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Tamil Nadu (Chennai)",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "96": "Other Territory",
};

export const UNION_TERRITORIES = new Set([
  "04", "26", "31", "32", "34", "38",
]);

export const ROLE_PERMISSIONS = {
  admin: {
    label: "Administrator",
    caps: "all",
  },
  accounting_manager: {
    label: "Accounting Manager",
    caps: [
      "dashboard:read", "invoices:read", "invoices:create", "invoices:edit",
      "invoices:cancel", "invoices:irn", "invoices:eway", "purchases:read",
      "purchases:create", "purchases:edit", "itc:read", "itc:action", "itc:optimize",
      "returns:read", "returns:submit", "returns:pay", "recon:read",
      "recon:run", "ims:read", "ims:action", "parties:read", "parties:create",
      "parties:edit", "hsn:read", "reports:read", "audit:read",
      "company:read", "company:edit", "notices:read", "notices:write",
      "ecommerce:read", "ecommerce:sync",
    ],
  },
  accountant: {
    label: "Accountant",
    caps: [
      "dashboard:read", "invoices:read", "invoices:create", "invoices:edit",
      "invoices:cancel", "invoices:irn", "invoices:eway", "purchases:read",
      "purchases:create", "purchases:edit", "itc:read", "itc:action",
      "returns:read", "returns:submit", "returns:pay", "recon:read",
      "recon:run", "ims:read", "ims:action", "parties:read", "parties:create",
      "parties:edit", "hsn:read", "reports:read", "audit:read",
      "company:read", "company:edit", "ecommerce:read", "ecommerce:sync",
    ],
  },
  billing_executive: {
    label: "Billing Executive",
    caps: [
      "dashboard:read", "invoices:read", "invoices:create", "invoices:edit",
      "invoices:cancel", "invoices:irn", "invoices:eway", "parties:read",
      "parties:create", "hsn:read", "reports:read", "company:read",
    ],
  },
  "data-entry": {
    label: "Data Entry",
    caps: [
      "dashboard:read", "invoices:read", "invoices:create", "invoices:edit",
      "invoices:cancel", "purchases:read", "purchases:create",
      "parties:read", "parties:create", "hsn:read", "reports:read",
      "company:read",
    ],
  },
  auditor: {
    label: "Auditor",
    caps: [
      "dashboard:read", "invoices:read", "purchases:read", "itc:read",
      "returns:read", "recon:read", "recon:run", "ims:read", "parties:read",
      "hsn:read", "reports:read", "audit:read", "company:read",
      "notices:read", "ecommerce:read",
    ],
  },
  external_ca: {
    label: "External Tax Auditor / CA",
    caps: [
      "dashboard:read", "invoices:read", "purchases:read", "itc:read",
      "returns:read", "recon:read", "recon:run", "ims:read", "parties:read",
      "hsn:read", "reports:read", "audit:read", "company:read",
      "notices:read", "notices:draft", "ecommerce:read",
    ],
  },
};

export function can(role, cap) {
  const def = ROLE_PERMISSIONS[role];
  if (!def) return false;
  if (def.caps === "all") return true;
  return def.caps.includes(cap);
}

export const GSTIN_RE =
  /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// 15th char (checksum) should be the alphanumeric successor of the 1st char
export function gstinChecksumValid(gstin) {
  if (gstin.length !== 15) return false;
  const first = gstin.charCodeAt(0);
  const check = gstin.charCodeAt(14);
  let next = first + 1;
  if (first >= 65 && first <= 90) {
    if (next > 90) next = 48; // wrap Z -> 0
  } else if (first >= 48 && first <= 57) {
    next = 65; // wrap 9 -> A
  }
  return check === next;
}

export const DOC_TYPES = {
  invoice: "Tax Invoice",
  billOfSupply: "Bill of Supply",
  deliveryChallan: "Delivery Challan",
  creditNote: "Credit Note",
  debitNote: "Debit Note",
};

export const INVOICE_STATUS = [
  "draft",
  "valid",
  "IRN_PENDING",
  "IRN_GENERATED",
  "EWB_GENERATED",
  "pushed",
  "cancelled",
];

export const SUPPLY_TYPES = ["B2B", "B2C", "SEZ", "Export", "DeemedExport"];

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;