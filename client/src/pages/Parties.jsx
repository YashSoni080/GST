import { useState, useEffect } from 'react';
import { api } from '../api/client';

const STATES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '33': 'Tamil Nadu',
  '36': 'Telangana', '37': 'Andhra Pradesh',
};

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDetails, setLookupDetails] = useState(null);

  const [form, setForm] = useState({
    name: '',
    gstin: '',
    type: 'customer',
    gstType: 'registered',
    stateCode: '',
    state: '',
    city: '',
    address: '',
    email: '',
    phone: '',
  });

  const load = () => {
    const params = search ? { q: search } : {};
    api.getParties(params)
      .then(data => setParties(data.parties || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  // Section 2.1: Dynamic Vendor & Customer Master via GSTN API
  const handleVerifyGSTIN = async () => {
    if (!form.gstin || form.gstin.length < 15) {
      alert('Please enter a 15-character GSTIN to verify');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await api.lookupGSTIN(form.gstin);
      if (res.valid && res.data) {
        const d = res.data;
        setLookupDetails(d);
        setForm(prev => ({
          ...prev,
          name: d.tradeName || d.legalName,
          stateCode: d.stateCode,
          state: d.state,
          city: d.city,
          address: d.address,
          gstType: d.taxpayerType === 'Regular' ? 'registered' : 'composition',
        }));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createParty(form);
      setShowForm(false);
      setLookupDetails(null);
      setForm({
        name: '',
        gstin: '',
        type: 'customer',
        gstType: 'registered',
        stateCode: '',
        state: '',
        city: '',
        address: '',
        email: '',
        phone: '',
      });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (s) => <span className={`badge ${s === 'active' ? 'green' : 'gray'}`}>{s}</span>;
  const typeBadge = (t) => {
    const map = { customer: 'blue', vendor: 'amber', both: 'green' };
    return <span className={`badge ${map[t] || 'gray'}`}>{t}</span>;
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Dynamic Vendor & Customer Master (GSTIN Directory)</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Master records with real-time GSTN portal verification, compliance ratings & risk profiling (Section 2.1)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Search GSTIN / business name"
              style={{ width: 220 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className="btn outline small"
              onClick={async () => {
                try {
                  const res = await api.post('/parties/refresh-scoring');
                  alert(res.message || 'Vendor compliance health scores updated!');
                  load();
                } catch (err) {
                  alert(err.message);
                }
              }}
            >
              🛡️ Refresh Health Radar
            </button>
            <button className="btn small" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Close' : '+ Add Party'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 20, padding: 18, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">GSTIN (15 Digits)</label>
                <input
                  className="input"
                  placeholder="e.g. 27AABCA1234A1Z5"
                  value={form.gstin}
                  onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  maxLength={15}
                />
              </div>
              <button
                type="button"
                className="btn small"
                onClick={handleVerifyGSTIN}
                disabled={lookupLoading}
                style={{ height: 38 }}
              >
                {lookupLoading ? 'Verifying...' : '⚡ Verify with GSTN'}
              </button>
            </div>

            {/* GSTN Verification Preview Card */}
            {lookupDetails && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: 13 }}>
                    ✓ GSTN Verified: {lookupDetails.legalName}
                  </div>
                  <span className="badge green">Compliance: {lookupDetails.complianceRating} / 5.0</span>
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                  Status: <strong>{lookupDetails.status}</strong> | Constitution: {lookupDetails.constitution} | Type: {lookupDetails.taxpayerType}<br />
                  Filing Track Record: GSTR-1 ({lookupDetails.returnFilingStatus?.gstr1}) · GSTR-3B ({lookupDetails.returnFilingStatus?.gstr3b})
                </div>
              </div>
            )}

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Business / Trade Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">Entity Relationship</label>
                <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="customer">Customer (Receivables)</option>
                  <option value="vendor">Vendor (Payables)</option>
                  <option value="both">Both (Customer & Vendor)</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">GST Registration Category</label>
                <select className="input" value={form.gstType} onChange={e => setForm({ ...form, gstType: e.target.value })}>
                  <option value="registered">Regular Taxpayer</option>
                  <option value="unregistered">Unregistered Consumer (B2C)</option>
                  <option value="composition">Composition Scheme</option>
                  <option value="SEZ">Special Economic Zone (SEZ)</option>
                  <option value="export">Deemed Export / Overseas</option>
                </select>
              </div>
              <div>
                <label className="input-label">State</label>
                <select
                  className="input"
                  value={form.stateCode}
                  onChange={e => setForm({ ...form, stateCode: e.target.value, state: STATES[e.target.value] || '' })}
                >
                  <option value="">Select State</option>
                  {Object.entries(STATES).map(([code, name]) => (
                    <option key={code} value={code}>{code} - {name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 16 }}>
              <div>
                <label className="input-label">City</label>
                <input className="input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="input-label">Email Address</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn outline small" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn small">Save Party Master</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="empty">Loading parties...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Business Name</th>
                <th>GSTIN</th>
                <th>State</th>
                <th>Relationship</th>
                <th>Registration Type</th>
                <th>Compliance Health Score</th>
                <th>ITC Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(parties || []).map(p => {
                const compScore = p.complianceScore ?? 95;
                const compCat = p.complianceCategory || (compScore >= 90 ? 'Consistent' : compScore >= 60 ? 'Delayed Filer' : 'Chronic Non-Filer');
                const catBadgeClass = compCat === 'Consistent' ? 'green' : compCat === 'Delayed Filer' ? 'amber' : 'red';

                return (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.city && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.city}</div>}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.gstin || '—'}</span>
                    </td>
                    <td>{p.state || '—'} ({p.stateCode || '—'})</td>
                    <td>{typeBadge(p.type)}</td>
                    <td><span className="badge blue" style={{ fontSize: 11 }}>{p.gstType}</span></td>
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge ${catBadgeClass}`} style={{ fontWeight: 700 }}>
                            {compScore}/100 · {compCat}
                          </span>
                        </div>
                        {p.procurementAlert && (
                          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>
                            ⚠️ Procurement Alert: Non-Filer
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.itcRiskLevel === 'high' ? 'red' : p.itcRiskLevel === 'medium' ? 'amber' : 'green'}`}>
                        {p.itcRiskLevel?.toUpperCase() || 'LOW'}
                      </span>
                    </td>
                    <td>{statusBadge(p.status)}</td>
                  </tr>
                );
              })}
              {(!parties || parties.length === 0) && (
                <tr><td colSpan={8} className="empty">No parties found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
