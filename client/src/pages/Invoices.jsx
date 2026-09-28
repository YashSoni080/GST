import { useState, useEffect } from 'react';
import { api } from '../api/client';

const EMPTY_ITEM = { name: '', hsn: '', qty: 1, rate: 0, gstRate: 18, unit: 'NOS' };

function InvoiceForm({ parties, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    partyId: '',
    partyName: '',
    docType: 'invoice',
    invNo: `GI-2026-${Math.floor(100 + Math.random() * 900)}`,
    date: new Date().toISOString().slice(0, 10),
    placeOfSupply: '',
    items: [{ ...EMPTY_ITEM }],
    notes: '',
    reverseCharge: false,
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
    const isInterState = form.placeOfSupply && !form.placeOfSupply.startsWith('27');
    for (const it of form.items) {
      const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      taxable += amt;
      const gst = (amt * (Number(it.gstRate) || 0)) / 100;
      if (isInterState) {
        igst += gst;
      } else {
        cgst += gst / 2;
        sgst += gst / 2;
      }
    }
    return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
  };

  const totals = calcTotals();

  const handlePartySelect = (e) => {
    const p = parties.find(p => p._id === e.target.value);
    if (p) {
      setForm({
        ...form,
        partyId: p._id,
        partyName: p.name,
        placeOfSupply: `${p.stateCode || '27'} ${p.state || 'Maharashtra'}`,
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row" style={{ marginBottom: 16 }}>
        <div>
          <label className="input-label">Document Type</label>
          <select
            className="input"
            value={form.docType}
            onChange={e => setForm({ ...form, docType: e.target.value })}
          >
            <option value="invoice">Tax Invoice (Rule 46)</option>
            <option value="billOfSupply">Bill of Supply (Exempt / Nil)</option>
            <option value="creditNote">Credit Note (Section 34)</option>
            <option value="debitNote">Debit Note (Section 34)</option>
            <option value="deliveryChallan">Delivery Challan (Rule 55)</option>
            <option value="SEZ">SEZ Supply (Zero Rated)</option>
            <option value="Export">Export with/without tax</option>
          </select>
        </div>
        <div>
          <label className="input-label">Customer / Recipient</label>
          <select className="input" value={form.partyId} onChange={handlePartySelect} required>
            <option value="">Select party from master</option>
            {parties.map(p => (
              <option key={p._id} value={p._id}>
                {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <div>
          <label className="input-label">Invoice / Document No.</label>
          <input className="input" value={form.invNo} onChange={e => setForm({ ...form, invNo: e.target.value })} required />
        </div>
        <div>
          <label className="input-label">Invoice Date</label>
          <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label className="input-label">Place of Supply (POS)</label>
          <input
            className="input"
            placeholder="e.g. 27 Maharashtra"
            value={form.placeOfSupply}
            onChange={e => setForm({ ...form, placeOfSupply: e.target.value })}
            required
          />
        </div>
      </div>

      {['creditNote', 'debitNote', 'deliveryChallan'].includes(form.docType) && (
        <div className="form-row" style={{ marginBottom: 16, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
          <div>
            <label className="input-label">Original Invoice No. (for Linking)</label>
            <input
              className="input"
              placeholder="e.g. GI-2026-101"
              value={form.originalInvNo || ''}
              onChange={e => setForm({ ...form, originalInvNo: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Original Invoice Date</label>
            <input
              className="input"
              type="date"
              value={form.originalInvDate || ''}
              onChange={e => setForm({ ...form, originalInvDate: e.target.value })}
            />
          </div>
          {form.docType === 'deliveryChallan' ? (
            <div>
              <label className="input-label">Challan Purpose (Rule 55)</label>
              <select
                className="input"
                value={form.challanPurpose || 'job_work'}
                onChange={e => setForm({ ...form, challanPurpose: e.target.value })}
              >
                <option value="job_work">Job Work Movement</option>
                <option value="supply_on_approval">Supply on Approval</option>
                <option value="transfer_to_branch">Transfer to Branch</option>
                <option value="transport_for_export">Transport for Export</option>
                <option value="other">Other Notified Purpose</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="input-label">Reason for Credit/Debit Note</label>
              <select
                className="input"
                value={form.reasonForIssuing || '01-Sales Return'}
                onChange={e => setForm({ ...form, reasonForIssuing: e.target.value })}
              >
                <option value="01-Sales Return">01-Sales Return</option>
                <option value="02-Post Sale Discount">02-Post Sale Discount</option>
                <option value="03-Deficiency in services">03-Deficiency in services</option>
                <option value="04-Correction in Invoice">04-Correction in Invoice</option>
                <option value="05-Change in POS">05-Change in POS</option>
                <option value="07-Others">07-Others</option>
              </select>
            </div>
          )}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Item Description</th>
            <th>HSN / SAC</th>
            <th>Qty</th>
            <th>Rate (₹)</th>
            <th>GST %</th>
            <th>Taxable (₹)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {form.items.map((item, idx) => {
            const amt = (Number(item.qty) || 0) * (Number(item.rate) || 0);
            return (
              <tr key={idx}>
                <td>
                  <input
                    className="input"
                    placeholder="Item name"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    required
                  />
                </td>
                <td>
                  <input
                    className="input"
                    placeholder="HSN"
                    value={item.hsn}
                    onChange={e => updateItem(idx, 'hsn', e.target.value)}
                    style={{ width: 100 }}
                    required
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    style={{ width: 80 }}
                    min="1"
                    required
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="number"
                    value={item.rate}
                    onChange={e => updateItem(idx, 'rate', e.target.value)}
                    style={{ width: 100 }}
                    min="0"
                    required
                  />
                </td>
                <td>
                  <select
                    className="input"
                    value={item.gstRate}
                    onChange={e => updateItem(idx, 'gstRate', e.target.value)}
                    style={{ width: 90 }}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  ₹ {amt.toLocaleString('en-IN')}
                </td>
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

      <button type="button" className="btn outline small" onClick={addItem} style={{ marginTop: 12 }}>
        + Add Item
      </button>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 16, fontSize: 13.5, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
        <div>Taxable: <strong>₹ {totals.taxable.toLocaleString('en-IN')}</strong></div>
        {totals.cgst > 0 && <div>CGST: <strong>₹ {totals.cgst.toLocaleString('en-IN')}</strong></div>}
        {totals.sgst > 0 && <div>SGST: <strong>₹ {totals.sgst.toLocaleString('en-IN')}</strong></div>}
        {totals.igst > 0 && <div>IGST: <strong>₹ {totals.igst.toLocaleString('en-IN')}</strong></div>}
        <div style={{ fontSize: 15, color: 'var(--primary)' }}>Invoice Total: <strong>₹ {totals.total.toLocaleString('en-IN')}</strong></div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn outline small" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn small">Save & Validate</button>
      </div>
    </form>
  );
}

// Modal for Generating e-Way Bill
function EWBModal({ invoice, onSubmit, onClose }) {
  const [vehicleNo, setVehicleNo] = useState('MH-04-AB-1290');
  const [transporterName, setTransporterName] = useState('VRL Logistics Ltd.');
  const [transporterId, setTransporterId] = useState('27AABCT1330L1Z2');
  const [mode, setMode] = useState('road');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(invoice._id, { vehicleNo, transporterName, transporterId, mode });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: '90%', maxWidth: 520, background: '#fff' }}>
        <div className="card-header">
          <h3>Generate Part-A & Part-B e-Way Bill</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Concurrently generate NIC compliant e-Way bill for Invoice <strong>{invoice.invNo}</strong> (Total ₹{invoice.total.toLocaleString('en-IN')}).
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">Vehicle Number</label>
            <input className="input" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} required />
          </div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div>
              <label className="input-label">Transporter Name</label>
              <input className="input" value={transporterName} onChange={e => setTransporterName(e.target.value)} required />
            </div>
            <div>
              <label className="input-label">Transporter ID (GSTIN)</label>
              <input className="input" value={transporterId} onChange={e => setTransporterId(e.target.value)} required />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="input-label">Mode of Transportation</label>
            <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
              <option value="air">Air</option>
              <option value="ship">Ship</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn outline small" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn small">Generate E-Way Bill</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Full Rule 46 Tax Invoice View & Print Modal with IRN, IRP Signed QR & Dynamic UPI QR
function InvoiceDetailModal({ invoice, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'grid', placeItems: 'center', overflowY: 'auto', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 780, background: '#fff', padding: 32, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>Greenshine Traders Pvt. Ltd.</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              GSTIN: <strong>{invoice.companyGstin}</strong> | State: Maharashtra (Code: 27)<br />
              Tower B, Bandra Kurla Complex, Mumbai - 400051 | PAN: AAACG1234F
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge blue" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>
              {invoice.docType === 'invoice' ? 'TAX INVOICE' : invoice.docType}
            </span>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rule 46 CGST Compliant</div>
            <button className="close-btn" onClick={onClose} style={{ marginTop: 8 }}>✕</button>
          </div>
        </div>

        {/* IRN & e-Way Bill Banners */}
        {invoice.irn && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✓ e-Invoice Authenticated via IRP</div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#15803d', wordBreak: 'break-all', marginTop: 2 }}>
                IRN: {invoice.irn}
              </div>
              <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                Ack No: {invoice.irnAckNo || '112610098412'} | Ack Date: {invoice.irnDate ? new Date(invoice.irnDate).toLocaleString('en-IN') : '2026-09-25'}
              </div>
            </div>
            {invoice.qrDataUrl && (
              <img src={invoice.qrDataUrl} alt="IRP Signed QR" style={{ width: 80, height: 80, marginLeft: 16, borderRadius: 4, border: '1px solid #bbf7d0' }} />
            )}
          </div>
        )}

        {invoice.ewb?.no && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
            <strong>e-Way Bill No:</strong> {invoice.ewb.no} | <strong>Vehicle:</strong> {invoice.ewb.vehicleNo} | <strong>Valid Till:</strong> {new Date(invoice.ewb.validTill).toLocaleDateString('en-IN')} ({invoice.ewb.distanceKm} km)
          </div>
        )}

        {/* Invoice Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, fontSize: 13 }}>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Bill To (Recipient)</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{invoice.partyName}</div>
            <div>GSTIN: {invoice.partyGstin || 'Unregistered / B2C'}</div>
            <div>State: {invoice.partyState || 'Maharashtra'} (Code: {invoice.partyStateCode || '27'})</div>
            <div>Place of Supply: <strong>{invoice.placeOfSupply}</strong></div>
          </div>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 }}>Invoice Details</div>
            <div>Invoice No: <strong>{invoice.invNo}</strong></div>
            <div>Date: {invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : '—'}</div>
            <div>Supply Type: <strong>{invoice.supplyType}</strong></div>
            <div>Reverse Charge: {invoice.reverseCharge ? 'Yes' : 'No'}</div>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ marginBottom: 20 }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Taxable</th>
              <th>GST Rate</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><strong>{it.name}</strong></td>
                <td>{it.hsn}</td>
                <td>{it.qty} {it.unit || 'NOS'}</td>
                <td>₹ {Number(it.rate).toLocaleString('en-IN')}</td>
                <td>₹ {Number(it.taxable).toLocaleString('en-IN')}</td>
                <td>{it.gstRate}%</td>
                <td style={{ textAlign: 'right' }}>
                  ₹ {Math.round(Number(it.taxable) * (1 + Number(it.gstRate) / 100)).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Dynamic UPI QR Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div>
            {invoice.upiQrDataUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <img src={invoice.upiQrDataUrl} alt="UPI Payment QR" style={{ width: 90, height: 90, borderRadius: 6 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>Dynamic UPI QR Code</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Scan with any UPI App (GPay, PhonePe, Paytm) to pay instantly.</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Amount: ₹ {Number(invoice.total || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
            )}
            {!invoice.upiQrDataUrl && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                <strong>Bank Payment Instructions:</strong><br />
                Bank: HDFC Bank Ltd | A/C: 50200012345678<br />
                IFSC: HDFC0000123 | Branch: BKC Mumbai
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: 13 }}>
            <div>Taxable Value: <strong>₹ {Number(invoice.taxableValue || 0).toLocaleString('en-IN')}</strong></div>
            {invoice.cgst > 0 && <div>CGST: <strong>₹ {Number(invoice.cgst || 0).toLocaleString('en-IN')}</strong></div>}
            {invoice.sgst > 0 && <div>SGST: <strong>₹ {Number(invoice.sgst || 0).toLocaleString('en-IN')}</strong></div>}
            {invoice.igst > 0 && <div>IGST: <strong>₹ {Number(invoice.igst || 0).toLocaleString('en-IN')}</strong></div>}
            <div style={{ fontSize: 18, color: 'var(--primary)', marginTop: 8 }}>
              Total Amount: <strong>₹ {Number(invoice.total || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 24 }}>For Greenshine Traders Pvt. Ltd.</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16 }}>Authorized Signatory</div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn outline small" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
          <button className="btn small" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [ewbTarget, setEwbTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const params = filter !== 'all' ? { status: filter } : {};
    Promise.all([api.getInvoices(params), api.getParties()])
      .then(([inv, p]) => {
        setInvoices(inv.invoices || inv || []);
        setParties(p.parties || p || []);
      })
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

  const handleGenerateIRN = async (id) => {
    try {
      await api.generateIRN(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateEWB = async (id, data) => {
    try {
      await api.generateEWB(id, data);
      setEwbTarget(null);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancel = async (id) => {
    const reason = prompt('Please enter cancellation reason (Data entry error / Order cancelled):');
    if (!reason) return;
    try {
      await api.cancelInvoice(id, reason);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = {
      draft: 'gray',
      valid: 'blue',
      IRN_GENERATED: 'green',
      EWB_GENERATED: 'green',
      pushed: 'teal',
      cancelled: 'red',
    };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  return (
    <>
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>Create Rule 46 Compliant Invoice</h3>
          </div>
          <InvoiceForm parties={parties} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {viewInvoice && <InvoiceDetailModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {ewbTarget && <EWBModal invoice={ewbTarget} onSubmit={handleGenerateEWB} onClose={() => setEwbTarget(null)} />}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>E-Invoices & Billing Register</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Generate Rule 46 invoices, push to IRP, auto-stamp signed QR & e-Way bills
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="pills">
              {['all', 'valid', 'IRN_GENERATED', 'EWB_GENERATED', 'cancelled'].map(f => (
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
          <div className="empty">Loading invoices...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Inv No.</th>
                <th>Party / Recipient</th>
                <th>Type</th>
                <th>Date</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Total</th>
                <th>IRN / EWB</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(invoices || []).map(inv => (
                <tr key={inv._id}>
                  <td>
                    <strong>{inv.invNo}</strong>
                    {inv.supplyType === 'B2C' && <span className="badge gray" style={{ fontSize: 10, marginLeft: 4 }}>B2C</span>}
                  </td>
                  <td>{inv.partyName}</td>
                  <td><span className="badge blue" style={{ fontSize: 10.5 }}>{inv.docType}</span></td>
                  <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}</td>
                  <td>₹ {Number(inv.taxableValue || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toLocaleString('en-IN')}</td>
                  <td><strong>₹ {Number(inv.total || 0).toLocaleString('en-IN')}</strong></td>
                  <td>
                    {inv.irn && <span className="badge green" title={inv.irn} style={{ fontSize: 10.5 }}>✓ IRN</span>}
                    {inv.ewb?.no && <span className="badge blue" style={{ fontSize: 10.5, marginLeft: 4 }}>✓ EWB</span>}
                    {!inv.irn && !inv.ewb?.no && <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>{statusBadge(inv.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="link" onClick={() => setViewInvoice(inv)}>View</span>
                      {inv.status !== 'cancelled' && !inv.irn && (
                        <button className="btn outline small" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => handleGenerateIRN(inv._id)}>
                          Generate IRN
                        </button>
                      )}
                      {inv.status !== 'cancelled' && !inv.ewb?.no && (
                        <button className="btn outline small" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setEwbTarget(inv)}>
                          + EWB
                        </button>
                      )}
                      {inv.status !== 'cancelled' && (
                        <span className="link" style={{ color: 'var(--red)' }} onClick={() => handleCancel(inv._id)}>
                          Cancel
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!invoices || invoices.length === 0) && (
                <tr><td colSpan={10} className="empty">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
