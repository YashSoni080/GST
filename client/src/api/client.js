const BASE = '/api';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  me: () => request('/auth/me'),

  dashboard: () => request('/dashboard'),
  dashboardStats: () => request('/dashboard/stats'),

  getInvoices: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/invoices${q ? '?' + q : ''}`);
  },
  getInvoice: (id) => request(`/invoices/${id}`),
  createInvoice: (data) => request('/invoices', { method: 'POST', body: data }),
  updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PATCH', body: data }),
  cancelInvoice: (id) => request(`/invoices/${id}/cancel`, { method: 'POST' }),

  getParties: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/parties${q ? '?' + q : ''}`);
  },
  getParty: (id) => request(`/parties/${id}`),
  createParty: (data) => request('/parties', { method: 'POST', body: data }),
  updateParty: (id, data) => request(`/parties/${id}`, { method: 'PATCH', body: data }),

  getPurchases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/purchases${q ? '?' + q : ''}`);
  },
  createPurchase: (data) => request('/purchases', { method: 'POST', body: data }),

  getReturns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/returns${q ? '?' + q : ''}`);
  },
  getReturn: (id) => request(`/returns/${id}`),
  submitReturn: (id) => request(`/returns/${id}/submit`, { method: 'POST' }),

  getITC: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/itc${q ? '?' + q : ''}`);
  },

  getHSNCodes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/hsn${q ? '?' + q : ''}`);
  },

  getReconRuns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/recon${q ? '?' + q : ''}`);
  },
  runRecon: (period) => request('/recon', { method: 'POST', body: { period } }),

  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/audit${q ? '?' + q : ''}`);
  },
};
