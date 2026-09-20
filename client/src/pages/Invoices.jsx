import { useState, useEffect } from 'react';
import { api } from '../api/client';

const EMPTY_ITEM = { name: '', hsn: '', qty: 1, rate: 0, gstRate: 18, unit: 'NOS' };

function InvoiceForm({ parties, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    partyId: '',
    partyName: '',
    docType: 'invoice',
    invNo: '',
    date: new Date().toISOString().slice(0, 10),
    placeOfSupply: '',
    items: [{ ...EMPTY_ITEM }],
    notes: '',
  });

  const updateItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const calcTotals = () => {
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    for (const it of form.items) {
      const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      taxable += amt;
      const gst = (amt * (Number(it.gstRate) || 0)) / 100;
      cgst += gst / 2;
      sgst += gst / 2;
    }
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
  };

  const totals = calcTotals();

  const handlePartySelect = (e) => {
    const p = parties.find(p => p._id === e.target.value);
    if (p) setForm({ ...form, partyId: p._id, partyName: p.name });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      taxableValue: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      total: totals.total,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div>
          <label className="input-label">Party</label>
          <select className="input" value={form.partyId} onChange={handlePartySelect} required>
            <option value="">Select customer</option>
            {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="input-label">Invoice No.</label>
          <input className="input" value={form.invNo} onChange={e => setForm({ ...form, invNo: e.target.value })} required />
        </div>
        <div>
          <label className="input-label">Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST %</th><th>Amount</th><th></th></tr>
        </thead>
        <tbody>
          {form.items.map((item, idx) => {
            const amt = (Number(item.qty) || 0) * (Number(item.rate) || 0);
            return (
              <tr key={idx}>
                <td><input className="input" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} required /></td>
                <td><input className="input" value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} style={{ width: 90 }} required /></td>
                <td><input className="input" type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ width: 80 }} min="0" required /></td>
                <td><input className="input" type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} style={{ width: 100 }} min="0" required /></td>
                <td>
                  <select className="input" value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)} style={{ width: 90 }}>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>₹ {amt.toLocaleString('en-IN')}</td>
                <td>
                  {form.items.length > 1 && (
                    <button type="button" className="close-btn" onClick={() => removeItem(idx)}>✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button type="button" className="btn outline small" onClick={addItem} style={{ marginTop: 12 }}>+ Add item</button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 16, fontSize: 13.5 }}>
        <div>Taxable: <strong>₹ {totals.taxable.toLocaleString('en-IN')}</strong></div>
        <div>CGST: <strong>₹ {totals.cgst.toLocaleString('en-IN')}</strong></div>
        <div>SGST: <strong>₹ {totals.sgst.toLocaleString('en-IN')}</strong></div>
        <div style={{ fontSize: 15 }}>Total: <strong>₹ {totals.total.toLocaleString('en-IN')}</strong></div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn outline small" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn small">Save Invoice</button>
      </div>
    </form>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = filter !== 'all' ? { status: filter } : {};
    Promise.all([api.getInvoices(params), api.getParties()])
      .then(([inv, p]) => { setInvoices(inv.invoices || inv || []); setParties(p.parties || p || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const handleCreate = async (data) => {
    try {
      await api.createInvoice(data);
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this invoice?')) return;
    try {
      await api.cancelInvoice(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = { draft: 'amber', valid: 'green', IRN_PENDING: 'amber', IRN_GENERATED: 'green', pushed: 'blue', cancelled: 'red' };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  return (
    <>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3>Create E-Invoice</h3></div>
          <InvoiceForm parties={parties} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>E-Invoices</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="pills">
              {['all', 'draft', 'valid', 'IRN_GENERATED', 'pushed', 'cancelled'].map(f => (
                <span key={f} className={`pill${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f}
                </span>
              ))}
            </div>
            <button className="btn small" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Close' : '+ New Invoice'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Inv No.</th><th>Party</th><th>Date</th><th>Taxable</th><th>GST</th><th>Total</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(invoices || []).map(inv => (
                <tr key={inv._id}>
                  <td>{inv.invNo}</td>
                  <td>{inv.partyName}</td>
                  <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>₹ {Number(inv.taxableValue || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(inv.total || 0).toLocaleString('en-IN')}</td>
                  <td>{statusBadge(inv.status)}</td>
                  <td>
                    {inv.status !== 'cancelled' && (
                      <span className="link" onClick={() => handleCancel(inv._id)}>Cancel</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!invoices || invoices.length === 0) && (
                <tr><td colSpan={8} className="empty">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
