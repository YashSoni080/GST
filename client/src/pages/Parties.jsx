import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Callout, SkeletonTable, EmptyState, ErrorState } from '../components/ui';
import { useToast } from '../components/Toast';

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
  const toast = useToast();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupDetails, setLookupDetails] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    setError(null);
    const params = search ? { q: search } : {};
    api.getParties(params)
      .then(data => setParties(data.parties || data || []))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  const retry = () => {
    setLoading(true);
    load();
  };

  // Section 2.1: Dynamic Vendor & Customer Master via GSTN API
  const handleVerifyGSTIN = async () => {
    if (!form.gstin || form.gstin.length < 15) {
      toast.warning('Enter a 15-character GSTIN', 'A complete GSTIN is required to verify a taxpayer on the GSTN portal.');
      return;
    }
    setLookupLoading(true);
    setStatus('Verifying GSTIN with the GSTN portal…');
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
        toast.success('GSTN verification passed', `${d.tradeName || d.legalName} · ${d.taxpayerType} taxpayer, filing status fetched.`);
      } else {
        toast.warning('No active taxpayer found', 'This GSTIN returned no match — double-check the number or add the party manually.');
      }
    } catch (err) {
      toast.error('GSTIN verification failed', err.message);
    } finally {
      setLookupLoading(false);
      setStatus('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Saving party master…');
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
      toast.success('Party saved', 'Added to your master — now available on invoices and purchase vouchers.');
      load();
    } catch (err) {
      toast.error('Could not save this party', err.message);
    } finally {
      setStatus('');
    }
  };

  const handleRefreshRadar = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setStatus('Refreshing vendor compliance health scores…');
    try {
      const res = await api.post('/parties/refresh-scoring');
      toast.success(res.message || 'Vendor compliance health scores updated!', 'Compliance ratings and ITC risk flags were recalculated.');
      load();
    } catch (err) {
      toast.error('Could not refresh health scores', err.message);
    } finally {
      setRefreshing(false);
      setStatus('');
    }
  };

  const statusBadge = (s) => <span className={`badge ${s === 'active' ? 'green' : 'gray'}`}>{s}</span>;
  const typeBadge = (t) => {
    const map = { customer: 'blue', vendor: 'amber', both: 'green' };
    return <span className={`badge ${map[t] || 'gray'}`}>{t}</span>;
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="section-label">
            <span className="dot" aria-hidden="true" />
            Vendor & Customer Master · GSTIN Directory
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Master records with real-time GSTN portal verification, compliance ratings & risk profiling (Section 2.1)
          </div>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="input-label" htmlFor="party-search">Search</label>
            <input
              id="party-search"
              className="input"
              placeholder="Search GSTIN / business name"
              style={{ width: 220 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn outline"
            onClick={handleRefreshRadar}
            disabled={refreshing}
            aria-label="Refresh vendor compliance health scores"
          >
            {refreshing ? (
              <>
                <span className="spinner sm" aria-hidden="true" />
                Refreshing…
              </>
            ) : (
              '🛡️ Refresh Health Radar'
            )}
          </button>
          <button type="button" className="btn" onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
            {showForm ? 'Close form' : '+ Add Party'}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18, marginBottom: 8 }}>
        {status}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Party Master Directory</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                GSTIN, relationship, registration type, compliance health score and ITC risk per party
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 20, padding: 18, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label" htmlFor="party-gstin">GSTIN (15 Digits)</label>
                <input
                  id="party-gstin"
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
                {lookupLoading ? (
                  <>
                    <span className="spinner sm" aria-hidden="true" />
                    Verifying…
                  </>
                ) : (
                  '⚡ Verify with GSTN'
                )}
              </button>
            </div>

            {lookupDetails && (
              <Callout
                tone="success"
                icon="✓"
                title={`GSTN Verified: ${lookupDetails.legalName}`}
                description={
                  <>
                    Status: <strong>{lookupDetails.status}</strong> · {lookupDetails.constitution} · {lookupDetails.taxpayerType}
                    <br />
                    GSTR-1 ({lookupDetails.returnFilingStatus?.gstr1}) · GSTR-3B ({lookupDetails.returnFilingStatus?.gstr3b})
                  </>
                }
                actions={<span className="badge green">Compliance: {lookupDetails.complianceRating} / 5.0</span>}
                style={{ marginBottom: 16 }}
              />
            )}

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="party-name">Business / Trade Name</label>
                <input id="party-name" className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" htmlFor="party-type">Entity Relationship</label>
                <select id="party-type" className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="customer">Customer (Receivables)</option>
                  <option value="vendor">Vendor (Payables)</option>
                  <option value="both">Both (Customer & Vendor)</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="party-gst-type">GST Registration Category</label>
                <select id="party-gst-type" className="input" value={form.gstType} onChange={e => setForm({ ...form, gstType: e.target.value })}>
                  <option value="registered">Regular Taxpayer</option>
                  <option value="unregistered">Unregistered Consumer (B2C)</option>
                  <option value="composition">Composition Scheme</option>
                  <option value="SEZ">Special Economic Zone (SEZ)</option>
                  <option value="export">Deemed Export / Overseas</option>
                </select>
              </div>
              <div>
                <label className="input-label" htmlFor="party-state">State</label>
                <select
                  id="party-state"
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
                <label className="input-label" htmlFor="party-city">City</label>
                <input id="party-city" className="input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="input-label" htmlFor="party-email">Email Address</label>
                <input id="party-email" className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn outline small" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn small">Save Party Master</button>
            </div>
          </form>
        )}

        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} title="Could not load your party master" />
        ) : parties.length === 0 ? (
          search ? (
            <EmptyState
              icon="🔍"
              title={`No parties match "${search}"`}
              description="No GSTIN or business name in your master matches this search. Clear the search to see the full directory, or add this party if they are new."
              action={{ label: 'Clear search', onClick: () => setSearch('') }}
              secondaryAction={{ label: '+ Add Party', onClick: () => setShowForm(true) }}
            />
          ) : (
            <EmptyState
              icon="👥"
              title="Your party master is empty"
              description="Add customers and vendors with their GSTINs to auto-fill invoices, verify taxpayers live on the GSTN portal, and score compliance & ITC risk before you claim credit."
              action={{ label: '+ Add your first party', onClick: () => setShowForm(true) }}
              secondaryAction={{ label: 'Create an invoice', to: '/invoices' }}
            />
          )
        ) : (
          <>
            <div className="table-wrap">
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
                  {parties.map(p => {
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
                          <span className="mono" style={{ fontWeight: 600 }}>{p.gstin || '—'}</span>
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
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>Showing {parties.length} part{parties.length === 1 ? 'y' : 'ies'}{search ? ` matching "${search}"` : ''}</span>
              <span>{parties.filter(p => p.type === 'vendor' || p.type === 'both').length} vendors · {parties.filter(p => p.type === 'customer' || p.type === 'both').length} customers</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
