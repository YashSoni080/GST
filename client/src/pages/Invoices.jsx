import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { SkeletonTable, EmptyState, ErrorState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

const EMPTY_ITEM = { name: '', hsn: '', qty: 1, rate: 0, gstRate: 18, unit: 'NOS' };

const FILTERS = ['all', 'valid', 'IRN_GENERATED', 'EWB_GENERATED', 'cancelled'];

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
          <label className="input-label" htmlFor="inv-doc-type">Document Type</label>
          <select
            id="inv-doc-type"
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
          <label className="input-label" htmlFor="inv-party">Customer / Recipient</label>
          <select id="inv-party" className="input" value={form.partyId} onChange={handlePartySelect} required>
            <option value="">Select party from master</option>
            {parties.map(p => (
              <option key={p._id} value={p._id}>
                {p.name} {p.gstin ? `(${p.gstin})` : '(Unregistered)'}
              </option>
            ))}
          </select>
          {parties.length === 0 && (
            <div className="form-hint">No parties in your master yet — add customers & vendors under Parties first.</div>
          )}
        </div>
      </div>

      <div className="form-row-3" style={{ marginBottom: 16 }}>
        <div>
          <label className="input-label" htmlFor="inv-no">Invoice / Document No.</label>
          <input id="inv-no" className="input" value={form.invNo} onChange={e => setForm({ ...form, invNo: e.target.value })} required />
        </div>
        <div>
          <label className="input-label" htmlFor="inv-date">Invoice Date</label>
          <input id="inv-date" className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div>
          <label className="input-label" htmlFor="inv-pos">Place of Supply (POS)</label>
          <input
            id="inv-pos"
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
            <label className="input-label" htmlFor="inv-orig-no">Original Invoice No. (for Linking)</label>
            <input
              id="inv-orig-no"
              className="input"
              placeholder="e.g. GI-2026-101"
              value={form.originalInvNo || ''}
              onChange={e => setForm({ ...form, originalInvNo: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label" htmlFor="inv-orig-date">Original Invoice Date</label>
            <input
              id="inv-orig-date"
              className="input"
              type="date"
              value={form.originalInvDate || ''}
              onChange={e => setForm({ ...form, originalInvDate: e.target.value })}
            />
          </div>
          {form.docType === 'deliveryChallan' ? (
            <div>
              <label className="input-label" htmlFor="inv-challan-purpose">Challan Purpose (Rule 55)</label>
              <select
                id="inv-challan-purpose"
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
              <label className="input-label" htmlFor="inv-reason">Reason for Credit/Debit Note</label>
              <select
                id="inv-reason"
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>HSN / SAC</th>
              <th className="num">Qty</th>
              <th className="num">Rate (₹)</th>
              <th>GST %</th>
              <th className="num">Taxable (₹)</th>
              <th><span className="sr-only">Remove</span></th>
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
                      aria-label={`Item ${idx + 1} description`}
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
                      aria-label={`Item ${idx + 1} HSN or SAC code`}
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
                      aria-label={`Item ${idx + 1} quantity`}
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
                      aria-label={`Item ${idx + 1} rate`}
                      required
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={item.gstRate}
                      onChange={e => updateItem(idx, 'gstRate', e.target.value)}
                      style={{ width: 90 }}
                      aria-label={`Item ${idx + 1} GST rate`}
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    ₹ {amt.toLocaleString('en-IN')}
                  </td>
                  <td>
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        className="close-btn"
                        onClick={() => removeItem(idx)}
                        aria-label={`Remove item ${idx + 1}`}
                        title="Remove this line item"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn outline small" onClick={addItem} style={{ marginTop: 12 }}>
        + Add Item
      </button>

      <div className="section-label" style={{ marginTop: 18 }}>Live tax summary</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13.5, background: '#f8fafc', padding: 12, borderRadius: 8, flexWrap: 'wrap' }}>
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
    <Modal
      open
      onClose={onClose}
      title="Generate Part-A & Part-B e-Way Bill"
      subtitle={`NIC-compliant e-Way bill for invoice ${invoice.invNo} · Total ₹${invoice.total.toLocaleString('en-IN')}`}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="input-label" htmlFor="ewb-vehicle">Vehicle Number</label>
          <input id="ewb-vehicle" className="input" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} required />
        </div>
        <div className="form-row" style={{ marginBottom: 16 }}>
          <div>
            <label className="input-label" htmlFor="ewb-transporter">Transporter Name</label>
            <input id="ewb-transporter" className="input" value={transporterName} onChange={e => setTransporterName(e.target.value)} required />
          </div>
          <div>
            <label className="input-label" htmlFor="ewb-transporter-id">Transporter ID (GSTIN)</label>
            <input id="ewb-transporter-id" className="input" value={transporterId} onChange={e => setTransporterId(e.target.value)} required />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="input-label" htmlFor="ewb-mode">Mode of Transportation</label>
          <select id="ewb-mode" className="input" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
            <option value="air">Air</option>
            <option value="ship">Ship</option>
          </select>
        </div>
        <div className="modal-footer" style={{ marginTop: 0 }}>
          <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn small">Generate E-Way Bill</button>
        </div>
      </form>
    </Modal>
  );
}

// Full Rule 46 Tax Invoice View & Print Modal with IRN, IRP Signed QR & Dynamic UPI QR
function InvoiceDetailModal({ invoice, onClose }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Document ${invoice.invNo}`}
      subtitle={`${invoice.partyName} · Rule 46 CGST compliant · Print or save as PDF`}
      maxWidth={780}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>Greenshine Traders Pvt. Ltd.</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              GSTIN: <strong className="mono">{invoice.companyGstin}</strong> | State: Maharashtra (Code: 27)<br />
              Tower B, Bandra Kurla Complex, Mumbai - 400051 | PAN: AAACG1234F
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge blue" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>
              {invoice.docType === 'invoice' ? 'TAX INVOICE' : invoice.docType}
            </span>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rule 46 CGST Compliant</div>
          </div>
        </div>

        {invoice.irn && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✓ e-Invoice Authenticated via IRP</div>
              <div className="mono" style={{ fontSize: 11, color: '#15803d', wordBreak: 'break-all', marginTop: 2 }}>
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
            <strong>e-Way Bill No:</strong> <span className="mono">{invoice.ewb.no}</span> | <strong>Vehicle:</strong> {invoice.ewb.vehicleNo} | <strong>Valid Till:</strong> {new Date(invoice.ewb.validTill).toLocaleDateString('en-IN')} ({invoice.ewb.distanceKm} km)
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20, fontSize: 13 }}>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Bill To (Recipient)</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{invoice.partyName}</div>
            <div className="mono">GSTIN: {invoice.partyGstin || 'Unregistered / B2C'}</div>
            <div>State: {invoice.partyState || 'Maharashtra'} (Code: {invoice.partyStateCode || '27'})</div>
            <div>Place of Supply: <strong>{invoice.placeOfSupply}</strong></div>
          </div>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Invoice Details</div>
            <div>Invoice No: <strong className="mono">{invoice.invNo}</strong></div>
            <div>Date: {invoice.date ? new Date(invoice.date).toLocaleDateString('en-IN') : '—'}</div>
            <div>Supply Type: <strong>{invoice.supplyType}</strong></div>
            <div>Reverse Charge: {invoice.reverseCharge ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>HSN/SAC</th>
                <th className="num">Qty</th>
                <th className="num">Rate</th>
                <th className="num">Taxable</th>
                <th>GST Rate</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><strong>{it.name}</strong></td>
                  <td className="mono">{it.hsn}</td>
                  <td className="num">{it.qty} {it.unit || 'NOS'}</td>
                  <td className="num">₹ {Number(it.rate).toLocaleString('en-IN')}</td>
                  <td className="num">₹ {Number(it.taxable).toLocaleString('en-IN')}</td>
                  <td>{it.gstRate}%</td>
                  <td className="num">
                    <strong>₹ {Math.round(Number(it.taxable) * (1 + Number(it.gstRate) / 100)).toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
            <div>Taxable Value: <strong className="num">₹ {Number(invoice.taxableValue || 0).toLocaleString('en-IN')}</strong></div>
            {invoice.cgst > 0 && <div>CGST: <strong className="num">₹ {Number(invoice.cgst || 0).toLocaleString('en-IN')}</strong></div>}
            {invoice.sgst > 0 && <div>SGST: <strong className="num">₹ {Number(invoice.sgst || 0).toLocaleString('en-IN')}</strong></div>}
            {invoice.igst > 0 && <div>IGST: <strong className="num">₹ {Number(invoice.igst || 0).toLocaleString('en-IN')}</strong></div>}
            <div style={{ fontSize: 18, color: 'var(--primary)', marginTop: 8 }}>
              Total Amount: <strong>₹ {Number(invoice.total || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 24 }}>For Greenshine Traders Pvt. Ltd.</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 16 }}>Authorized Signatory</div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn outline small" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
          <button type="button" className="btn small" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Invoices() {
  const toast = useToast();
  const [invoices, setInvoices] = useState([]);
  const [parties, setParties] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [ewbTarget, setEwbTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  const load = () => {
    setError(null);
    const params = filter !== 'all' ? { status: filter } : {};
    Promise.all([api.getInvoices(params), api.getParties()])
      .then(([inv, p]) => {
        setInvoices(inv.invoices || inv || []);
        setParties(p.parties || p || []);
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const retry = () => {
    setLoading(true);
    load();
  };

  const handleCreate = async (data) => {
    setStatus('Saving and validating invoice…');
    try {
      await api.createInvoice(data);
      setShowForm(false);
      toast.success('Invoice created', 'Rule 46 invoice saved and added to your billing register.');
      load();
    } catch (err) {
      toast.error('Could not create this invoice', err.message);
    } finally {
      setStatus('');
    }
  };

  const handleGenerateIRN = async (id) => {
    setStatus('Pushing invoice to the IRP for IRN…');
    try {
      await api.generateIRN(id);
      toast.success('IRN generated', 'The IRP-signed invoice number is now stamped on this document.');
      load();
    } catch (err) {
      toast.error('IRN generation failed', err.message);
    } finally {
      setStatus('');
    }
  };

  const handleGenerateEWB = async (id, data) => {
    setStatus('Generating e-Way bill with GSTN…');
    try {
      await api.generateEWB(id, data);
      setEwbTarget(null);
      toast.success('e-Way bill generated', `Part-A & Part-B filed for vehicle ${data.vehicleNo}.`);
      load();
    } catch (err) {
      toast.error('e-Way bill generation failed', err.message);
    } finally {
      setStatus('');
    }
  };

  const handleCancel = (id) => {
    const target = invoices.find(i => i._id === id);
    setCancelTarget(target || { _id: id });
    setCancelReason('');
  };

  const confirmCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason || !cancelTarget) return;
    setCancelSaving(true);
    setStatus('Cancelling invoice…');
    try {
      await api.cancelInvoice(cancelTarget._id, reason);
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Invoice cancelled', 'The cancellation reason is stored with the document for your audit trail.');
      load();
    } catch (err) {
      toast.error('Could not cancel this invoice', err.message);
    } finally {
      setCancelSaving(false);
      setStatus('');
    }
  };

  const statusBadge = (s) => {
    const map = {
      draft: 'gray',
      valid: 'blue',
      IRN_GENERATED: 'green',
      EWB_GENERATED: 'green',
      pushed: 'green',
      cancelled: 'red',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{s}</span>;
  };

  const filterLabel = filter === 'all' ? 'All statuses' : filter.replace(/_/g, ' ');

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="pills" role="group" aria-label="Filter invoices by status">
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              className={`pill${filter === f ? ' active' : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
            {showForm ? 'Close form' : '+ New Invoice'}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18, marginBottom: 8 }}>
        {status}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Create Rule 46 Compliant Invoice</h3>
            </div>
          </div>
          <InvoiceForm parties={parties} onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {viewInvoice && <InvoiceDetailModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {ewbTarget && <EWBModal invoice={ewbTarget} onSubmit={handleGenerateEWB} onClose={() => setEwbTarget(null)} />}

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel invoice"
        subtitle={cancelTarget ? `${cancelTarget.invNo} · ${cancelTarget.partyName || ''}` : ''}
        maxWidth={460}
        footer={
          <>
            <button type="button" className="btn ghost small" onClick={() => setCancelTarget(null)}>Keep invoice</button>
            <button
              type="button"
              className="btn danger small"
              onClick={confirmCancel}
              disabled={!cancelReason.trim() || cancelSaving}
            >
              {cancelSaving ? 'Cancelling…' : 'Cancel invoice'}
            </button>
          </>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="cancel-reason">Cancellation reason</label>
          <textarea
            id="cancel-reason"
            className="input"
            rows={3}
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="e.g. Data entry error / Order cancelled"
          />
          <div className="form-hint">
            A reason is mandatory — it is stored with the document and reported in your GSTR-1 amendment tables.
          </div>
        </div>
      </Modal>

      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>E-Invoices & Billing Register</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Generate Rule 46 invoices, push to IRP, auto-stamp signed QR & e-Way bills
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} title="Could not load your invoice register" />
        ) : invoices.length === 0 ? (
          filter === 'all' ? (
            <EmptyState
              icon="🧾"
              title="No invoices issued yet"
              description="Issue your first Rule 46 tax invoice to compile GSTR-1, e-invoice IRNs, e-Way bills and tax breakdowns automatically."
              action={{ label: '+ New Invoice', onClick: () => setShowForm(true) }}
              secondaryAction={{ label: 'Add customers & parties', to: '/parties' }}
            />
          ) : (
            <EmptyState
              icon="🔍"
              title={`No invoices with status "${filterLabel}"`}
              description="No documents in your register match this status filter yet. Switch back to the full register or issue a new invoice."
              action={{ label: 'Show all invoices', onClick: () => setFilter('all') }}
              secondaryAction={{ label: '+ New Invoice', onClick: () => setShowForm(true) }}
            />
          )
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Inv No.</th>
                    <th>Party / Recipient</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th className="num">Taxable</th>
                    <th className="num">GST</th>
                    <th className="num">Total</th>
                    <th>IRN / EWB</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv._id}>
                      <td>
                        <strong>{inv.invNo}</strong>
                        {inv.supplyType === 'B2C' && <span className="badge gray" style={{ fontSize: 10, marginLeft: 4 }}>B2C</span>}
                      </td>
                      <td>{inv.partyName}</td>
                      <td><span className="badge blue" style={{ fontSize: 10.5 }}>{inv.docType}</span></td>
                      <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="num">₹ {Number(inv.taxableValue || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toLocaleString('en-IN')}</td>
                      <td className="num"><strong>₹ {Number(inv.total || 0).toLocaleString('en-IN')}</strong></td>
                      <td>
                        {inv.irn && <span className="badge green" title={inv.irn} style={{ fontSize: 10.5 }}>✓ IRN</span>}
                        {inv.ewb?.no && <span className="badge blue" style={{ fontSize: 10.5, marginLeft: 4 }}>✓ EWB</span>}
                        {!inv.irn && !inv.ewb?.no && <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn ghost tiny"
                            onClick={() => setViewInvoice(inv)}
                            aria-label={`View invoice ${inv.invNo}`}
                          >
                            View
                          </button>
                          {inv.status !== 'cancelled' && !inv.irn && (
                            <button
                              type="button"
                              className="btn outline tiny"
                              onClick={() => handleGenerateIRN(inv._id)}
                              aria-label={`Generate IRN for invoice ${inv.invNo}`}
                            >
                              Generate IRN
                            </button>
                          )}
                          {inv.status !== 'cancelled' && !inv.ewb?.no && (
                            <button
                              type="button"
                              className="btn outline tiny"
                              onClick={() => setEwbTarget(inv)}
                              aria-label={`Add e-Way bill for invoice ${inv.invNo}`}
                            >
                              + EWB
                            </button>
                          )}
                          {inv.status !== 'cancelled' && (
                            <button
                              type="button"
                              className="btn ghost tiny"
                              style={{ color: 'var(--red)' }}
                              onClick={() => handleCancel(inv._id)}
                              aria-label={`Cancel invoice ${inv.invNo}`}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                Showing {invoices.length} invoice{invoices.length === 1 ? '' : 's'} · Filter: {filterLabel}
              </span>
              <span>Last refreshed {new Date().toLocaleTimeString('en-IN')}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
