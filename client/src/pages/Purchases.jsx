import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vendorName: '', vendorGstin: '', billNo: '', billDate: '', taxableValue: '',
    cgst: '', sgst: '', igst: '', itcEligible: 'yes', notes: '',
  });

  const load = () => {
    api.getPurchases()
      .then(data => setPurchases(data.purchases || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const gst = (Number(form.cgst) || 0) + (Number(form.sgst) || 0) + (Number(form.igst) || 0);
      await api.createPurchase({ ...form, gst, total: Number(form.taxableValue) + gst });
      setShowForm(false);
      setForm({ vendorName: '', vendorGstin: '', billNo: '', billDate: '', taxableValue: '', cgst: '', sgst: '', igst: '', itcEligible: 'yes', notes: '' });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const itcBadge = (el) => {
    const map = { yes: 'green', no: 'red', partial: 'amber' };
    return <span className={`badge ${map[el] || 'gray'}`}>{el}</span>;
  };

  const reconBadge = (status) => {
    const map = { matched: 'green', mismatch: 'red', missing: 'amber', pending: 'gray', ims_pending: 'amber' };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>Purchase Register</h3>
          <button className="btn small" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close' : '+ Record purchase'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 16, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Vendor Name</label>
                <input className="input" value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">Vendor GSTIN</label>
                <input className="input" value={form.vendorGstin} onChange={e => setForm({ ...form, vendorGstin: e.target.value })} />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Bill No.</label>
                <input className="input" value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">Bill Date</label>
                <input className="input" type="date" value={form.billDate} onChange={e => setForm({ ...form, billDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Taxable Value</label>
                <input className="input" type="number" value={form.taxableValue} onChange={e => setForm({ ...form, taxableValue: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">CGST</label>
                <input className="input" type="number" value={form.cgst} onChange={e => setForm({ ...form, cgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label">SGST</label>
                <input className="input" type="number" value={form.sgst} onChange={e => setForm({ ...form, sgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label">IGST</label>
                <input className="input" type="number" value={form.igst} onChange={e => setForm({ ...form, igst: e.target.value })} />
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
              <tr><th>Vendor</th><th>Bill No.</th><th>Date</th><th>Taxable</th><th>GST</th><th>Total</th><th>ITC</th><th>Recon</th></tr>
            </thead>
            <tbody>
              {(purchases || []).map(p => (
                <tr key={p._id}>
                  <td>{p.vendorName}</td>
                  <td>{p.billNo}</td>
                  <td>{p.billDate ? new Date(p.billDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td>₹ {Number(p.taxableValue || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(p.gst || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(p.total || 0).toLocaleString('en-IN')}</td>
                  <td>{itcBadge(p.itcEligible)}</td>
                  <td>{reconBadge(p.reconStatus)}</td>
                </tr>
              ))}
              {(!purchases || purchases.length === 0) && (
                <tr><td colSpan={8} className="empty">No purchases recorded</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
