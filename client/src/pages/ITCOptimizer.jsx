import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function ITCOptimizer() {
  const [optimizerData, setOptimizerData] = useState(null);
  const [rule37Data, setRule37Data] = useState(null);
  const [blockedData, setBlockedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'rule37' | 'sec17_5' | 'rule42_43'
  
  // Rule 42 & 43 Simulator State
  const [rule42Inputs, setRule42Inputs] = useState({
    totalItc: 120000,
    nonBusinessItc: 5000,
    exemptSupplyItc: 15000,
    blockedSection17_5Itc: 10000,
    taxableSupplyItc: 60000,
    exemptTurnover: 250000,
    totalTurnover: 1000000,
  });
  const [rule43Inputs, setRule43Inputs] = useState({
    commonCapitalGoodsItc: 180000,
    exemptTurnover: 250000,
    totalTurnover: 1000000,
  });

  const load = () => {
    Promise.all([api.getITCOptimizer(), api.getRule37Tracker(), api.getSection17_5()])
      .then(([opt, r37, blk]) => {
        setOptimizerData(opt);
        setRule37Data(r37);
        setBlockedData(blk);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Compute Rule 42 & 43 on the fly
  const computeRule42 = () => {
    const T = Number(rule42Inputs.totalItc) || 0;
    const T1 = Number(rule42Inputs.nonBusinessItc) || 0;
    const T2 = Number(rule42Inputs.exemptSupplyItc) || 0;
    const T3 = Number(rule42Inputs.blockedSection17_5Itc) || 0;
    const T4 = Number(rule42Inputs.taxableSupplyItc) || 0;
    const E = Number(rule42Inputs.exemptTurnover) || 0;
    const F = Math.max(1, Number(rule42Inputs.totalTurnover) || 1);

    const C1 = Math.max(0, T - (T1 + T2 + T3));
    const C2 = Math.max(0, C1 - T4);
    const D1 = Math.round((E / F) * C2);
    const D2 = Math.round(0.05 * C2);
    const totalReversal = D1 + D2;
    const netEligible = T4 + Math.max(0, C2 - totalReversal);
    return { C1, C2, D1, D2, totalReversal, netEligible };
  };

  const computeRule43 = () => {
    const Tr = Number(rule43Inputs.commonCapitalGoodsItc) || 0;
    const E = Number(rule43Inputs.exemptTurnover) || 0;
    const F = Math.max(1, Number(rule43Inputs.totalTurnover) || 1);
    const Tm = Math.round(Tr / 60);
    const Te = Math.round((E / F) * Tm);
    return { Tm, Te, annual: Te * 12 };
  };

  const r42 = computeRule42();
  const r43 = computeRule43();

  return (
    <>
      {/* Top Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Total Tax Liability</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            ₹ {Number(optimizerData?.liability?.total || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta">IGST + CGST + SGST</div>
        </div>
        <div className="card">
          <div className="stat-label">Available ITC Balance</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--teal)' }}>
            ₹ {Number(optimizerData?.itcBalance?.total || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta up">Eligible for Set-off</div>
        </div>
        <div className="card">
          <div className="stat-label">Optimized Cash Outlay (PMT-06)</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--primary)' }}>
            ₹ {Number(optimizerData?.cashPayable?.total || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta">Working Capital Saved: ₹{Number(optimizerData?.cashOutlaySaved || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">Rule 37 Mandatory Reversal</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>
            ₹ {Number(rule37Data?.totalReversalDue || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta down">
            {rule37Data?.totalFlaggedBills || 0} Bills Overdue &gt;180 Days
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'matrix' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('matrix')}
        >
          ⚡ Dynamic Credit Set-off Matrix (Sec 49A/49B)
        </button>
        <button
          className={`btn ${activeTab === 'rule37' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('rule37')}
        >
          ⚠️ 180-Day Rule 37 Payment Tracker ({rule37Data?.totalFlaggedBills || 0})
        </button>
        <button
          className={`btn ${activeTab === 'sec17_5' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('sec17_5')}
        >
          🛡️ Section 17(5) Blocked Credits ({blockedData?.count || 0})
        </button>
        <button
          className={`btn ${activeTab === 'rule42_43' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('rule42_43')}
        >
          📐 Rule 42 & 43 Reversals (Mixed & Capital Goods)
        </button>
      </div>

      {loading ? (
        <div className="card empty">Optimizing tax cash flow...</div>
      ) : (
        <>
          {/* TAB 1: Dynamic Credit Utilization Matrix (Section 4.2) */}
          {activeTab === 'matrix' && optimizerData && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Tax-Efficient Credit Utilization Matrix (Rule 88A / Section 49B)</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Calculates optimal sequence of IGST credit utilization against outward liabilities to minimize cash outflow via Challan PMT-06.
                  </div>
                </div>
                <button className="btn outline small" onClick={load}>🔄 Re-calculate</button>
              </div>

              {/* Set-off Table */}
              <table>
                <thead>
                  <tr>
                    <th>Output Tax Liability</th>
                    <th>Gross Liability</th>
                    <th>Paid via IGST Credit</th>
                    <th>Paid via CGST Credit</th>
                    <th>Paid via SGST Credit</th>
                    <th>Net Cash Payable (PMT-06)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Integrated Tax (IGST)</strong></td>
                    <td>₹ {Number(optimizerData.liability.igst).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      ₹ {Number(optimizerData.setOffMatrix.igstAgainstIgst).toLocaleString('en-IN')}
                    </td>
                    <td>₹ {Number(optimizerData.setOffMatrix.cgstAgainstIgst).toLocaleString('en-IN')}</td>
                    <td>₹ {Number(optimizerData.setOffMatrix.sgstAgainstIgst).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: optimizerData.cashPayable.igst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                      ₹ {Number(optimizerData.cashPayable.igst).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Central Tax (CGST)</strong></td>
                    <td>₹ {Number(optimizerData.liability.cgst).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      ₹ {Number(optimizerData.setOffMatrix.igstAgainstCgst).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      ₹ {Number(optimizerData.setOffMatrix.cgstAgainstCgst).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>— (Restricted)</td>
                    <td style={{ fontWeight: 700, color: optimizerData.cashPayable.cgst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                      ₹ {Number(optimizerData.cashPayable.cgst).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>State Tax (SGST)</strong></td>
                    <td>₹ {Number(optimizerData.liability.sgst).toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      ₹ {Number(optimizerData.setOffMatrix.igstAgainstSgst).toLocaleString('en-IN')}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>— (Restricted)</td>
                    <td style={{ color: 'var(--teal)', fontWeight: 600 }}>
                      ₹ {Number(optimizerData.setOffMatrix.sgstAgainstSgst).toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 700, color: optimizerData.cashPayable.sgst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                      ₹ {Number(optimizerData.cashPayable.sgst).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--primary)' }}>Closing Credit Balances Carried Forward</h4>
                  <div style={{ fontSize: 13, lineHeight: '1.8' }}>
                    <div>Closing IGST Credit: <strong>₹ {Number(optimizerData.remainingCreditClosing.igst).toLocaleString('en-IN')}</strong></div>
                    <div>Closing CGST Credit: <strong>₹ {Number(optimizerData.remainingCreditClosing.cgst).toLocaleString('en-IN')}</strong></div>
                    <div>Closing SGST Credit: <strong>₹ {Number(optimizerData.remainingCreditClosing.sgst).toLocaleString('en-IN')}</strong></div>
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 16, borderRadius: 8 }}>
                  <h4 style={{ fontSize: 13, marginBottom: 8, color: '#166534' }}>Optimization Highlights</h4>
                  <div style={{ fontSize: 13, color: '#15803d', lineHeight: '1.8' }}>
                    ✓ 100% statutory adherence to Rule 88A (complete exhaustion of IGST before CGST/SGST).<br />
                    ✓ Minimized cash outflow via Challan PMT-06 to <strong>₹{Number(optimizerData.cashPayable.total).toLocaleString('en-IN')}</strong>.<br />
                    ✓ Working capital preserved: <strong>₹{Number(optimizerData.cashOutlaySaved).toLocaleString('en-IN')}</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Rule 37 180-Day Tracker (Section 4.2) */}
          {activeTab === 'rule37' && rule37Data && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>180-Day Vendor Payment Tracker & Statutory Aging Calendar</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Continuously monitors vendor payment status. Flags invoices approaching 150 days (Amber) and overdue past 180 days (Red) to calculate mandatory ITC clawback + 18% interest under Rule 37.
                  </div>
                </div>
              </div>

              {/* Aging Calendar Buckets */}
              <div className="grid-4" style={{ marginBottom: 16 }}>
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>&lt; 90 Days (Normal)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                    {rule37Data.agingBuckets?.under90Days?.count || 0} Bills
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    ₹ {Number(rule37Data.agingBuckets?.under90Days?.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>90 - 149 Days (Monitor)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                    {rule37Data.agingBuckets?.between90And149Days?.count || 0} Bills
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    ₹ {Number(rule37Data.agingBuckets?.between90And149Days?.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ background: '#fffbeb', padding: 14, borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, color: '#b45309', textTransform: 'uppercase', fontWeight: 600 }}>
                    ⚠️ 150 - 180 Days (Amber Alert)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#d97706' }}>
                    {rule37Data.totalApproachingBills || 0} Bills
                  </div>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                    ITC at Stake: ₹ {Number(rule37Data.totalApproachingItc || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ background: '#fef2f2', padding: 14, borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 11, color: '#b91c1c', textTransform: 'uppercase', fontWeight: 600 }}>
                    🚨 &gt; 180 Days (Clawback)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--red)' }}>
                    {rule37Data.totalFlaggedBills || 0} Bills
                  </div>
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                    Reversal: ₹ {Number(rule37Data.totalReversalDue || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Approaching 150-180 Days Alert Table */}
              {rule37Data.approachingPurchases?.length > 0 && (
                <div style={{ marginBottom: 20, background: '#fffbeb', padding: 16, borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚠️ Approaching 180-Day Statutory Deadline (Action Required)</span>
                    <span className="badge amber">{rule37Data.approachingPurchases.length} Priority Bills</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                    Schedule payment for these vendor invoices before the 180th day to prevent mandatory reversal and 18% statutory interest.
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Bill No.</th>
                        <th>Days Elapsed</th>
                        <th>Days Left</th>
                        <th>Unpaid Amount</th>
                        <th>ITC at Risk</th>
                        <th>Recommended Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rule37Data.approachingPurchases.map(p => (
                        <tr key={p.purchaseId}>
                          <td><strong>{p.vendorName}</strong></td>
                          <td>{p.billNo}</td>
                          <td>{p.daysElapsed} days</td>
                          <td><span className="badge amber" style={{ fontWeight: 700 }}>{p.daysRemaining} days remaining</span></td>
                          <td>₹ {Number(p.unpaidAmount).toLocaleString('en-IN')}</td>
                          <td style={{ color: '#d97706', fontWeight: 700 }}>₹ {Number(p.itcAtRisk).toLocaleString('en-IN')}</td>
                          <td style={{ fontSize: 12, color: '#92400e' }}>{p.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Overdue >180 Days Table */}
              <h4 style={{ margin: '16px 0 8px 0', color: 'var(--red)' }}>Overdue Past 180 Days - Rule 37 Reversal & Interest</h4>
              {rule37Data.flaggedPurchases?.length === 0 ? (
                <div className="empty" style={{ color: 'var(--teal)' }}>
                  ✓ All vendor bills are settled within statutory 180 days. Zero Rule 37 reversal liability!
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Vendor / Supplier</th>
                      <th>Bill No.</th>
                      <th>Bill Date</th>
                      <th>Days Outstanding</th>
                      <th>Invoice Total</th>
                      <th>Unpaid Amount</th>
                      <th>Mandatory ITC Reversal</th>
                      <th>Interest (18% p.a.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule37Data.flaggedPurchases.map(p => (
                      <tr key={p.purchaseId}>
                        <td>
                          <strong>{p.vendorName}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{p.vendorGstin}</div>
                        </td>
                        <td><strong>{p.billNo}</strong></td>
                        <td>{new Date(p.billDate).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`badge ${p.daysElapsed > 210 ? 'red' : 'amber'}`}>
                            {p.daysElapsed} Days ({p.daysOverdue}d overdue)
                          </span>
                        </td>
                        <td>₹ {Number(p.totalInvoiceAmount).toLocaleString('en-IN')}</td>
                        <td>₹ {Number(p.unpaidAmount).toLocaleString('en-IN')}</td>
                        <td style={{ color: 'var(--red)', fontWeight: 700 }}>
                          ₹ {Number(p.reversalTax).toLocaleString('en-IN')}
                        </td>
                        <td style={{ color: 'var(--red)', fontWeight: 700 }}>
                          ₹ {Number(p.interestAmt).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 3: Section 17(5) Blocked Credits Directory */}
          {activeTab === 'sec17_5' && blockedData && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Section 17(5) Blocked Credits Directory</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Auto-identifies ineligible ITC (motor vehicles, catering, personal consumption) to prevent audit penalties.
                  </div>
                </div>
              </div>

              {blockedData.count === 0 ? (
                <div className="empty">No blocked credits found.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Vendor Name</th>
                      <th>Bill No.</th>
                      <th>Date</th>
                      <th>Ineligible Category</th>
                      <th>Taxable Value</th>
                      <th>Blocked Tax Amount</th>
                      <th>Statutory Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedData.blockedPurchases?.map(b => (
                      <tr key={b._id}>
                        <td><strong>{b.vendorName}</strong></td>
                        <td>{b.billNo}</td>
                        <td>{new Date(b.billDate).toLocaleDateString('en-IN')}</td>
                        <td><span className="badge red" style={{ fontSize: 10.5 }}>{b.section17_5Category}</span></td>
                        <td>₹ {Number(b.taxableValue).toLocaleString('en-IN')}</td>
                        <td style={{ color: 'var(--red)', fontWeight: 700 }}>
                          ₹ {Number(b.gst).toLocaleString('en-IN')}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {b.blockedReason || 'Ineligible under Section 17(5)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: Rule 42 & 43 Proportionate ITC Reversal Automation */}
          {activeTab === 'rule42_43' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Rule 42 & 43 Proportionate ITC Reversal Engine (Mixed Supplies & Capital Goods)</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Automated mathematical apportioning of common input credits between taxable, exempt, and non-business supplies. Auto-maps into GSTR-3B Table 4(B)(1).
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Rule 42 Inputs & Summary */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ color: 'var(--primary)', marginBottom: 12 }}>
                    Rule 42: Inputs & Input Services Reversal
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="input-label">Total Input Tax (T)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.totalItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, totalItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Exclusively Non-Business (T1)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.nonBusinessItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, nonBusinessItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Exclusively Exempt (T2)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.exemptSupplyItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, exemptSupplyItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Ineligible Sec 17(5) (T3)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.blockedSection17_5Itc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, blockedSection17_5Itc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Exclusively Taxable (T4)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.taxableSupplyItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, taxableSupplyItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Exempt Turnover (E)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.exemptTurnover}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, exemptTurnover: e.target.value })}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="input-label">Total Aggregate Turnover (F)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule42Inputs.totalTurnover}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, totalTurnover: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                    <div>Common Credit (C2): <strong>₹ {r42.C2.toLocaleString('en-IN')}</strong></div>
                    <div>Exempt Attribution (D1): <strong>₹ {r42.D1.toLocaleString('en-IN')}</strong> ({((Number(rule42Inputs.exemptTurnover) / Math.max(1, Number(rule42Inputs.totalTurnover))) * 100).toFixed(1)}%)</div>
                    <div>Non-Business 5% (D2): <strong>₹ {r42.D2.toLocaleString('en-IN')}</strong></div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--red)' }}>Rule 42 Mandatory Reversal:</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>₹ {r42.totalReversal.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--teal)' }}>Net Eligible Credit (T4 + C3):</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--teal)' }}>₹ {r42.netEligible.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Rule 43 Inputs & Summary */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ color: 'var(--primary)', marginBottom: 12 }}>
                    Rule 43: Capital Goods Reversal (60 Months Depreciation)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="input-label">Common Capital Goods ITC (Tr)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule43Inputs.commonCapitalGoodsItc}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, commonCapitalGoodsItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Exempt Turnover (E)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule43Inputs.exemptTurnover}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, exemptTurnover: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label">Total Turnover (F)</label>
                      <input
                        className="input"
                        type="number"
                        value={rule43Inputs.totalTurnover}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, totalTurnover: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                    <div>Statutory Useful Life: <strong>60 Months (5 Years)</strong></div>
                    <div>Monthly Credit (Tm = Tr / 60): <strong>₹ {r43.Tm.toLocaleString('en-IN')} / mo</strong></div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--red)' }}>Monthly Rule 43 Reversal (Te):</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>₹ {r43.Te.toLocaleString('en-IN')} / mo</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontWeight: 600 }}>Annualized Reversal Impact:</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>₹ {r43.annual.toLocaleString('en-IN')} / yr</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, padding: 10, background: '#f1f5f9', borderRadius: 6, fontSize: 11, color: 'var(--muted)' }}>
                    ℹ️ Both Rule 42 and Rule 43 reversals automatically flow into GSTR-3B Table 4(B)(1) as statutory reversals, reducing credit risk and eliminating Section 73/74 notice triggers.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
