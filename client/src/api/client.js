const BASE = '/api';
const DEFAULT_TIMEOUT = 30000;

async function request(path, { method = 'GET', body, headers = {}, timeout = DEFAULT_TIMEOUT } = {}) {
  const token = localStorage.getItem('token');
  const controller = new AbortController();
  const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    signal: controller.signal,
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const raw = await res.text();
    let data = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = null; // non-JSON payload (HTML error page, proxy failure, ...)
      }
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    if (data === null && raw) {
      throw new Error('The server returned an unexpected response. Please try again.');
    }
    return data ?? {};
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    if (err instanceof TypeError) {
      throw new Error('Unable to reach the server. Please check that it is running.');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const api = {
  // Generic HTTP helpers
  get: (path, opts = {}) => request(path, { method: 'GET', ...opts }),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body, opts = {}) => request(path, { method: 'PATCH', body, ...opts }),
  put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
  delete: (path, opts = {}) => request(path, { method: 'DELETE', ...opts }),

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  me: () => request('/auth/me'),

  // Dashboard
  dashboard: () => request('/dashboard'),

  // Company & Multi-GSTIN
  getCompany: () => request('/company'),
  updateCompany: (data) => request('/company', { method: 'PATCH', body: data }),
  addGSTINBranch: (data) => request('/company/gstins', { method: 'POST', body: data }),
  setPrimaryBranch: (id) => request(`/company/gstins/${id}/set-primary`, { method: 'PATCH' }),

  // Invoices (Tier 1 & 2)
  getInvoices: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/invoices${q ? '?' + q : ''}`);
  },
  getInvoice: (id) => request(`/invoices/${id}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: data }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PATCH', body: data }),
  cancelInvoice: (id, reason) => request(`/invoices/${id}/cancel`, { method: 'POST', body: { reason } }),
  generateIRN: (id) => request(`/invoices/${id}/irn`, { method: 'POST' }),
  generateEWB: (id, data) => request(`/invoices/${id}/ewb`, { method: 'POST', body: data }),

  // Parties & Dynamic Lookup (Tier 1)
  getParties: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/parties${q ? '?' + q : ''}`);
  },
  getParty: (id) => request(`/parties/${id}`),
  createParty: (data) => request('/parties', { method: 'POST', body: data }),
  updateParty: (id, data) => request(`/parties/${id}`, { method: 'PATCH', body: data }),
  lookupGSTIN: (gstin) => request(`/parties/lookup-gstin/${encodeURIComponent(gstin)}`),

  // Purchases & IDP (Tier 1, 2, 3)
  getPurchases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/purchases${q ? '?' + q : ''}`);
  },
  createPurchase: (data) => request('/purchases', { method: 'POST', body: data }),
  parseIDPInvoice: (rawText, fileName) => request('/idp/parse', { method: 'POST', body: { rawText, fileName } }),

  // Returns & GSTR-9 (Tier 1 & 3)
  getReturns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/returns${q ? '?' + q : ''}`);
  },
  getReturn: (id) => request(`/returns/${id}`),
  compileReturn: (type, period) => request('/returns/generate', { method: 'POST', body: { type, period } }),
  submitReturn: (id, data = {}) => request(`/returns/${id}/submit`, { method: 'POST', body: data }),
  getReturnJSON: (id) => request(`/returns/${id}/json`),
  getGSTR9: (financialYear = '2025-26') => request(`/returns/annual/gstr9?financialYear=${financialYear}`),

  // Reconciliation (Tier 2)
  getReconRuns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/recon${q ? '?' + q : ''}`);
  },
  getReconRun: (id) => request(`/recon/${id}`),
  runRecon: (period) => request('/recon', { method: 'POST', body: { period } }),
  actionReconItem: (runId, itemId, action, note) =>
    request(`/recon/${runId}/item/${itemId}/action`, { method: 'PATCH', body: { action, note } }),
  notifyVendor: (runId, supplierGstin) =>
    request(`/recon/${runId}/notify-vendor`, { method: 'POST', body: { supplierGstin } }),
  ingest2B: (period, documents) => request('/recon/ingest-2b', { method: 'POST', body: { period, documents } }),

  // ITC & Optimization (Tier 3)
  getITC: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/itc${q ? '?' + q : ''}`);
  },
  getITCOptimizer: (period) => request(`/itc/optimizer${period ? '?period=' + period : ''}`),
  getRule37Tracker: () => request('/itc/rule37-tracker'),
  getSection17_5: () => request('/itc/section17-5'),

  // Notices & AI Legal Drafter (Tier 3)
  getNotices: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/notices${q ? '?' + q : ''}`);
  },
  getNotice: (id) => request(`/notices/${id}`),
  draftNoticeReply: (id) => request(`/notices/${id}/draft-reply`, { method: 'POST' }),
  settleNoticeDRC03: (id, data) => request(`/notices/${id}/settle-drc03`, { method: 'POST', body: data }),

  // Predictive Audit Radar (Tier 3)
  getAuditRadar: () => request('/audit-radar/score'),

  // Continuous Transaction Control (Tier 4)
  validateCTC: (data) => request('/ctc/validate', { method: 'POST', body: data }),

  // Smart Escrow Split-Payment (Tier 4)
  getEscrowTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/escrow${q ? '?' + q : ''}`);
  },
  createEscrowSplit: (data) => request('/escrow/split-bill', { method: 'POST', body: data }),
  releaseEscrow: (id, period) => request(`/escrow/${id}/release`, { method: 'POST', body: { period } }),

  // Conversational AI Assistant (Tier 4)
  queryAIAssistant: (query, options = {}) =>
    request('/assistant/query', { method: 'POST', body: { query, ...options }, timeout: 60000 }),

  // ERP Connectors & Import/Export (Tier 2)
  getERPConnectors: () => request('/erp/connectors'),
  importERPPurchases: (records, connector) =>
    request('/erp/import/purchases', { method: 'POST', body: { records, connector } }),

  // HSN Codes & Audit
  getHSNCodes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/hsn${q ? '?' + q : ''}`);
  },
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit${q ? '?' + q : ''}`);
  },
};
