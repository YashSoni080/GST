import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, Callout, SkeletonCard, SkeletonTable, EmptyState, ErrorState } from '../components/ui';
import { useToast } from '../components/Toast';

const RULE42_DEFAULTS = {
  totalItc: 120000,
  nonBusinessItc: 5000,
  exemptSupplyItc: 15000,
  blockedSection17_5Itc: 10000,
  taxableSupplyItc: 60000,
  exemptTurnover: 250000,
  totalTurnover: 1000000,
};

const RULE43_DEFAULTS = {
  commonCapitalGoodsItc: 180000,
  exemptTurnover: 250000,
  totalTurnover: 1000000,
};

export default function ITCOptimizer() {
  const toast = useToast();
  const [optimizerData, setOptimizerData] = useState(null);
  const [rule37Data, setRule37Data] = useState(null);
  const [blockedData, setBlockedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'rule37' | 'sec17_5' | 'rule42_43'

  // Rule 42 & 43 Simulator State
  const [rule42Inputs, setRule42Inputs] = useState(RULE42_DEFAULTS);
  const [rule43Inputs, setRule43Inputs] = useState(RULE43_DEFAULTS);

  const load = (notify = false) => {
    setLoading(true);
    setError(null);
    Promise.all([api.getITCOptimizer(), api.getRule37Tracker(), api.getSection17_5()])
      .then(([opt, r37, blk]) => {
        setOptimizerData(opt);
        setRule37Data(r37);
        setBlockedData(blk);
        if (notify) {
          toast.success('Credit matrix recalculated', 'Rule 88A set-off, Rule 37 aging and Sec 17(5) scans are up to date.');
        }
      })
      .catch(err => {
        setError(err);
        if (notify) toast.error('Recalculation failed', err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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

  const TABS = [
    { id: 'matrix', label: '⚡ Dynamic Credit Set-off Matrix (Sec 49A/49B)' },
    { id: 'rule37', label: `⚠️ 180-Day Rule 37 Payment Tracker (${rule37Data?.totalFlaggedBills || 0})` },
    { id: 'sec17_5', label: `🛡️ Section 17(5) Blocked Credits (${blockedData?.count || 0})` },
    { id: 'rule42_43', label: '📐 Rule 42 & 43 Reversals (Mixed & Capital Goods)' },
  ];

  const hasMatrix =
    optimizerData?.liability &&
    optimizerData?.setOffMatrix &&
    optimizerData?.cashPayable &&
    optimizerData?.remainingCreditClosing &&
    (Number(optimizerData.liability.total || 0) > 0 || Number(optimizerData.itcBalance?.total || 0) > 0);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="seg" role="group" aria-label="ITC optimizer views">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn outline" onClick={() => load(true)} disabled={loading}>
          🔄 Re-calculate
        </button>
      </div>

      {/* Top Stat Cards */}
      {loading ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : error ? null : (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <StatCard
            label="Total Tax Liability"
            icon="🏛️"
            value={`₹ ${Number(optimizerData?.liability?.total || 0).toLocaleString('en-IN')}`}
            delta="IGST + CGST + SGST"
          />
          <StatCard
            label="Available ITC Balance"
            icon="♻️"
            accent="teal"
            value={`₹ ${Number(optimizerData?.itcBalance?.total || 0).toLocaleString('en-IN')}`}
            delta="Eligible for Set-off"
            deltaClass="up"
          />
          <StatCard
            label="Optimized Cash Outlay (PMT-06)"
            icon="💵"
            accent="primary"
            value={`₹ ${Number(optimizerData?.cashPayable?.total || 0).toLocaleString('en-IN')}`}
            delta={`Working Capital Saved: ₹${Number(optimizerData?.cashOutlaySaved || 0).toLocaleString('en-IN')}`}
          />
          <StatCard
            label="Rule 37 Mandatory Reversal"
            icon="⚠️"
            value={<span style={{ color: 'var(--red)' }}>₹ {Number(rule37Data?.totalReversalDue || 0).toLocaleString('en-IN')}</span>}
            delta={`${rule37Data?.totalFlaggedBills || 0} Bills Overdue >180 Days`}
            deltaClass="down"
          />
        </div>
      )}

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 16, marginBottom: 10 }}>
        {loading ? 'Optimizing tax cash flow…' : ''}
      </div>

      {loading ? (
        <div className="card">
          <SkeletonTable rows={5} cols={6} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => load()} title="Could not load the ITC optimizer" />
      ) : (
        <>
          {/* TAB 1: Dynamic Credit Utilization Matrix (Section 4.2) */}
          {activeTab === 'matrix' && (hasMatrix ? (
            <div className="card">
              <div className="card-header">
                <div className="card-title-row">
                  <span className="dot" />
                  <div>
                    <h3>Tax-Efficient Credit Utilization Matrix (Rule 88A / Section 49B)</h3>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Calculates optimal sequence of IGST credit utilization against outward liabilities to minimize cash outflow via Challan PMT-06.
                    </div>
                  </div>
                </div>
                <button type="button" className="btn outline small" onClick={() => load(true)}>
                  🔄 Re-calculate
                </button>
              </div>

              {/* Set-off Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Output Tax Liability</th>
                      <th className="num">Gross Liability</th>
                      <th className="num">Paid via IGST Credit</th>
                      <th className="num">Paid via CGST Credit</th>
                      <th className="num">Paid via SGST Credit</th>
                      <th className="num">Net Cash Payable (PMT-06)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Integrated Tax (IGST)</strong></td>
                      <td className="num">₹ {Number(optimizerData.liability.igst).toLocaleString('en-IN')}</td>
                      <td className="num" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ₹ {Number(optimizerData.setOffMatrix.igstAgainstIgst).toLocaleString('en-IN')}
                      </td>
                      <td className="num">₹ {Number(optimizerData.setOffMatrix.cgstAgainstIgst).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(optimizerData.setOffMatrix.sgstAgainstIgst).toLocaleString('en-IN')}</td>
                      <td className="num" style={{ fontWeight: 700, color: optimizerData.cashPayable.igst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                        ₹ {Number(optimizerData.cashPayable.igst).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Central Tax (CGST)</strong></td>
                      <td className="num">₹ {Number(optimizerData.liability.cgst).toLocaleString('en-IN')}</td>
                      <td className="num" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ₹ {Number(optimizerData.setOffMatrix.igstAgainstCgst).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ₹ {Number(optimizerData.setOffMatrix.cgstAgainstCgst).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ color: 'var(--muted)' }}>— (Restricted)</td>
                      <td className="num" style={{ fontWeight: 700, color: optimizerData.cashPayable.cgst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                        ₹ {Number(optimizerData.cashPayable.cgst).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>State Tax (SGST)</strong></td>
                      <td className="num">₹ {Number(optimizerData.liability.sgst).toLocaleString('en-IN')}</td>
                      <td className="num" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ₹ {Number(optimizerData.setOffMatrix.igstAgainstSgst).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ color: 'var(--muted)' }}>— (Restricted)</td>
                      <td className="num" style={{ color: 'var(--teal-ink)', fontWeight: 600 }}>
                        ₹ {Number(optimizerData.setOffMatrix.sgstAgainstSgst).toLocaleString('en-IN')}
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: optimizerData.cashPayable.sgst > 0 ? 'var(--red)' : 'var(--teal)' }}>
                        ₹ {Number(optimizerData.cashPayable.sgst).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="card">
                  <div className="section-label">Closing Credit Balances Carried Forward</div>
                  <div style={{ fontSize: 13, lineHeight: '1.9' }}>
                    <div className="table-meta" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                      <span>Closing IGST Credit</span>
                      <strong className="num">₹ {Number(optimizerData.remainingCreditClosing.igst).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="table-meta" style={{ marginTop: 4, justifyContent: 'space-between' }}>
                      <span>Closing CGST Credit</span>
                      <strong className="num">₹ {Number(optimizerData.remainingCreditClosing.cgst).toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="table-meta" style={{ marginTop: 4, justifyContent: 'space-between' }}>
                      <span>Closing SGST Credit</span>
                      <strong className="num">₹ {Number(optimizerData.remainingCreditClosing.sgst).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                <Callout
                  tone="success"
                  icon="✅"
                  title="Optimization Highlights"
                  description={
                    <>
                      100% statutory adherence to Rule 88A (complete exhaustion of IGST before CGST/SGST).<br />
                      Minimized cash outflow via Challan PMT-06 to{' '}
                      <strong>₹{Number(optimizerData.cashPayable.total).toLocaleString('en-IN')}</strong>.<br />
                      Working capital preserved: <strong>₹{Number(optimizerData.cashOutlaySaved).toLocaleString('en-IN')}</strong>.
                    </>
                  }
                />
              </div>
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon="⚡"
                title="No set-off matrix yet"
                description="The Rule 88A / Section 49B optimizer sequences IGST → CGST → SGST credit against your output liability to minimize the PMT-06 cash challan. Post invoices and outward liability to generate the matrix."
                action={{ label: 'Record output invoices', to: '/invoices' }}
                secondaryAction={{ label: 'Open ITC ledger', to: '/itc' }}
              />
            </div>
          ))}

          {/* TAB 2: Rule 37 180-Day Tracker (Section 4.2) */}
          {activeTab === 'rule37' && rule37Data && (
            <div className="card">
              <div className="card-header">
                <div className="card-title-row">
                  <span className="dot" />
                  <div>
                    <h3>180-Day Vendor Payment Tracker & Statutory Aging Calendar</h3>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Continuously monitors vendor payment status. Flags invoices approaching 150 days (Amber) and overdue past 180 days (Red) to calculate mandatory ITC clawback + 18% interest under Rule 37.
                    </div>
                  </div>
                </div>
              </div>

              {/* Aging Calendar Buckets */}
              <div className="grid-4" style={{ marginBottom: 16 }}>
                <div className="card">
                  <div className="section-label">&lt; 90 Days (Normal)</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {rule37Data.agingBuckets?.under90Days?.count || 0} Bills
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    ₹ {Number(rule37Data.agingBuckets?.under90Days?.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="card">
                  <div className="section-label">90 - 149 Days (Monitor)</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {rule37Data.agingBuckets?.between90And149Days?.count || 0} Bills
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    ₹ {Number(rule37Data.agingBuckets?.between90And149Days?.totalAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                  <div className="section-label" style={{ color: '#b45309' }}>
                    ⚠️ 150 - 180 Days (Amber Alert)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>
                    {rule37Data.totalApproachingBills || 0} Bills
                  </div>
                  <div className="num" style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                    ITC at Stake: ₹ {Number(rule37Data.totalApproachingItc || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                  <div className="section-label" style={{ color: '#b91c1c' }}>
                    🚨 &gt; 180 Days (Clawback)
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {rule37Data.totalFlaggedBills || 0} Bills
                  </div>
                  <div className="num" style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                    Reversal: ₹ {Number(rule37Data.totalReversalDue || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Approaching 150-180 Days Alert Table */}
              {rule37Data.approachingPurchases?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <Callout
                    tone="risk"
                    icon="⚠️"
                    title={
                      <>
                        Approaching 180-day statutory deadline
                        <span className="badge amber" style={{ marginLeft: 8 }}>
                          {rule37Data.approachingPurchases.length} Priority Bills
                        </span>
                      </>
                    }
                    description="Schedule payment for these vendor invoices before the 180th day to prevent mandatory reversal and 18% statutory interest."
                    style={{ marginBottom: 12 }}
                  />
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor</th>
                          <th>Bill No.</th>
                          <th className="num">Days Elapsed</th>
                          <th className="num">Days Left</th>
                          <th className="num">Unpaid Amount</th>
                          <th className="num">ITC at Risk</th>
                          <th>Recommended Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rule37Data.approachingPurchases.map(p => (
                          <tr key={p.purchaseId}>
                            <td><strong>{p.vendorName}</strong></td>
                            <td className="mono">{p.billNo}</td>
                            <td className="num">{p.daysElapsed} days</td>
                            <td><span className="badge amber">{p.daysRemaining} days remaining</span></td>
                            <td className="num">₹ {Number(p.unpaidAmount).toLocaleString('en-IN')}</td>
                            <td className="num" style={{ color: '#d97706', fontWeight: 700 }}>
                              ₹ {Number(p.itcAtRisk).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: 12, color: '#92400e' }}>{p.recommendation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-meta">
                    <span>{rule37Data.approachingPurchases.length} bill(s) between 150 and 180 days</span>
                  </div>
                </div>
              )}

              {/* Overdue >180 Days Table */}
              <div className="section-label" style={{ color: 'var(--red)' }}>
                Overdue Past 180 Days — Rule 37 Reversal &amp; Interest
              </div>
              {rule37Data.flaggedPurchases?.length === 0 ? (
                <EmptyState
                  icon="✅"
                  title="No Rule 37 reversals due"
                  description="Every vendor bill is settled within the statutory 180-day window, so there is no ITC clawback or 18% interest liability under Rule 37 for this scan."
                  action={{ label: 'Record purchases', to: '/purchases' }}
                />
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor / Supplier</th>
                          <th>Bill No.</th>
                          <th>Bill Date</th>
                          <th>Days Outstanding</th>
                          <th className="num">Invoice Total</th>
                          <th className="num">Unpaid Amount</th>
                          <th className="num">Mandatory ITC Reversal</th>
                          <th className="num">Interest (18% p.a.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rule37Data.flaggedPurchases.map(p => (
                          <tr key={p.purchaseId}>
                            <td>
                              <strong>{p.vendorName}</strong>
                              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{p.vendorGstin}</div>
                            </td>
                            <td><strong className="mono">{p.billNo}</strong></td>
                            <td>{new Date(p.billDate).toLocaleDateString('en-IN')}</td>
                            <td>
                              <span className={`badge ${p.daysElapsed > 210 ? 'red' : 'amber'}`}>
                                {p.daysElapsed} Days ({p.daysOverdue}d overdue)
                              </span>
                            </td>
                            <td className="num">₹ {Number(p.totalInvoiceAmount).toLocaleString('en-IN')}</td>
                            <td className="num">₹ {Number(p.unpaidAmount).toLocaleString('en-IN')}</td>
                            <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                              ₹ {Number(p.reversalTax).toLocaleString('en-IN')}
                            </td>
                            <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                              ₹ {Number(p.interestAmt).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-meta">
                    <span>{rule37Data.flaggedPurchases.length} bill(s) overdue past 180 days</span>
                    <span>
                      Total reversal ₹ {Number(rule37Data.totalReversalDue || 0).toLocaleString('en-IN')} · Interest{' '}
                      ₹ {Number(rule37Data.flaggedPurchases.reduce((sum, p) => sum + Number(p.interestAmt || 0), 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: Section 17(5) Blocked Credits Directory */}
          {activeTab === 'sec17_5' && blockedData && (
            <div className="card">
              <div className="card-header">
                <div className="card-title-row">
                  <span className="dot" />
                  <div>
                    <h3>Section 17(5) Blocked Credits Directory</h3>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Auto-identifies ineligible ITC (motor vehicles, catering, personal consumption) to prevent audit penalties.
                    </div>
                  </div>
                </div>
                {blockedData.count > 0 ? <span className="badge red">{blockedData.count} blocked</span> : null}
              </div>

              {blockedData.count === 0 ? (
                <EmptyState
                  icon="🛡️"
                  title="No blocked credits detected"
                  description="None of your inward supplies fall in the Section 17(5) negative list — no ineligible credit (motor vehicles, food & beverage, catering, personal consumption) needs to be reversed this period."
                  action={{ label: 'Record purchases', to: '/purchases' }}
                  secondaryAction={{ label: 'Run 2B reconciliation', to: '/recon' }}
                />
              ) : (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Vendor Name</th>
                          <th>Bill No.</th>
                          <th>Date</th>
                          <th>Ineligible Category</th>
                          <th className="num">Taxable Value</th>
                          <th className="num">Blocked Tax Amount</th>
                          <th>Statutory Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blockedData.blockedPurchases?.map(b => (
                          <tr key={b._id}>
                            <td><strong>{b.vendorName}</strong></td>
                            <td className="mono">{b.billNo}</td>
                            <td>{new Date(b.billDate).toLocaleDateString('en-IN')}</td>
                            <td><span className="badge red">{b.section17_5Category}</span></td>
                            <td className="num">₹ {Number(b.taxableValue).toLocaleString('en-IN')}</td>
                            <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>
                              ₹ {Number(b.gst).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {b.blockedReason || 'Ineligible under Section 17(5)'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-meta">
                    <span>{blockedData.count} bill(s) with ineligible credit</span>
                    <span>
                      Blocked tax ₹{' '}
                      {Number((blockedData.blockedPurchases || []).reduce((sum, b) => sum + Number(b.gst || 0), 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: Rule 42 & 43 Proportionate ITC Reversal Automation */}
          {activeTab === 'rule42_43' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title-row">
                  <span className="dot" />
                  <div>
                    <h3>Rule 42 &amp; 43 Proportionate ITC Reversal Engine (Mixed Supplies &amp; Capital Goods)</h3>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Automated mathematical apportioning of common input credits between taxable, exempt, and non-business supplies. Auto-maps into GSTR-3B Table 4(B)(1).
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 20 }}>
                {/* Rule 42 Inputs & Summary */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div className="section-label" style={{ color: 'var(--primary)' }}>
                    Rule 42: Inputs &amp; Input Services Reversal
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="input-label" htmlFor="r42-total">Total Input Tax (T)</label>
                      <input
                        id="r42-total"
                        className="input"
                        type="number"
                        value={rule42Inputs.totalItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, totalItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r42-nonbiz">Exclusively Non-Business (T1)</label>
                      <input
                        id="r42-nonbiz"
                        className="input"
                        type="number"
                        value={rule42Inputs.nonBusinessItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, nonBusinessItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r42-exempt">Exclusively Exempt (T2)</label>
                      <input
                        id="r42-exempt"
                        className="input"
                        type="number"
                        value={rule42Inputs.exemptSupplyItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, exemptSupplyItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r42-blocked">Ineligible Sec 17(5) (T3)</label>
                      <input
                        id="r42-blocked"
                        className="input"
                        type="number"
                        value={rule42Inputs.blockedSection17_5Itc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, blockedSection17_5Itc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r42-taxable">Exclusively Taxable (T4)</label>
                      <input
                        id="r42-taxable"
                        className="input"
                        type="number"
                        value={rule42Inputs.taxableSupplyItc}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, taxableSupplyItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r42-exempt-turnover">Exempt Turnover (E)</label>
                      <input
                        id="r42-exempt-turnover"
                        className="input"
                        type="number"
                        value={rule42Inputs.exemptTurnover}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, exemptTurnover: e.target.value })}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label className="input-label" htmlFor="r42-total-turnover">Total Aggregate Turnover (F)</label>
                      <input
                        id="r42-total-turnover"
                        className="input"
                        type="number"
                        value={rule42Inputs.totalTurnover}
                        onChange={e => setRule42Inputs({ ...rule42Inputs, totalTurnover: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                    <div className="table-meta" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                      <span>Common Credit (C2)</span>
                      <strong className="num">₹ {r42.C2.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="table-meta" style={{ marginTop: 4, justifyContent: 'space-between' }}>
                      <span>
                        Exempt Attribution (D1) (
                        {((Number(rule42Inputs.exemptTurnover) / Math.max(1, Number(rule42Inputs.totalTurnover))) * 100).toFixed(1)}%)
                      </span>
                      <strong className="num">₹ {r42.D1.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="table-meta" style={{ marginTop: 4, justifyContent: 'space-between' }}>
                      <span>Non-Business 5% (D2)</span>
                      <strong className="num">₹ {r42.D2.toLocaleString('en-IN')}</strong>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px dashed #cbd5e1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--red)' }}>Rule 42 Mandatory Reversal:</span>
                      <span className="num" style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>
                        ₹ {r42.totalReversal.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--teal-ink)' }}>Net Eligible Credit (T4 + C3):</span>
                      <span className="num" style={{ fontWeight: 800, fontSize: 16, color: 'var(--teal-ink)' }}>
                        ₹ {r42.netEligible.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rule 43 Inputs & Summary */}
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div className="section-label" style={{ color: 'var(--primary)' }}>
                    Rule 43: Capital Goods Reversal (60 Months Depreciation)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="input-label" htmlFor="r43-capital">Common Capital Goods ITC (Tr)</label>
                      <input
                        id="r43-capital"
                        className="input"
                        type="number"
                        value={rule43Inputs.commonCapitalGoodsItc}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, commonCapitalGoodsItc: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r43-exempt">Exempt Turnover (E)</label>
                      <input
                        id="r43-exempt"
                        className="input"
                        type="number"
                        value={rule43Inputs.exemptTurnover}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, exemptTurnover: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="input-label" htmlFor="r43-total">Total Turnover (F)</label>
                      <input
                        id="r43-total"
                        className="input"
                        type="number"
                        value={rule43Inputs.totalTurnover}
                        onChange={e => setRule43Inputs({ ...rule43Inputs, totalTurnover: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
                    <div className="table-meta" style={{ marginTop: 0, justifyContent: 'space-between' }}>
                      <span>Statutory Useful Life</span>
                      <strong>60 Months (5 Years)</strong>
                    </div>
                    <div className="table-meta" style={{ marginTop: 4, justifyContent: 'space-between' }}>
                      <span>Monthly Credit (Tm = Tr / 60)</span>
                      <strong className="num">₹ {r43.Tm.toLocaleString('en-IN')} / mo</strong>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px dashed #cbd5e1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--red)' }}>Monthly Rule 43 Reversal (Te):</span>
                      <span className="num" style={{ fontWeight: 800, fontSize: 16, color: 'var(--red)' }}>
                        ₹ {r43.Te.toLocaleString('en-IN')} / mo
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontWeight: 600 }}>Annualized Reversal Impact:</span>
                      <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>
                        ₹ {r43.annual.toLocaleString('en-IN')} / yr
                      </span>
                    </div>
                  </div>

                  <Callout
                    tone="violet"
                    icon="ℹ️"
                    title="Auto-mapped to GSTR-3B"
                    description="Both Rule 42 and Rule 43 reversals flow into GSTR-3B Table 4(B)(1) as statutory reversals, reducing credit risk and eliminating Section 73/74 notice triggers."
                    style={{ marginTop: 14 }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
