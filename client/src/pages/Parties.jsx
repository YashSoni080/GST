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
  const [form, setForm] = useState({
    name: '', gstin: '', type: 'customer', gstType: 'registered',
    stateCode: '', state: '', city: '', address: '', email: '', phone: '',
  });

  const load = () => {
    const params = search ? { q: search } : {};
    api.getParties(params)
      .then(data => setParties(data.parties || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  const handleStateChange = (code) => {
    setForm({ ...form, stateCode: code, state: STATES[code] || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createParty(form);
      setShowForm(false);
      setForm({ name: '', gstin: '', type: 'customer', gstType: 'registered', stateCode: '', state: '', city: '', address: '', email: '', phone: '' });
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
          <h3>GSTIN Master</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Search GSTIN / name"
              style={{ width: 260 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="btn small" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Close' : '+ Add party'}
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">GSTIN</label>
                <input className="input" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="15-digit GSTIN" />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="input-label">GST Type</label>
                <select className="input" value={form.gstType} onChange={e => setForm({ ...form, gstType: e.target.value })}>
                  <option value="registered">Registered</option>
                  <option value="unregistered">Unregistered</option>
                  <option value="composition">Composition</option>
                  <option value="SEZ">SEZ</option>
                  <option value="export">Export</option>
                </select>
              </div>
              <div>
                <label className="input-label">State</label>
                <select className="input" value={form.stateCode} onChange={e => handleStateChange(e.target.value)}>
                  <option value="">Select state</option>
                  {Object.entries(STATES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn outline small" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn small">Save</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>GSTIN</th><th>State</th><th>Type</th><th>GST Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(parties || []).map(p => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.gstin || '—'}</td>
                  <td>{p.state || '—'}</td>
                  <td>{typeBadge(p.type)}</td>
                  <td>{p.gstType}</td>
                  <td>{statusBadge(p.status)}</td>
                </tr>
              ))}
              {(!parties || parties.length === 0) && (
                <tr><td colSpan={6} className="empty">No parties found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
