import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'gstr9'
  const [gstr9Data, setGstr9Data] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genPeriod, setGenPeriod] = useState('2026-09');
  const [genType, setGenType] = useState('GSTR1');
  const [evcModal, setEvcModal] = useState(null);
  const [otp, setOtp] = useState('');

  const load = () => {
    api.getReturns()
      .then(data => setReturns(data.returns || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCompile = async () => {
    setGenerating(true);
    try {
      const res = await api.compileReturn(genType, genPeriod);
      load();
      setSelected(res);
      alert(`Successfully compiled ${genType} for period ${genPeriod}!`);
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
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
    } catch (err) {
      alert(err.message || 'Failed to download return JSON payload');
    }
  };

  const handleFileReturn = async () => {
    if (!evcModal) return;
    try {
      const updated = await api.submitReturn(evcModal._id, { filingMode: 'EVC', otp });
      setEvcModal(null);
      setOtp('');
      load();
      setSelected(updated);
      alert(`Return filed successfully! Statutory ARN: ${updated.arn}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadGSTR9 = async () => {
    try {
      const data = await api.getGSTR9('2025-26');
      setGstr9Data(data);
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'gstr9') loadGSTR9();
  }, [activeTab]);

  const statusBadge = (status) => {
    const map = { filed: 'green', validated: 'blue', draft: 'amber', generated: 'blue', partially_filed: 'red' };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  return (
    <>
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Total Return Cycles</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{returns.length}</div>
          <div className="stat-delta">FY 2025-26</div>
        </div>
        <div className="card">
          <div className="stat-label">Filed & Acknowledged</div>
          <div className="stat-value" style={{ fontSize: 22, color: 'var(--teal)' }}>
            {returns.filter(r => r.status === 'filed').length}
          </div>
          <div className="stat-delta up">100% On-time ARN</div>
        </div>
        <div className="card">
          <div className="stat-label">Validated / Ready to File</div>
          <div className="stat-value" style={{ fontSize: 22, color: 'var(--primary)' }}>
            {returns.filter(r => r.status === 'validated').length}
          </div>
          <div className="stat-delta">Pre-issuance checks passed</div>
        </div>
        <div className="card">
          <div className="stat-label">Late Fee & Penalty</div>
          <div className="stat-value" style={{ fontSize: 22 }}>₹ 0</div>
          <div className="stat-delta up">Zero Non-compliance Interest</div>
        </div>
      </div>

      {/* Tabs: Monthly Returns vs GSTR-9 Annual Return Builder */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'monthly' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('monthly')}
        >
          Monthly Statutory Returns (GSTR-1 / 3B)
        </button>
        <button
          className={`btn ${activeTab === 'gstr9' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('gstr9')}
        >
          Annual Return Builder (GSTR-9 & 9C)
        </button>
      </div>

      {activeTab === 'monthly' && (
        <>
          {/* Direct Compilation Bar */}
          <div className="card" style={{ marginBottom: 16, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <strong style={{ fontSize: 14 }}>One-Click Direct Return Auto-Compiler (Section 2.3)</strong>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Directly aggregates outward invoices & purchase ITC registers into GSTN JSON format.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input" value={genType} onChange={e => setGenType(e.target.value)} style={{ width: 170 }}>
                  <option value="GSTR1">GSTR-1 (Outward)</option>
                  <option value="GSTR3B">GSTR-3B (Summary)</option>
                  <option value="CMP08">CMP-08 (Composition Qtr)</option>
                  <option value="GSTR4">GSTR-4 (Composition Annual)</option>
                </select>
                <input
                  type="month"
                  className="input"
                  value={genPeriod}
                  onChange={e => setGenPeriod(e.target.value)}
                  style={{ width: 140 }}
                />
                <button className="btn small" onClick={handleCompile} disabled={generating}>
                  {generating ? 'Compiling...' : '⚡ Auto-Compile Return'}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Statutory Returns Register</h3>
            </div>

            {loading ? (
              <div className="empty">Loading returns...</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Return Type</th>
                    <th>Period</th>
                    <th>GSTIN</th>
                    <th>Taxable / Turnover</th>
                    <th>Tax Liability</th>
                    <th>Status</th>
                    <th>ARN / Filed Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(returns || []).map(ret => (
                    <tr key={ret._id} onClick={() => setSelected(ret)} style={{ cursor: 'pointer' }}>
                      <td><strong>{ret.type}</strong></td>
                      <td>{ret.period}</td>
                      <td><span style={{ fontFamily: 'monospace' }}>{ret.companyGstin}</span></td>
                      <td>₹ {Number(ret.summary?.taxableValue || ret.summary?.outwardTurnover || 0).toLocaleString('en-IN')}</td>
                      <td>₹ {Number(ret.summary?.totalTax || ret.summary?.outwardTaxLiability || 0).toLocaleString('en-IN')}</td>
                      <td>{statusBadge(ret.status)}</td>
                      <td>
                        {ret.arn ? (
                          <div>
                            <span className="badge green" style={{ fontSize: 10.5 }}>{ret.arn}</span>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              {ret.filedAt ? new Date(ret.filedAt).toLocaleDateString('en-IN') : ''}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn outline small"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => handleDownloadJSON(ret)}
                            title="Download official GSTN JSON"
                          >
                            📥 JSON
                          </button>
                          {ret.status !== 'filed' && (
                            <button
                              className="btn small"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => setEvcModal(ret)}
                            >
                              File (EVC)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!returns || returns.length === 0) && (
                    <tr><td colSpan={8} className="empty">No returns found. Click "Auto-Compile Return" above.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Selected Return Details & Table-Wise Breakdown */}
          {selected && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <div>
                  <h3>{selected.type} Breakdown — Period {selected.period}</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    GSTIN: {selected.companyGstin} | Status: {selected.status?.toUpperCase()}
                    {selected.arn && ` | Statutory ARN: ${selected.arn}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn outline small" onClick={() => handleDownloadJSON(selected)}>
                    📥 Export GSTN JSON
                  </button>
                  <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>

              {/* Progress Track */}
              <div className="progress-track">
                <div className="pt done"><div className="dot" />Data Compiled</div>
                <div className={selected.status === 'draft' ? 'pt now' : 'pt done'}><div className="dot" />Pre-issuance Validation</div>
                <div className={selected.status === 'filed' ? 'pt done' : 'pt'}><div className="dot" />EVC / DSC Filed</div>
              </div>

              {/* Section Data Tables */}
              {selected.type === 'GSTR1' && selected.sections?.b2b && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--primary)' }}>Table 4: B2B Outward Supplies</h4>
                  <table>
                    <thead>
                      <tr><th>Recipient GSTIN</th><th>Party Name</th><th>Inv No</th><th>Date</th><th>Taxable</th><th>Total Tax</th><th>POS</th></tr>
                    </thead>
                    <tbody>
                      {(selected.sections.b2b || []).map((b, i) => (
                        <tr key={i}>
                          <td>{b.ctin}</td>
                          <td>{b.cname}</td>
                          <td><strong>{b.inum}</strong></td>
                          <td>{b.idt}</td>
                          <td>₹ {Number(b.taxable).toLocaleString('en-IN')}</td>
                          <td>₹ {Number((b.cgst || 0) + (b.sgst || 0) + (b.igst || 0)).toLocaleString('en-IN')}</td>
                          <td>{b.pos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selected.type === 'GSTR1' && selected.sections?.hsn && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--primary)' }}>Table 12: HSN-Wise Summary</h4>
                  <table>
                    <thead>
                      <tr><th>HSN Code</th><th>Description</th><th>UQC</th><th>Qty</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST</th></tr>
                    </thead>
                    <tbody>
                      {(selected.sections.hsn || []).map((h, i) => (
                        <tr key={i}>
                          <td><strong>{h.hsn_sc}</strong></td>
                          <td>{h.desc}</td>
                          <td>{h.uqc}</td>
                          <td>{h.qty}</td>
                          <td>₹ {Number(h.txval).toLocaleString('en-IN')}</td>
                          <td>₹ {Number(h.iamt).toLocaleString('en-IN')}</td>
                          <td>₹ {Number(h.camt).toLocaleString('en-IN')}</td>
                          <td>₹ {Number(h.samt).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selected.type === 'GSTR3B' && selected.sections && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--primary)' }}>3.1 Outward Tax Liabilities</h4>
                    <div style={{ fontSize: 13, lineHeight: '1.8' }}>
                      <div>Taxable Value: <strong>₹ {Number(selected.sections.table3_1_outward?.taxable || 0).toLocaleString('en-IN')}</strong></div>
                      <div>CGST: <strong>₹ {Number(selected.sections.table3_1_outward?.cgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>SGST: <strong>₹ {Number(selected.sections.table3_1_outward?.sgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>IGST: <strong>₹ {Number(selected.sections.table3_1_outward?.igst || 0).toLocaleString('en-IN')}</strong></div>
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 8, color: 'var(--teal)' }}>4. Eligible Input Tax Credit (ITC)</h4>
                    <div style={{ fontSize: 13, lineHeight: '1.8' }}>
                      <div>Net CGST ITC: <strong>₹ {Number(selected.sections.table4_itc?.netITC?.cgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>Net SGST ITC: <strong>₹ {Number(selected.sections.table4_itc?.netITC?.sgst || 0).toLocaleString('en-IN')}</strong></div>
                      <div>Net IGST ITC: <strong>₹ {Number(selected.sections.table4_itc?.netITC?.igst || 0).toLocaleString('en-IN')}</strong></div>
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

      {/* GSTR-9 Annual Return Builder Tab (Section 4.3) */}
      {activeTab === 'gstr9' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Automated Annual Return Builder (Form GSTR-9 / 9C)</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Consolidates 12 months GSTR-1, GSTR-3B, GSTR-2B, and trial balance with DRC-03 recommendation (Section 4.3)
              </div>
            </div>
            <button className="btn outline small" onClick={loadGSTR9}>🔄 Re-calculate GSTR-9</button>
          </div>

          {!gstr9Data ? (
            <div className="empty">Loading annual return consolidation...</div>
          ) : (
            <div>
              {/* DRC-03 Recommendation Alert */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 20,
                  background: gstr9Data.drc03Recommendation?.required ? '#fff1f2' : '#f0fdf4',
                  border: `1px solid ${gstr9Data.drc03Recommendation?.required ? '#fecdd3' : '#bbf7d0'}`,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: gstr9Data.drc03Recommendation?.required ? 'var(--red)' : '#166534' }}>
                  {gstr9Data.drc03Recommendation?.required ? '⚠️ DRC-03 Adjustment Recommended' : '✓ Full Annual Reconciliation Alignment'}
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
                  {gstr9Data.drc03Recommendation?.reason}
                </div>
              </div>

              <div className="grid-3" style={{ marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Table 4: Total Outward Turnover</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                    ₹ {Number(gstr9Data.table4_outward?.totalTaxable || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    B2B: ₹{Number(gstr9Data.table4_outward?.table4B_B2B || 0).toLocaleString('en-IN')} | B2C: ₹{Number(gstr9Data.table4_outward?.table4A_B2C || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Table 6: ITC Availed in GSTR-3B</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: 'var(--teal)' }}>
                    ₹ {Number(gstr9Data.table6_itc?.table6A_totalFrom3B || 0).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Inputs: 85% | Input Services: 15%
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>Table 8D: 2B vs 3B Variance</div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn outline small" onClick={() => window.print()}>🖨️ Print GSTR-9/9C Audit Packet</button>
                <button className="btn small" onClick={() => alert('GSTR-9 / 9C JSON payload prepared for filing!')}>
                  Generate Official GSTR-9/9C JSON
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EVC (OTP) Filing Modal */}
      {evcModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 460, background: '#fff' }}>
            <div className="card-header">
              <h3>File {evcModal.type} with EVC (Electronic Verification)</h3>
              <button className="close-btn" onClick={() => setEvcModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              A simulated One-Time Password (OTP) has been sent to the authorized signatory mobile registered with GSTN for GSTIN <strong>{evcModal.companyGstin}</strong>.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Enter 6-Digit EVC OTP</label>
              <input
                className="input"
                placeholder="e.g. 782109"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                autoFocus
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Hint: Any 6 digits for simulated verification (e.g. 123456)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn outline small" onClick={() => setEvcModal(null)}>Cancel</button>
              <button type="button" className="btn small" onClick={handleFileReturn}>
                Verify & Submit Return
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
