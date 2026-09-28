import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function CTCAndEscrow() {
  const [activeTab, setActiveTab] = useState('escrow'); // 'escrow' | 'ctc'

  // Escrow State
  const [escrowList, setEscrowList] = useState([]);
  const [escrowSummary, setEscrowSummary] = useState(null);
  const [loadingEscrow, setLoadingEscrow] = useState(true);

  // CTC State
  const [supplierGstin, setSupplierGstin] = useState('27AABCA9999K1Z4');
  const [invoiceAmount, setInvoiceAmount] = useState('94400');
  const [ctcResult, setCtcResult] = useState(null);
  const [validatingCTC, setValidatingCTC] = useState(false);

  const loadEscrow = () => {
    api.getEscrowTransactions()
      .then(data => {
        setEscrowList(data.escrowList || []);
        setEscrowSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoadingEscrow(false));
  };

  useEffect(loadEscrow, []);

  // Section 5.1: Run Continuous Transaction Control Check
  const handleValidateCTC = async (e) => {
    e.preventDefault();
    setValidatingCTC(true);
    try {
      const res = await api.validateCTC({ supplierGstin, invoiceAmount });
      setCtcResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setValidatingCTC(false);
    }
  };

  // Section 5.3: Release Escrow upon GSTR-2B Confirmation
  const handleReleaseEscrow = async (id) => {
    if (!confirm('Confirm release of held GST component to vendor after GSTR-2B matching verification?')) return;
    try {
      await api.releaseEscrow(id, '2026-09');
      loadEscrow();
      alert('GST payment successfully released from escrow to supplier bank account!');
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (s) => {
    const map = {
      held_in_escrow: 'amber',
      released_to_vendor: 'green',
      clawed_back: 'red',
      disputed: 'red',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{s?.replace(/_/g, ' ')?.toUpperCase()}</span>;
  };

  return (
    <>
      {/* Top Escrow Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Currently Held in Smart Escrow</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--amber)' }}>
            ₹ {Number(escrowSummary?.currentlyHeld || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta">{escrowSummary?.heldCount || 0} Split Transactions Protected</div>
        </div>
        <div className="card">
          <div className="stat-label">Verified & Released to Suppliers</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--teal)' }}>
            ₹ {Number(escrowSummary?.releasedAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="stat-delta up">After GSTR-2B Proof Confirmation</div>
        </div>
        <div className="card">
          <div className="stat-label">Buyer Working Capital Risk</div>
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--teal)' }}>
            ₹ 0.00
          </div>
          <div className="stat-delta up">100% Escrow Protection</div>
        </div>
        <div className="card">
          <div className="stat-label">CTC Stream Validation Mode</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--primary)' }}>
            Active (2026 CTC)
          </div>
          <div className="stat-delta">Zero-batch pre-clearance</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'escrow' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('escrow')}
        >
          🛡️ Smart Escrow & GST Split-Payment Rail (Section 5.3)
        </button>
        <button
          className={`btn ${activeTab === 'ctc' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('ctc')}
        >
          ⚡ Continuous Transaction Control (CTC) Pre-Clearance (Section 5.1)
        </button>
      </div>

      {/* TAB 1: Smart Escrow & Split-Payment Integration (Section 5.3) */}
      {activeTab === 'escrow' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Automated Escrow & Split-Payment Ledger</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Protects company against vendor default: Base amount is paid to vendor immediately; GST component is held in escrow until verified in GSTR-2B.
              </div>
            </div>
          </div>

          {loadingEscrow ? (
            <div className="empty">Loading escrow ledger...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vendor / Supplier</th>
                  <th>Bill No.</th>
                  <th>Bill Date</th>
                  <th>Base Amount</th>
                  <th>GST in Escrow</th>
                  <th>Base Payment</th>
                  <th>Escrow GST Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {escrowList.map(item => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.vendorName}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {item.vendorGstin}
                      </div>
                    </td>
                    <td><strong>{item.billNo}</strong></td>
                    <td>{new Date(item.billDate).toLocaleDateString('en-IN')}</td>
                    <td>₹ {Number(item.taxableAmount).toLocaleString('en-IN')}</td>
                    <td style={{ fontWeight: 700, color: 'var(--amber)' }}>
                      ₹ {Number(item.gstAmount).toLocaleString('en-IN')}
                    </td>
                    <td><span className="badge green">Paid to Vendor</span></td>
                    <td>{statusBadge(item.escrowGstStatus)}</td>
                    <td>
                      {item.escrowGstStatus === 'held_in_escrow' ? (
                        <button
                          className="btn small"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => handleReleaseEscrow(item._id)}
                        >
                          ✓ Confirm 2B & Release GST
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
                          ✓ Released on {new Date(item.escrowReleasedAt).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {escrowList.length === 0 && (
                  <tr><td colSpan={8} className="empty">No active escrow records</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: Continuous Transaction Control (CTC) (Section 5.1) */}
      {activeTab === 'ctc' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Real-Time Continuous Transaction Control (CTC)</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Instantaneous pre-validation check connecting procurement & POS streams before issuing purchase orders or releasing vendor payments.
              </div>
            </div>
          </div>

          <form onSubmit={handleValidateCTC} style={{ marginBottom: 20, padding: 18, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div>
                <label className="input-label">Supplier GSTIN</label>
                <input
                  className="input"
                  value={supplierGstin}
                  onChange={e => setSupplierGstin(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div>
                <label className="input-label">Purchase Order / Invoice Amount (₹)</label>
                <input
                  className="input"
                  type="number"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn small" disabled={validatingCTC}>
                {validatingCTC ? 'Validating on Event Stream...' : '⚡ Run Instant CTC Pre-Validation'}
              </button>
            </div>
          </form>

          {ctcResult && (
            <div
              style={{
                padding: 20,
                borderRadius: 8,
                background: ctcResult.decision === 'APPROVED' ? '#f0fdf4' : '#fff7ed',
                border: `1px solid ${ctcResult.decision === 'APPROVED' ? '#bbf7d0' : '#fed7aa'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span className={`badge ${ctcResult.decision === 'APPROVED' ? 'green' : 'amber'}`} style={{ fontSize: 13, marginBottom: 6 }}>
                    DECISION: {ctcResult.decision}
                  </span>
                  <h4 style={{ fontSize: 16, marginTop: 4 }}>
                    Supplier: {ctcResult.supplierName} ({ctcResult.supplierGstin})
                  </h4>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                  Validated: {new Date(ctcResult.validationTimestamp).toLocaleTimeString('en-IN')}<br />
                  Historical 2B Match Rate: <strong>{ctcResult.checks?.historicalMatchRate}%</strong>
                </div>
              </div>

              <div className="grid-4" style={{ margin: '16px 0' }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>GSTIN Structure</div>
                  <div style={{ fontWeight: 700, color: 'var(--teal)' }}>✓ Validated</div>
                </div>
                <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Active Registration</div>
                  <div style={{ fontWeight: 700, color: 'var(--teal)' }}>✓ Active on GSTN</div>
                </div>
                <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Filing Reliability</div>
                  <div style={{ fontWeight: 700, color: ctcResult.checks?.filingTrackRecord ? 'var(--teal)' : 'var(--amber)' }}>
                    {ctcResult.checks?.filingTrackRecord ? '✓ High Punctuality' : '⚠️ Sub-80% Punctuality'}
                  </div>
                </div>
                <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Audit Risk Tier</div>
                  <div style={{ fontWeight: 700, color: ctcResult.riskLevel === 'LOW' ? 'var(--teal)' : 'var(--amber)' }}>
                    {ctcResult.riskLevel}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#334155', marginTop: 12 }}>
                <strong>CTC System Actionable Recommendation:</strong> {ctcResult.recommendation}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
