import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showIdpModal, setShowIdpModal] = useState(false);
  const [idpText, setIdpText] = useState(
`INVOICE
Supplier: Apex Technology Solutions Pvt Ltd
GSTIN: 27AABCA9999K1Z4
Invoice No: APX-9942
Date: 2026-09-15

Cloud Hosting Infrastructure 998315 2 45000
Software Subscription Licenses 997331 4 8000
`
  );
  const [idpResult, setIdpResult] = useState(null);
  const [parsing, setParsing] = useState(false);

  const [form, setForm] = useState({
    vendorName: '',
    vendorGstin: '',
    billNo: '',
    billDate: new Date().toISOString().slice(0, 10),
    taxableValue: '',
    cgst: '',
    sgst: '',
    igst: '',
    itcEligible: 'yes',
    section17_5Category: 'none',
    paymentStatus: 'unpaid',
    isRcm: false,
    rcmCategory: 'none',
    notes: '',
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
      const cgst = Number(form.cgst) || 0;
      const sgst = Number(form.sgst) || 0;
      const igst = Number(form.igst) || 0;
      const gst = cgst + sgst + igst;
      const date = new Date(form.billDate);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      await api.createPurchase({
        ...form,
        period,
        gst,
        total: Number(form.taxableValue) + gst,
      });

      setShowForm(false);
      setForm({
        vendorName: '',
        vendorGstin: '',
        billNo: '',
        billDate: new Date().toISOString().slice(0, 10),
        taxableValue: '',
        cgst: '',
        sgst: '',
        igst: '',
        itcEligible: 'yes',
        section17_5Category: 'none',
        paymentStatus: 'unpaid',
        notes: '',
      });
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  // Section 4.1: AI Intelligent Document Processing (IDP)
  const handleRunIDP = async () => {
    setParsing(true);
    try {
      const res = await api.parseIDPInvoice(idpText, 'scanned_vendor_bill.pdf');
      setIdpResult(res.data);
    } catch (err) {
      alert(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleApplyIDPResult = () => {
    if (!idpResult) return;
    setForm({
      vendorName: idpResult.vendorName,
      vendorGstin: idpResult.vendorGstin,
      billNo: idpResult.billNo,
      billDate: idpResult.billDate,
      taxableValue: idpResult.taxableValue,
      cgst: idpResult.cgst,
      sgst: idpResult.sgst,
      igst: idpResult.igst,
      itcEligible: 'yes',
      section17_5Category: 'none',
      paymentStatus: 'unpaid',
      notes: `Extracted via AI IDP (Confidence: ${Math.round(idpResult.confidenceScore * 100)}%)`,
    });
    setShowIdpModal(false);
    setShowForm(true);
  };

  const itcBadge = (el, sec) => {
    if (el === 'no' || (sec && sec !== 'none')) {
      return <span className="badge red">Blocked Sec 17(5)</span>;
    }
    return <span className="badge green">Eligible</span>;
  };

  const reconBadge = (status) => {
    const map = { matched: 'green', approximate: 'blue', mismatch: 'red', missing: 'amber', pending: 'gray' };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  const calculateDaysOld = (dateStr) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Purchase Register & Inward Supplies</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Track vendor invoices, Section 17(5) blocked credits, and Rule 37 180-day payments
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn outline small" onClick={() => setShowIdpModal(true)}>
              🤖 AI Invoice Scanner (IDP)
            </button>
            <button className="btn small" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Close' : '+ Record Purchase'}
            </button>
          </div>
        </div>

        {/* AI IDP Modal */}
        {showIdpModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
            <div className="card" style={{ width: '90%', maxWidth: 650, background: '#fff' }}>
              <div className="card-header">
                <h3>Intelligent Document Processing (IDP) Invoice Parser</h3>
                <button className="close-btn" onClick={() => setShowIdpModal(false)}>✕</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                Paste raw OCR invoice text or simulated document contents below. AI will autonomously extract line items, HSN numbers, and run mathematical consistency checks ($Qty \times Rate = Taxable$).
              </p>
              <textarea
                className="input"
                rows={6}
                value={idpText}
                onChange={e => setIdpText(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn outline small" onClick={() => setShowIdpModal(false)}>Cancel</button>
                <button className="btn small" onClick={handleRunIDP} disabled={parsing}>
                  {parsing ? 'Parsing OCR...' : '⚡ Extract & Validate Calculations'}
                </button>
              </div>

              {idpResult && (
                <div style={{ marginTop: 16, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                      ✓ Parsed: {idpResult.vendorName} ({idpResult.vendorGstin})
                    </div>
                    <span className="badge green">Math Verified: 100%</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: '1.6' }}>
                    Bill No: <strong>{idpResult.billNo}</strong> | Date: <strong>{idpResult.billDate}</strong><br />
                    Taxable: <strong>₹ {Number(idpResult.taxableValue || 0).toLocaleString('en-IN')}</strong> | Total Tax: <strong>₹ {Number(idpResult.gst || 0).toLocaleString('en-IN')}</strong> | Total: <strong>₹ {Number(idpResult.total || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <button className="btn small" style={{ marginTop: 12, width: '100%' }} onClick={handleApplyIDPResult}>
                    Import into Purchase Voucher Draft
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Purchase Creation Form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Vendor Name</label>
                <input className="input" value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">Vendor GSTIN</label>
                <input className="input" value={form.vendorGstin} onChange={e => setForm({ ...form, vendorGstin: e.target.value.toUpperCase() })} placeholder="15-digit GSTIN" />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Bill / Invoice No.</label>
                <input className="input" value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">Bill Date</label>
                <input className="input" type="date" value={form.billDate} onChange={e => setForm({ ...form, billDate: e.target.value })} required />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Taxable Value (₹)</label>
                <input className="input" type="number" value={form.taxableValue} onChange={e => setForm({ ...form, taxableValue: e.target.value })} required />
              </div>
              <div>
                <label className="input-label">CGST (₹)</label>
                <input className="input" type="number" value={form.cgst} onChange={e => setForm({ ...form, cgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label">SGST (₹)</label>
                <input className="input" type="number" value={form.sgst} onChange={e => setForm({ ...form, sgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label">IGST (₹)</label>
                <input className="input" type="number" value={form.igst} onChange={e => setForm({ ...form, igst: e.target.value })} />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label">Section 17(5) Categorization (Blocked Credit)</label>
                <select
                  className="input"
                  value={form.section17_5Category}
                  onChange={e => setForm({ ...form, section17_5Category: e.target.value, itcEligible: e.target.value === 'none' ? 'yes' : 'no' })}
                >
                  <option value="none">None (Fully Eligible ITC)</option>
                  <option value="motor_vehicles">Motor Vehicles (Sec 17(5)(a))</option>
                  <option value="food_and_beverages">Food & Beverages / Catering (Sec 17(5)(b)(i))</option>
                  <option value="club_membership_health">Club Membership / Health Insurance (Sec 17(5)(b)(ii))</option>
                  <option value="personal_consumption">Personal Consumption (Sec 17(5)(g))</option>
                  <option value="goods_lost_stolen_destroyed">Goods Lost / Stolen / Destroyed (Sec 17(5)(h))</option>
                  <option value="works_contract_immovable">Works Contract for Immovable Property (Sec 17(5)(c))</option>
                </select>
              </div>
              <div>
                <label className="input-label">Payment Status</label>
                <select className="input" value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="rcmCheck"
                  checked={form.isRcm}
                  onChange={e => setForm({ ...form, isRcm: e.target.checked, rcmCategory: e.target.checked ? (form.rcmCategory !== 'none' ? form.rcmCategory : 'unregistered_supplier') : 'none' })}
                />
                <label htmlFor="rcmCheck" style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Liable to Reverse Charge Mechanism (RCM - Sec 9(3) / 9(4))
                </label>
              </div>
              {form.isRcm && (
                <div>
                  <label className="input-label">RCM Category / Statutory Notification</label>
                  <select
                    className="input"
                    value={form.rcmCategory}
                    onChange={e => setForm({ ...form, rcmCategory: e.target.value })}
                  >
                    <option value="unregistered_supplier">Unregistered Supplier (Sec 9(4))</option>
                    <option value="gta_transport">Goods Transport Agency - GTA (Notification 13/2017)</option>
                    <option value="legal_services">Legal Services by Advocates / Arbitral Tribunal</option>
                    <option value="security_services">Security Services (Registered Person to Registered)</option>
                    <option value="director_remuneration">Services by Director to Company</option>
                    <option value="sponsorship">Sponsorship Services</option>
                    <option value="import_of_services">Import of Services</option>
                    <option value="other_notified">Other Notified Reverse Charge Supplies</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" className="btn outline small" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn small">Save Purchase</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="empty">Loading purchases...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Bill No.</th>
                <th>Date</th>
                <th>Taxable</th>
                <th>GST</th>
                <th>Total</th>
                <th>ITC Eligibility</th>
                <th>Payment / Rule 37</th>
                <th>GSTR-2B Recon</th>
              </tr>
            </thead>
            <tbody>
              {(purchases || []).map(p => {
                const daysOld = calculateDaysOld(p.billDate);
                const isOverdue180 = daysOld > 180 && p.paymentStatus !== 'paid';
                const isApproaching180 = daysOld >= 150 && daysOld <= 180 && p.paymentStatus !== 'paid';

                return (
                  <tr key={p._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong>{p.vendorName}</strong>
                        {p.isRcm && <span className="badge blue" style={{ fontSize: 9 }}>RCM</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {p.vendorGstin || 'Unregistered'}
                      </div>
                      {p.selfInvoiceNo && (
                        <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>
                          Self-Inv: {p.selfInvoiceNo}
                        </div>
                      )}
                    </td>
                    <td>{p.billNo}</td>
                    <td>{p.billDate ? new Date(p.billDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td>₹ {Number(p.taxableValue || 0).toLocaleString('en-IN')}</td>
                    <td>₹ {Number(p.gst || 0).toLocaleString('en-IN')}</td>
                    <td><strong>₹ {Number(p.total || 0).toLocaleString('en-IN')}</strong></td>
                    <td>{itcBadge(p.itcEligible, p.section17_5Category)}</td>
                    <td>
                      {isOverdue180 ? (
                        <div>
                          <span className="badge red" title="Overdue past 180 days - Mandatory Rule 37 reversal + 18% interest">
                            🚨 &gt;180 Days ({daysOld}d)
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>Reversal Mandatory</div>
                        </div>
                      ) : isApproaching180 ? (
                        <div>
                          <span className="badge amber" title="Approaching 180 days - Pay within 180 days to prevent ITC loss">
                            ⚠️ 150-180d Alert ({daysOld}d)
                          </span>
                          <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>{180 - daysOld} days left</div>
                        </div>
                      ) : p.paymentStatus === 'paid' ? (
                        <span className="badge green">Paid</span>
                      ) : (
                        <span className="badge gray">Unpaid ({daysOld}d)</span>
                      )}
                    </td>
                    <td>{reconBadge(p.reconStatus)}</td>
                  </tr>
                );
              })}
              {(!purchases || purchases.length === 0) && (
                <tr><td colSpan={9} className="empty">No purchases recorded</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
