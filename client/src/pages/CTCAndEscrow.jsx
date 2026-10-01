import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { SkeletonCard, SkeletonTable, ErrorState, EmptyState, StatCard, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

export default function CTCAndEscrow() {
  const [activeTab, setActiveTab] = useState('escrow'); // 'escrow' | 'ctc'

  // Escrow State
  const [escrowList, setEscrowList] = useState([]);
  const [escrowSummary, setEscrowSummary] = useState(null);
  const [loadingEscrow, setLoadingEscrow] = useState(true);
  const [escrowError, setEscrowError] = useState(null);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releasing, setReleasing] = useState(false);

  // CTC State
  const [supplierGstin, setSupplierGstin] = useState('27AABCA9999K1Z4');
  const [invoiceAmount, setInvoiceAmount] = useState('94400');
  const [ctcResult, setCtcResult] = useState(null);
  const [validatingCTC, setValidatingCTC] = useState(false);
  const toast = useToast();

  const loadEscrow = useCallback((silent = false) => {
    if (!silent) setLoadingEscrow(true);
    setEscrowError(null);
    api.getEscrowTransactions()
      .then(data => {
        setEscrowList(data.escrowList || []);
        setEscrowSummary(data.summary || null);
      })
      .catch(err => setEscrowError(err))
      .finally(() => setLoadingEscrow(false));
  }, []);

  useEffect(() => {
    loadEscrow();
  }, [loadEscrow]);

  // Section 5.1: Run Continuous Transaction Control Check
  const handleValidateCTC = async (e) => {
    e.preventDefault();
    setValidatingCTC(true);
    try {
      const res = await api.validateCTC({ supplierGstin, invoiceAmount });
      setCtcResult(res);
      toast.success(
        `CTC decision: ${res.decision}`,
        `${res.supplierName || supplierGstin} cleared on the event stream${res.riskLevel ? ` · risk ${res.riskLevel}` : ''}.`
      );
    } catch (err) {
      toast.error(err);
    } finally {
      setValidatingCTC(false);
    }
  };

  // Section 5.3: Release Escrow upon GSTR-2B Confirmation
  const handleReleaseEscrow = async () => {
    if (!releaseTarget) return;
    setReleasing(true);
    try {
      await api.releaseEscrow(releaseTarget._id, '2026-09');
      setReleaseTarget(null);
      loadEscrow(true);
      toast.success('GST released from escrow', `Vendor ${releaseTarget.vendorName} paid after GSTR-2B verification.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setReleasing(false);
    }
  };

  const statusBadge = (s) => {
    const map = {
      held_in_escrow: 'amber',
      released_to_vendor: 'green',
      clawed_back: 'red',
      disputed: 'red',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{String(s || '').replace(/_/g, ' ').toUpperCase()}</span>;
  };

  const tabs = [
    { id: 'escrow', label: '🛡️ Smart Escrow & GST split-payment (Section 5.3)' },
    { id: 'ctc', label: '⚡ Continuous Transaction Control (Section 5.1)' },
  ];

  return (
    <>
      {loadingEscrow ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <StatCard
            label="Held in smart escrow"
            icon="🔒"
            value={`₹ ${Number(escrowSummary?.currentlyHeld || 0).toLocaleString('en-IN')}`}
            accent="amber"
            delta={`${escrowSummary?.heldCount || 0} split transactions protected`}
          />
          <StatCard
            label="Released to suppliers"
            icon="✅"
            value={`₹ ${Number(escrowSummary?.releasedAmount || 0).toLocaleString('en-IN')}`}
            accent="teal"
            delta="After GSTR-2B proof confirmation"
            deltaClass="up"
          />
          <StatCard
            label="Buyer working capital at risk"
            icon="💵"
            value="₹ 0.00"
            accent="teal"
            delta="100% escrow protection"
            deltaClass="up"
          />
          <StatCard
            label="CTC validation mode"
            icon="⚡"
            value="Active"
            accent="primary"
            delta="2026 zero-batch pre-clearance"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="seg" role="tablist" aria-label="Payment control rails">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`panel-${t.id}`}
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'escrow' && (
          <button type="button" className="btn ghost small" onClick={() => loadEscrow()} disabled={loadingEscrow}>
            {loadingEscrow ? (
              <><span className="spinner sm" aria-hidden="true" /> Refreshing…</>
            ) : (
              '↻ Refresh ledger'
            )}
          </button>
        )}
      </div>

      {activeTab === 'escrow' && (
        <div
          className="card"
          id="panel-escrow"
          role="tabpanel"
          aria-labelledby="tab-escrow"
        >
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Automated escrow &amp; split-payment ledger</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Base amount pays the vendor immediately; the GST component is held until it is verified in GSTR-2B (Section 5.3).
                </div>
              </div>
            </div>
          </div>

          {loadingEscrow ? (
            <div role="status" aria-live="polite">
              <span className="sr-only">Loading escrow ledger…</span>
              <SkeletonTable rows={5} cols={6} />
            </div>
          ) : escrowError ? (
            <ErrorState error={escrowError} onRetry={() => loadEscrow()} title="Could not load the escrow ledger" />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Vendor / supplier</th>
                      <th>Bill no.</th>
                      <th>Bill date</th>
                      <th className="num">Base amount</th>
                      <th className="num">GST in escrow</th>
                      <th>Base payment</th>
                      <th>Escrow GST status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrowList.map(item => (
                      <tr key={item._id}>
                        <td>
                          <strong>{item.vendorName}</strong>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {item.vendorGstin}
                          </div>
                        </td>
                        <td><strong className="mono">{item.billNo}</strong></td>
                        <td>{new Date(item.billDate).toLocaleDateString('en-IN')}</td>
                        <td className="num">₹ {Number(item.taxableAmount).toLocaleString('en-IN')}</td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--amber-ink)' }}>
                          ₹ {Number(item.gstAmount).toLocaleString('en-IN')}
                        </td>
                        <td><span className="badge green">Paid to vendor</span></td>
                        <td>{statusBadge(item.escrowGstStatus)}</td>
                        <td>
                          <div className="row-actions">
                            {item.escrowGstStatus === 'held_in_escrow' ? (
                              <button
                                type="button"
                                className="btn tiny"
                                onClick={() => setReleaseTarget(item)}
                              >
                                ✓ Confirm 2B &amp; release GST
                              </button>
                            ) : (
                              <span style={{ fontSize: 11.5, color: 'var(--teal-ink)', fontWeight: 600 }}>
                                ✓ Released on {new Date(item.escrowReleasedAt).toLocaleDateString('en-IN')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {escrowList.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                          <EmptyState
                            icon="🛡️"
                            title="No bills in the escrow rail yet"
                            description="Split every vendor bill so the base amount releases immediately while the GST component stays protected until your supplier's GSTR-2B confirms it (Section 5.3). Record a purchase bill to open the first batch."
                            action={{ label: '+ Record a purchase bill', to: '/purchases' }}
                            secondaryAction={{ label: 'Run GSTR-2B recon', to: '/recon' }}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {escrowList.length > 0 && (
                <div className="table-meta">
                  <span>{escrowList.length} split transactions</span>
                  <span>{escrowList.filter(i => i.escrowGstStatus === 'held_in_escrow').length} awaiting GSTR-2B confirmation</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'ctc' && (
        <div
          className="card"
          id="panel-ctc"
          role="tabpanel"
          aria-labelledby="tab-ctc"
        >
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Real-time Continuous Transaction Control (CTC)</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Pre-validates procurement &amp; POS streams before a purchase order is issued or a vendor payment is released.
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleValidateCTC}
            style={{ marginBottom: 20, padding: 18, background: 'var(--card-soft)', borderRadius: 10, border: '1px solid var(--border)' }}
          >
            <div className="section-label">Pre-clearance inputs</div>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="ctc-gstin">Supplier GSTIN</label>
                <input
                  id="ctc-gstin"
                  className="input mono"
                  value={supplierGstin}
                  onChange={e => setSupplierGstin(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="ctc-amount">Purchase order / invoice amount (₹)</label>
                <input
                  id="ctc-amount"
                  className="input num"
                  type="number"
                  min="0"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn small" disabled={validatingCTC}>
                {validatingCTC ? (
                  <><span className="spinner sm" aria-hidden="true" /> Validating on event stream…</>
                ) : (
                  '⚡ Run instant CTC pre-validation'
                )}
              </button>
            </div>
          </form>

          {ctcResult ? (
            <div
              className={`callout ${ctcResult.decision === 'APPROVED' ? 'success' : 'risk'}`}
              role="status"
              aria-live="polite"
              style={{ alignItems: 'flex-start', display: 'block' }}
            >
              <div className="flex justify-between items-start gap-3 flex-wrap" style={{ marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span className={`badge ${ctcResult.decision === 'APPROVED' ? 'green' : 'amber'}`}>
                    Decision: {ctcResult.decision}
                  </span>
                  <h4 style={{ fontSize: 15, marginTop: 8 }}>
                    {ctcResult.supplierName} <span className="mono" style={{ fontWeight: 500 }}>{ctcResult.supplierGstin}</span>
                  </h4>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
                  Validated {new Date(ctcResult.validationTimestamp).toLocaleTimeString('en-IN')}<br />
                  Historical 2B match rate: <strong className="num">{ctcResult.checks?.historicalMatchRate}%</strong>
                </div>
              </div>

              <div className="grid-4" style={{ gap: 10 }}>
                {[
                  { label: 'GSTIN structure', ok: true, yes: '✓ Validated', no: '' },
                  { label: 'Active registration', ok: true, yes: '✓ Active on GSTN', no: '' },
                  { label: 'Filing reliability', ok: !!ctcResult.checks?.filingTrackRecord, yes: '✓ High punctuality', no: '⚠️ Sub-80% punctuality' },
                  { label: 'Audit risk tier', ok: ctcResult.riskLevel === 'LOW', yes: ctcResult.riskLevel, no: ctcResult.riskLevel },
                ].map(c => (
                  <div key={c.label} className="rounded-[10px] border border-gray-200 bg-white px-3 py-2">
                    <div className="text-[11px] text-gray-500">{c.label}</div>
                    <div className="text-[13px] font-bold" style={{ color: c.ok ? 'var(--teal)' : 'var(--amber)' }}>
                      {c.ok ? c.yes : c.no}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 12 }}>
                <strong>CTC recommendation:</strong> {ctcResult.recommendation}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="⚡"
              title="No pre-clearance run yet"
              description="Validate a supplier GSTIN against live registration, filing punctuality and 2B match history before you commit the purchase order — zero-batch, instant, no paperwork."
            >
              <div className="text-[12px] text-gray-500">Results appear here with an APPROVE / HOLD decision.</div>
            </EmptyState>
          )}
        </div>
      )}

      <Modal
        open={!!releaseTarget}
        onClose={() => setReleaseTarget(null)}
        title="Release escrow GST to vendor"
        subtitle={releaseTarget ? `${releaseTarget.billNo} · ${releaseTarget.vendorName}` : ''}
        maxWidth={460}
        footer={
          <>
            <button type="button" className="btn outline small" onClick={() => setReleaseTarget(null)} disabled={releasing}>
              Cancel
            </button>
            <button type="button" className="btn success small" onClick={handleReleaseEscrow} disabled={releasing}>
              {releasing ? (
                <><span className="spinner sm" aria-hidden="true" /> Releasing…</>
              ) : (
                '✓ Confirm 2B & release GST'
              )}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Confirm that this bill's ITC appears in the supplier's GSTR-2B before releasing the held GST component. The split
          cannot be reversed once the escrow batch is closed.
        </p>
        {releaseTarget && (
          <div className="flex gap-4 flex-wrap" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>
              GST held: <strong className="num" style={{ color: 'var(--ink)' }}>
                ₹ {Number(releaseTarget.gstAmount).toLocaleString('en-IN')}
              </strong>
            </span>
            <span style={{ color: 'var(--muted)' }}>
              Vendor: <strong style={{ color: 'var(--ink)' }}>{releaseTarget.vendorName}</strong>
            </span>
            <span style={{ color: 'var(--muted)' }}>
              GSTIN: <strong className="mono" style={{ color: 'var(--ink)' }}>{releaseTarget.vendorGstin}</strong>
            </span>
          </div>
        )}
      </Modal>
    </>
  );
}
