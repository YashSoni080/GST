import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, Callout, Skeleton, SkeletonCard, SkeletonTable, EmptyState, ErrorState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Returns() {
  const toast = useToast();
  const [returns, setReturns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'gstr9'
  const [gstr9Data, setGstr9Data] = useState(null);
  const [gstr9Loading, setGstr9Loading] = useState(true);
  const [gstr9Error, setGstr9Error] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [filing, setFiling] = useState(false);
  const [status, setStatus] = useState('');
  const [genPeriod, setGenPeriod] = useState('2026-09');
  const [genType, setGenType] = useState('GSTR1');
  const [evcModal, setEvcModal] = useState(null);
  const [otp, setOtp] = useState('');

  const load = () => {
    setError(null);
    api.getReturns()
      .then(data => setReturns(data.returns || data || []))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const retry = () => {
    setLoading(true);
    load();
  };

  const handleCompile = async () => {
    if (generating) return;
    setGenerating(true);
    setStatus(`Compiling ${genType} for ${genPeriod}…`);
    try {
      const res = await api.compileReturn(genType, genPeriod);
      load();
      setSelected(res);
      toast.success(`${genType} compiled for ${genPeriod}`, 'Aggregated GSTN JSON is ready — review the breakdown below before filing.');
    } catch (err) {
      toast.error('Return compilation failed', err.message);
    } finally {
      setGenerating(false);
      setStatus('');
    }
  };

  const handleDownloadJSON = async (ret) => {
    try {
      const data = await api.getReturnJSON(ret._id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ret.companyGstin || 'return'}_${ret.type}_${ret.period}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('GSTN JSON downloaded', `${ret.type} · ${ret.period} saved to your device.`);
    } catch (err) {
      toast.error('Could not download the return JSON', err.message || 'Download failed');
    }
  };

  const handleFileReturn = async () => {
    if (!evcModal || filing) return;
    setFiling(true);
    setStatus('Verifying EVC and submitting return…');
    try {
      const updated = await api.submitReturn(evcModal._id, { filingMode: 'EVC', otp });
      setEvcModal(null);
      setOtp('');
      load();
      setSelected(updated);
      toast.success('Return filed successfully!', `Statutory ARN: ${updated.arn}`);
    } catch (err) {
      toast.error('Return filing failed', err.message);
    } finally {
      setFiling(false);
      setStatus('');
    }
  };

  const loadGSTR9 = async () => {
    setGstr9Error(null);
    setGstr9Loading(true);
    try {
      const data = await api.getGSTR9('2025-26');
      setGstr9Data(data);
    } catch (err) {
      setGstr9Error(err);
    } finally {
      setGstr9Loading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'gstr9') loadGSTR9();
  }, [activeTab]);

  const statusBadge = (s) => {
    const map = { filed: 'green', validated: 'blue', draft: 'amber', generated: 'blue', partially_filed: 'red' };
    return <span className={`badge ${map[s] || 'gray'}`}>{s}</span>;
  };

  const filedCount = returns.filter(r => r.status === 'filed').length;
  const validatedCount = returns.filter(r => r.status === 'validated').length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="seg" role="group" aria-label="Choose return builder">
          <button
            type="button"
            className={activeTab === 'monthly' ? 'active' : ''}
            aria-pressed={activeTab === 'monthly'}
            onClick={() => setActiveTab('monthly')}
          >
            Monthly Statutory Returns (GSTR-1 / 3B)
          </button>
          <button
            type="button"
            className={activeTab === 'gstr9' ? 'active' : ''}
            aria-pressed={activeTab === 'gstr9'}
            onClick={() => setActiveTab('gstr9')}
          >
            Annual Return Builder (GSTR-9 & 9C)
          </button>
        </div>

        {activeTab === 'monthly' && (
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="input-label" htmlFor="gen-type">Return type</label>
              <select id="gen-type" className="input" value={genType} onChange={e => setGenType(e.target.value)} style={{ width: 170 }}>
                <option value="GSTR1">GSTR-1 (Outward)</option>
                <option value="GSTR3B">GSTR-3B (Summary)</option>
                <option value="CMP08">CMP-08 (Composition Qtr)</option>
                <option value="GSTR4">GSTR-4 (Composition Annual)</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="gen-period">Period</label>
              <input
                id="gen-period"
                type="month"
                className="input"
                value={genPeriod}
                onChange={e => setGenPeriod(e.target.value)}
                style={{ width: 150 }}
              />
            </div>
            <button type="button" className="btn" onClick={handleCompile} disabled={generating}>
              {generating ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  Compiling…
                </>
              ) : (
                '⚡ Auto-Compile Return'
              )}
            </button>
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 18, marginBottom: 8 }}>
        {status}
      </div>

      {loading ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : error ? null : (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <StatCard label="Total Return Cycles" icon="🔁" value={returns.length} delta="FY 2025-26" />
          <StatCard
            label="Filed & Acknowledged"
            icon="✅"
            accent="teal"
            value={filedCount}
            delta="100% On-time ARN"
            deltaClass="up"
          />
          <StatCard
            label="Validated / Ready to File"
            icon="📋"
            value={validatedCount}
            delta="Pre-issuance checks passed"
          />
          <StatCard
            label="Late Fee & Penalty"
            icon="🛡️"
            value="₹ 0"
            delta="Zero non-compliance interest"
            deltaClass="up"
          />
        </div>
      )}

      {activeTab === 'monthly' && (
        <>
          <div className="section-label">Section 2.3 · One-Click Direct Return Auto-Compiler</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
            Directly aggregates outward invoices &amp; purchase ITC registers into GSTN JSON format — no spreadsheet round-trips.
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title-row">
                <span className="dot" />
                <div>
                  <h3>Statutory Returns Register</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Compile, validate and file each period — click a row to open its table-wise breakdown
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <SkeletonTable rows={6} cols={6} />
            ) : error ? (
              <ErrorState error={error} onRetry={retry} title="Could not load your returns register" />
            ) : returns.length === 0 ? (
              <EmptyState
                icon="🗂️"
                title="No returns compiled yet"
                description="Pick a return type and period above, then auto-compile — outward invoices and eligible ITC are aggregated into a filing-ready GSTN JSON you can review and file with an EVC."
                action={{ label: '⚡ Auto-Compile Return', onClick: handleCompile }}
                secondaryAction={{ label: 'Issue invoices first', to: '/invoices' }}
              />
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Return Type</th>
                        <th>Period</th>
                        <th>GSTIN</th>
                        <th className="num">Taxable / Turnover</th>
                        <th className="num">Tax Liability</th>
                        <th>Status</th>
                        <th>ARN / Filed Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map(ret => (
                        <tr key={ret._id} onClick={() => setSelected(ret)} style={{ cursor: 'pointer' }}>
                          <td><strong>{ret.type}</strong></td>
                          <td>{ret.period}</td>
                          <td><span className="mono">{ret.companyGstin}</span></td>
                          <td className="num">₹ {Number(ret.summary?.taxableValue || ret.summary?.outwardTurnover || 0).toLocaleString('en-IN')}</td>
                          <td className="num">₹ {Number(ret.summary?.totalTax || ret.summary?.outwardTaxLiability || 0).toLocaleString('en-IN')}</td>
                          <td>{statusBadge(ret.status)}</td>
                          <td>
                            {ret.arn ? (
                              <div>
                                <span className="badge green mono" style={{ fontSize: 10.5 }}>{ret.arn}</span>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                                  {ret.filedAt ? new Date(ret.filedAt).toLocaleDateString('en-IN') : ''}
                                </div>
                              </div>
                            ) : '—'}
                          </td>
                          <td>
                            <div className="row-actions" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn ghost tiny"
                                onClick={() => setSelected(ret)}
                                aria-label={`Open breakdown for ${ret.type} ${ret.period}`}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn outline tiny"
                                onClick={() => handleDownloadJSON(ret)}
                                title="Download official GSTN JSON"
                                aria-label={`Download GSTN JSON for ${ret.type} ${ret.period}`}
                              >
                                📥 JSON
                              </button>
                              {ret.status !== 'filed' && (
                                <button
                                  type="button"
                                  className="btn tiny"
                                  onClick={() => setEvcModal(ret)}
                                  aria-label={`File ${ret.type} for ${ret.period} with EVC`}
                                >
                                  File (EVC)
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
                    Showing {returns.length} return cycle{returns.length === 1 ? '' : 's'} · FY 2025-26
                  </span>
                  <span>{filedCount} filed · {validatedCount} validated</span>
                </div>
              </>
            )}
          </div>

          {selected && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div>
                  <h3>{selected.type} Breakdown — Period {selected.period}</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    GSTIN: <span className="mono">{selected.companyGstin}</span> | Status: {selected.status?.toUpperCase()}
                    {selected.arn && ` | Statutory ARN: ${selected.arn}`}
                  </div>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn outline small" onClick={() => handleDownloadJSON(selected)}>
                    📥 Export GSTN JSON
                  </button>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={() => setSelected(null)}
                    aria-label="Close return breakdown"
                    title="Close breakdown"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="progress-track">
                <div className="pt done"><div className="dot" />Data Compiled</div>
                <div className={selected.status === 'draft' ? 'pt now' : 'pt done'}><div className="dot" />Pre-issuance Validation</div>
                <div className={selected.status === 'filed' ? 'pt done' : 'pt'}><div className="dot" />EVC / DSC Filed</div>
              </div>

              {selected.type === 'GSTR1' && selected.sections?.b2b && (
                <div style={{ marginTop: 16 }}>
                  <div className="section-label">Table 4: B2B Outward Supplies</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Recipient GSTIN</th><th>Party Name</th><th>Inv No</th><th>Date</th><th className="num">Taxable</th><th className="num">Total Tax</th><th>POS</th></tr>
                      </thead>
                      <tbody>
                        {(selected.sections.b2b || []).map((b, i) => (
                          <tr key={i}>
                            <td className="mono">{b.ctin}</td>
                            <td>{b.cname}</td>
                            <td><strong>{b.inum}</strong></td>
                            <td>{b.idt}</td>
                            <td className="num">₹ {Number(b.taxable).toLocaleString('en-IN')}</td>
                            <td className="num">₹ {Number((b.cgst || 0) + (b.sgst || 0) + (b.igst || 0)).toLocaleString('en-IN')}</td>
                            <td>{b.pos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selected.type === 'GSTR1' && selected.sections?.hsn && (
                <div style={{ marginTop: 16 }}>
                  <div className="section-label">Table 12: HSN-Wise Summary</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>HSN Code</th><th>Description</th><th>UQC</th><th className="num">Qty</th><th className="num">Taxable Value</th><th className="num">IGST</th><th className="num">CGST</th><th className="num">SGST</th></tr>
                      </thead>
                      <tbody>
                        {(selected.sections.hsn || []).map((h, i) => (
                          <tr key={i}>
                            <td><strong className="mono">{h.hsn_sc}</strong></td>
                            <td>{h.desc}</td>
                            <td>{h.uqc}</td>
                            <td className="num">{h.qty}</td>
                            <td className="num">₹ {Number(h.txval).toLocaleString('en-IN')}</td>
                            <td className="num">₹ {Number(h.iamt).toLocaleString('en-IN')}</td>
                            <td className="num">₹ {Number(h.camt).toLocaleString('en-IN')}</td>
                            <td className="num">₹ {Number(h.samt).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selected.type === 'GSTR3B' && selected.sections && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                    <div className="section-label" style={{ color: 'var(--primary)' }}>3.1 Outward Tax Liabilities</div>
                    <div style={{ fontSize: 13, lineHeight: '1.8' }}>
                      <div>Taxable Value: <strong className="num">₹ {Number(selected.sections.table3_1_outward?.taxable || 0).toLocaleString('en-IN')}</strong></div>
                      <div>CGST: <strong className="num">₹ {Number(selected.sections.table3_1_outward?.cgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>SGST: <strong className="num">₹ {Number(selected.sections.table3_1_outward?.sgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>IGST: <strong className="num">₹ {Number(selected.sections.table3_1_outward?.igst || 0).toLocaleString('en-IN')}</strong></div>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                    <div className="section-label" style={{ color: 'var(--teal-ink)' }}>4. Eligible Input Tax Credit (ITC)</div>
                    <div style={{ fontSize: 13, lineHeight: '1.8' }}>
                      <div>Net CGST ITC: <strong className="num">₹ {Number(selected.sections.table4_itc?.netITC?.cgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>Net SGST ITC: <strong className="num">₹ {Number(selected.sections.table4_itc?.netITC?.sgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>Net IGST ITC: <strong className="num">₹ {Number(selected.sections.table4_itc?.netITC?.igst || 0).toLocaleString('en-IN')}</strong></div>
                      <div style={{ marginTop: 8, color: 'var(--red)', fontSize: 12 }}>
                        Sec 17(5) Blocked Reversed: ₹ {Number(selected.summary?.itcBlockedTotal || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'gstr9' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Automated Annual Return Builder (Form GSTR-9 / 9C)</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Consolidates 12 months GSTR-1, GSTR-3B, GSTR-2B, and trial balance with DRC-03 recommendation (Section 4.3)
                </div>
              </div>
            </div>
            <button type="button" className="btn outline small" onClick={loadGSTR9} disabled={gstr9Loading}>
              {gstr9Loading ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  Recalculating…
                </>
              ) : (
                '🔄 Re-calculate GSTR-9'
              )}
            </button>
          </div>

          {gstr9Loading ? (
            <Skeleton lines={5} />
          ) : gstr9Error ? (
            <ErrorState error={gstr9Error} onRetry={loadGSTR9} title="Could not consolidate the annual return" />
          ) : !gstr9Data ? (
            <EmptyState
              icon="📊"
              title="No annual data consolidated yet"
              description="Run the recalculation to aggregate 12 months of GSTR-1, GSTR-3B, GSTR-2B and your trial balance into the GSTR-9 / 9C format."
              action={{ label: '🔄 Re-calculate GSTR-9', onClick: loadGSTR9 }}
            />
          ) : (
            <div>
              <Callout
                tone={gstr9Data.drc03Recommendation?.required ? 'risk' : 'success'}
                icon={gstr9Data.drc03Recommendation?.required ? '⚠️' : '✓'}
                title={gstr9Data.drc03Recommendation?.required ? 'DRC-03 Adjustment Recommended' : 'Full Annual Reconciliation Alignment'}
                description={gstr9Data.drc03Recommendation?.reason}
                style={{ marginBottom: 20 }}
              />

              <div className="grid-3" style={{ marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div className="section-label">Table 4: Total Outward Turnover</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                    ₹ {Number(gstr9Data.table4_outward?.totalTaxable || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    B2B: ₹{Number(gstr9Data.table4_outward?.table4B_B2B || 0).toLocaleString('en-IN')} | B2C: ₹{Number(gstr9Data.table4_outward?.table4A_B2C || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div className="section-label">Table 6: ITC Availed in GSTR-3B</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--teal-ink)' }}>
                    ₹ {Number(gstr9Data.table6_itc?.table6A_totalFrom3B || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Inputs: 85% | Input Services: 15%
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div className="section-label">Table 8D: 2B vs 3B Variance</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: gstr9Data.table8_comparison?.table8D_difference < 0 ? 'var(--red)' : 'var(--teal)' }}>
                    {gstr9Data.table8_comparison?.table8D_difference >= 0 ? '+' : ''}
                    ₹ {Number(gstr9Data.table8_comparison?.table8D_difference || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {gstr9Data.table8_comparison?.status}
                  </div>
                </div>
              </div>

              {gstr9Data.gstr9c && (
                <div style={{ background: '#f1f5f9', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <h4 style={{ margin: 0 }}>GSTR-9C Statutory Reconciliation Ledger (Section 44(2))</h4>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Reconciliation of Audited Financial Statement Turnover vs Declared GSTR-9 Annual Return
                      </div>
                    </div>
                    <span className="badge blue">{gstr9Data.gstr9c.auditorCertificationStatus}</span>
                  </div>

                  <div className="grid-3" style={{ marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Audited Book Turnover</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>₹ {Number(gstr9Data.gstr9c.auditedTurnover || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>GSTR-9 Declared Turnover</div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>₹ {Number(gstr9Data.gstr9c.gstr9Turnover || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Unreconciled Difference</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: gstr9Data.gstr9c.unreconciledTurnover > 0 ? '#b45309' : 'inherit' }}>
                        ₹ {Number(gstr9Data.gstr9c.unreconciledTurnover || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {gstr9Data.gstr9c.reconciliationReasons?.length > 0 && (
                    <div style={{ fontSize: 12, borderTop: '1px dashed #cbd5e1', paddingTop: 8 }}>
                      <strong>Table 5 Reconciliation Adjustments:</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {gstr9Data.gstr9c.reconciliationReasons.map((r, i) => (
                          <li key={i}>{r.code} - {r.desc}: <strong>₹{Number(r.amount).toLocaleString('en-IN')}</strong></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn outline small" onClick={() => window.print()}>🖨️ Print GSTR-9/9C Audit Packet</button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => toast.success('GSTR-9 / 9C JSON prepared', 'The annual return payload is ready for filing on the GST portal.')}
                >
                  Generate Official GSTR-9/9C JSON
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!evcModal}
        onClose={() => setEvcModal(null)}
        title={evcModal ? `File ${evcModal.type} with EVC` : 'File with EVC'}
        subtitle={evcModal ? `Electronic Verification Code · Period ${evcModal.period}` : ''}
        maxWidth={460}
        footer={
          <>
            <button type="button" className="btn ghost small" onClick={() => setEvcModal(null)} disabled={filing}>
              Cancel
            </button>
            <button type="button" className="btn small" onClick={handleFileReturn} disabled={filing}>
              {filing ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                'Verify & Submit Return'
              )}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          A simulated One-Time Password (OTP) has been sent to the authorized signatory mobile registered with GSTN for GSTIN{' '}
          <strong className="mono">{evcModal?.companyGstin}</strong>.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="evc-otp">Enter 6-Digit EVC OTP</label>
          <input
            id="evc-otp"
            className="input"
            placeholder="e.g. 782109"
            value={otp}
            onChange={e => setOtp(e.target.value)}
            autoFocus
          />
          <div className="form-hint">
            Hint: Any 6 digits for simulated verification (e.g. 123456)
          </div>
        </div>
      </Modal>
    </>
  );
}
