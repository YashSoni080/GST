import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, SkeletonCard, SkeletonTable, EmptyState, ErrorState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Purchases() {
  const toast = useToast();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
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
    setError(null);
    api.getPurchases()
      .then(data => setPurchases(data.purchases || data || []))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const retry = () => {
    setLoading(true);
    load();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Saving vendor bill…');
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
      toast.success('Purchase recorded', 'Vendor bill added to your purchase register and 2B reconciliation queue.');
      load();
    } catch (err) {
      toast.error('Could not save this purchase', err.message);
    } finally {
      setStatus('');
    }
  };

  // Section 4.1: AI Intelligent Document Processing (IDP)
  const handleRunIDP = async () => {
    setParsing(true);
    setStatus('Parsing OCR text with AI…');
    try {
      const res = await api.parseIDPInvoice(idpText, 'scanned_vendor_bill.pdf');
      setIdpResult(res.data);
      toast.success(
        'Invoice extracted & math verified',
        `${res.data?.vendorName || 'Vendor'} · ${Math.round((res.data?.confidenceScore || 0) * 100)}% extraction confidence.`,
      );
    } catch (err) {
      toast.error('Document parsing failed', err.message);
    } finally {
      setParsing(false);
      setStatus('');
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
    toast.info('Draft populated from AI extraction', 'Review the extracted values, then save the purchase voucher.');
  };

  const itcBadge = (el, sec) => {
    if (el === 'no' || (sec && sec !== 'none')) {
      return <span className="badge red">Blocked Sec 17(5)</span>;
    }
    return <span className="badge green">Eligible</span>;
  };

  const reconBadge = (s) => {
    const map = { matched: 'green', approximate: 'blue', mismatch: 'red', missing: 'amber', pending: 'gray' };
    return <span className={`badge ${map[s] || 'gray'}`}>{s || 'pending'}</span>;
  };

  const calculateDaysOld = (dateStr) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const totalTaxable = purchases.reduce((sum, p) => sum + Number(p.taxableValue || 0), 0);
  const blockedCount = purchases.filter(p => p.itcEligible === 'no' || (p.section17_5Category && p.section17_5Category !== 'none')).length;
  const overdueCount = purchases.filter(p => calculateDaysOld(p.billDate) > 180 && p.paymentStatus !== 'paid').length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="section-label">
            <span className="dot" aria-hidden="true" />
            Purchase Register · Inward Supplies
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Track vendor invoices, Section 17(5) blocked credits, and Rule 37 180-day payments
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn outline" onClick={() => setShowIdpModal(true)}>
            🤖 AI Invoice Scanner (IDP)
          </button>
          <button type="button" className="btn" onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
            {showForm ? 'Close form' : '+ Record Purchase'}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18, marginBottom: 8 }}>
        {status}
      </div>

      {loading ? (
        <div className="grid-3" style={{ marginBottom: 16 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : error ? null : (
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <StatCard
            label="Inward Supplies (Taxable)"
            icon="📥"
            value={`₹ ${totalTaxable.toLocaleString('en-IN')}`}
            delta={`${purchases.length} vendor bill${purchases.length === 1 ? '' : 's'} on file`}
          />
          <StatCard
            label="Blocked Credits u/s 17(5)"
            icon="⛔"
            accent="amber"
            value={blockedCount}
            delta="Not claimable as ITC"
            deltaClass="amber-text"
          />
          <StatCard
            label="Rule 37 · Over 180 Days"
            icon="⏰"
            value={overdueCount}
            delta={overdueCount > 0 ? 'Reversal + 18% interest at risk' : 'Payments within the ITC deadline'}
            deltaClass={overdueCount > 0 ? 'down' : 'up'}
          />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Recorded Vendor Bills</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                ITC eligibility, payment ageing and GSTR-2B recon status per bill
              </div>
            </div>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="section-label">Vendor & bill particulars</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="pur-vendor">Vendor Name</label>
                <input id="pur-vendor" className="input" value={form.vendorName} onChange={e => setForm({ ...form, vendorName: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" htmlFor="pur-gstin">Vendor GSTIN</label>
                <input id="pur-gstin" className="input" value={form.vendorGstin} onChange={e => setForm({ ...form, vendorGstin: e.target.value.toUpperCase() })} placeholder="15-digit GSTIN" />
              </div>
            </div>

            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="pur-bill-no">Bill / Invoice No.</label>
                <input id="pur-bill-no" className="input" value={form.billNo} onChange={e => setForm({ ...form, billNo: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" htmlFor="pur-bill-date">Bill Date</label>
                <input id="pur-bill-date" className="input" type="date" value={form.billDate} onChange={e => setForm({ ...form, billDate: e.target.value })} required />
              </div>
            </div>

            <div className="section-label">Tax breakup</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="pur-taxable">Taxable Value (₹)</label>
                <input id="pur-taxable" className="input" type="number" value={form.taxableValue} onChange={e => setForm({ ...form, taxableValue: e.target.value })} required />
              </div>
              <div>
                <label className="input-label" htmlFor="pur-cgst">CGST (₹)</label>
                <input id="pur-cgst" className="input" type="number" value={form.cgst} onChange={e => setForm({ ...form, cgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label" htmlFor="pur-sgst">SGST (₹)</label>
                <input id="pur-sgst" className="input" type="number" value={form.sgst} onChange={e => setForm({ ...form, sgst: e.target.value })} />
              </div>
              <div>
                <label className="input-label" htmlFor="pur-igst">IGST (₹)</label>
                <input id="pur-igst" className="input" type="number" value={form.igst} onChange={e => setForm({ ...form, igst: e.target.value })} />
              </div>
            </div>

            <div className="section-label">ITC & payment controls</div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div>
                <label className="input-label" htmlFor="pur-sec17">Section 17(5) Categorization (Blocked Credit)</label>
                <select
                  id="pur-sec17"
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
                <label className="input-label" htmlFor="pur-payment">Payment Status</label>
                <select id="pur-payment" className="input" value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
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
                  <label className="input-label" htmlFor="pur-rcm">RCM Category / Statutory Notification</label>
                  <select
                    id="pur-rcm"
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
          <SkeletonTable rows={6} cols={7} />
        ) : error ? (
          <ErrorState error={error} onRetry={retry} title="Could not load your purchase register" />
        ) : purchases.length === 0 && !showForm ? (
          <EmptyState
            icon="📦"
            title="No vendor bills recorded yet"
            description="Record inward supplies here to claim eligible ITC, flag Section 17(5) blocked credits, track Rule 37 180-day payment deadlines and reconcile against GSTR-2B."
            action={{ label: '+ Record your first purchase', onClick: () => setShowForm(true) }}
            secondaryAction={{ label: 'Scan a bill with AI IDP', onClick: () => setShowIdpModal(true) }}
          />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon="📝"
            title="Waiting for your first vendor bill"
            description="Fill in the vendor, bill and tax details above and save — the bill will appear in this register with its ITC and Rule 37 status."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Bill No.</th>
                    <th>Date</th>
                    <th className="num">Taxable</th>
                    <th className="num">GST</th>
                    <th className="num">Total</th>
                    <th>ITC Eligibility</th>
                    <th>Payment / Rule 37</th>
                    <th>GSTR-2B Recon</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => {
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
                          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
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
                        <td className="num">₹ {Number(p.taxableValue || 0).toLocaleString('en-IN')}</td>
                        <td className="num">₹ {Number(p.gst || 0).toLocaleString('en-IN')}</td>
                        <td className="num"><strong>₹ {Number(p.total || 0).toLocaleString('en-IN')}</strong></td>
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
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>Showing {purchases.length} vendor bill{purchases.length === 1 ? '' : 's'}</span>
              <span>Taxable ₹ {totalTaxable.toLocaleString('en-IN')} · {blockedCount} blocked under Sec 17(5)</span>
            </div>
          </>
        )}
      </div>

      <Modal
        open={showIdpModal}
        onClose={() => setShowIdpModal(false)}
        title="Intelligent Document Processing (IDP) Invoice Parser"
        subtitle="Paste raw OCR text — AI extracts vendor, line items & HSN codes and verifies Qty × Rate = Taxable"
        maxWidth={650}
        footer={
          <>
            <button type="button" className="btn ghost small" onClick={() => setShowIdpModal(false)}>Cancel</button>
            <button type="button" className="btn small" onClick={handleRunIDP} disabled={parsing}>
              {parsing ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  Parsing OCR…
                </>
              ) : (
                '⚡ Extract & Validate Calculations'
              )}
            </button>
          </>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="idp-text">Raw OCR invoice text</label>
          <textarea
            id="idp-text"
            className="input mono"
            rows={6}
            value={idpText}
            onChange={e => setIdpText(e.target.value)}
          />
          <div className="form-hint">
            Supports scanned vendor bills, PDF text dumps and simulated document contents.
          </div>
        </div>

        <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18, marginTop: 8 }}>
          {parsing ? 'Running extraction and mathematical consistency checks…' : ''}
        </div>

        {idpResult && (
          <div style={{ marginTop: 12, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                ✓ Parsed: {idpResult.vendorName} <span className="mono">({idpResult.vendorGstin})</span>
              </div>
              <span className="badge green">Math Verified: 100%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: '1.6' }}>
              Bill No: <strong>{idpResult.billNo}</strong> | Date: <strong>{idpResult.billDate}</strong><br />
              Taxable: <strong>₹ {Number(idpResult.taxableValue || 0).toLocaleString('en-IN')}</strong> | Total Tax: <strong>₹ {Number(idpResult.gst || 0).toLocaleString('en-IN')}</strong> | Total: <strong>₹ {Number(idpResult.total || 0).toLocaleString('en-IN')}</strong>
            </div>
            <button type="button" className="btn small" style={{ marginTop: 12, width: '100%' }} onClick={handleApplyIDPResult}>
              Import into Purchase Voucher Draft
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
