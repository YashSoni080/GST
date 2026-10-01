import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, Callout, SkeletonCard, SkeletonTable, EmptyState, ErrorState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

const FILTERS = ['all', 'matched', 'approximate', 'mismatch', 'missing', 'extra'];

export default function Reconciliation() {
  const toast = useToast();
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [period, setPeriod] = useState('2026-09');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('all');
  const [notifying, setNotifying] = useState(false);
  const [nudgeModal, setNudgeModal] = useState(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.getReconRuns()
      .then(data => {
        const r = data.runs || data || [];
        setRuns(r);
        if (r.length > 0 && !currentRun) {
          setCurrentRun(r[0]);
        }
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRunRecon = async () => {
    setRunning(true);
    try {
      const res = await api.runRecon(period);
      load();
      setCurrentRun(res);
      const matched = (res.summary?.matched || 0) + (res.summary?.approximate || 0);
      toast.success(
        `4-Way Reconciliation completed for ${period}`,
        `${matched} invoices matched exactly or approximately out of ${res.summary?.total || 0} evaluated.`,
      );
    } catch (err) {
      toast.error('Reconciliation run failed', err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleAction = async (itemId, action) => {
    if (!currentRun) return;
    try {
      await api.actionReconItem(currentRun._id, itemId, action);
      const refreshed = await api.getReconRun(currentRun._id);
      setCurrentRun(refreshed);
      toast.success(`Invoice marked ${String(action).replace(/_/g, ' ')}`, 'The decision is saved against this reconciliation run.');
    } catch (err) {
      toast.error('Could not update this invoice', err.message);
    }
  };

  const handleNotifyVendor = async (supplierGstin) => {
    if (!currentRun) return;
    setNotifying(true);
    try {
      const res = await api.notifyVendor(currentRun._id, supplierGstin);
      toast.success(
        res.message || 'Discrepancy alert dispatched to supplier!',
        `Supplier ${supplierGstin} notified for run ${currentRun.period}.`,
      );
      const refreshed = await api.getReconRun(currentRun._id);
      setCurrentRun(refreshed);
    } catch (err) {
      toast.error('Vendor alert could not be dispatched', err.message);
    } finally {
      setNotifying(false);
    }
  };

  const handleOpenNudge = async (supplierGstin) => {
    if (!currentRun) return;
    setNudgeLoading(true);
    try {
      const res = await api.post(`/recon/${currentRun._id}/nudge-preview`, { supplierGstin });
      setNudgeModal(res);
    } catch (err) {
      toast.error('Failed to generate nudge preview', err.message);
    } finally {
      setNudgeLoading(false);
    }
  };

  const statusBadge = (s) => {
    const map = {
      matched: 'green',
      approximate: 'blue',
      mismatch: 'red',
      missing: 'amber',
      extra: 'gray',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{s?.toUpperCase()}</span>;
  };

  const actionBadge = (a) => {
    const map = {
      accepted: 'green',
      rejected: 'red',
      on_hold: 'amber',
      provisional_claim: 'blue',
      pending: 'gray',
    };
    return <span className={`badge ${map[a] || 'gray'}`}>{a}</span>;
  };

  const results = currentRun?.results || [];
  const filteredResults = results.filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });
  const summary = currentRun?.summary || {};
  const missingCount = summary.missing || 0;
  const itcAtRisk = Number(summary.itcAtRisk || 0);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="section-label">
            GSTR-2B vs Purchase Register · Section 3.3
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            4-way rule-based matching: Exact (100%), Approximate (tolerances), Mismatches, and Missing/Extra records.
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="input-label" htmlFor="recon-period">Return period</label>
            <input
              id="recon-period"
              type="month"
              className="input"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{ width: 156 }}
            />
          </div>
          <button type="button" className="btn" onClick={handleRunRecon} disabled={running}>
            {running ? (
              <>
                <span className="spinner sm" aria-hidden="true" />
                Reconciling…
              </>
            ) : (
              '⚡ Run 4-Way Reconciliation'
            )}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, minHeight: 16 }}>
        {running
          ? `Running 4-way matching for ${period}…`
          : notifying
            ? 'Dispatching discrepancy alert to supplier…'
            : nudgeLoading
              ? 'Preparing vendor communication preview…'
              : ''}
      </div>

      {/* Metrics Row */}
      {loading && !currentRun ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : currentRun ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <StatCard
              label="Total Inward ITC Evaluated"
              icon="🧾"
              value={`₹ ${Number(summary.itcInvolved || 0).toLocaleString('en-IN')}`}
              delta={`Period ${currentRun.period}`}
            />
            <StatCard
              label="Exact & Approx Matched"
              icon="✅"
              accent="teal"
              value={`${(summary.matched || 0) + (summary.approximate || 0)} Invoices`}
              delta="Eligible for 100% ITC Claim"
              deltaClass="up"
            />
            <StatCard
              label="Missing in GSTR-2B"
              icon="⚠️"
              accent="amber"
              value={`${missingCount} Bills`}
              delta="Vendor has not filed GSTR-1"
              deltaClass="amber-text"
            />
            <StatCard
              label="ITC at Risk (Blocked)"
              icon="⛔"
              value={<span style={{ color: 'var(--red)' }}>₹ {itcAtRisk.toLocaleString('en-IN')}</span>}
              delta="Requires Vendor Action"
              deltaClass="down"
            />
          </div>

          {itcAtRisk > 0 || missingCount > 0 ? (
            <Callout
              tone="risk"
              icon="⚠️"
              title={`₹ ${itcAtRisk.toLocaleString('en-IN')} of ITC blocked for ${currentRun.period}`}
              description={`${missingCount} bill(s) are missing from GSTR-2B — the supplier has not filed GSTR-1, so this credit cannot be claimed under Rule 36(4) until they do.`}
              actions={
                <button type="button" className="btn outline small" onClick={() => setFilter('missing')}>
                  Review missing invoices
                </button>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
        </>
      ) : null}

      {/* Main Reconciliation Results */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Reconciliation Results {currentRun ? `— ${currentRun.period}` : ''}</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Accept, Hold, or dispatch automated vendor alerts from each row
              </div>
            </div>
          </div>
          <div className="pills" role="group" aria-label="Filter reconciliation results by status">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`pill${filter === f ? ' active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={load} title="Could not load reconciliation runs" />
        ) : !currentRun ? (
          <EmptyState
            icon="⚖️"
            title="No reconciliation runs yet"
            description="The 4-way engine matches your Purchase Register against GSTR-2B line by line — exact, approximate, mismatched and missing/extra records — so you only claim credit the portal can see."
            action={{ label: '⚡ Run 4-Way Reconciliation', onClick: handleRunRecon }}
            secondaryAction={{ label: 'Record purchases first', to: '/purchases' }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier / GSTIN</th>
                    <th>Bill / Doc No</th>
                    <th className="num">Books Taxable</th>
                    <th className="num">2B Taxable</th>
                    <th className="num">Books GST</th>
                    <th className="num">2B GST</th>
                    <th>Status</th>
                    <th>Action Status</th>
                    <th>One-Click Triggers</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map(item => (
                    <tr key={item._id}>
                      <td>
                        <strong>{item.supplierName || 'Unknown Supplier'}</strong>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {item.supplierGstin}
                        </div>
                      </td>
                      <td><strong className="mono">{item.invoiceNo}</strong></td>
                      <td className="num">₹ {Number(item.taxable || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(item.docTaxable || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(item.gst || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(item.docGst || 0).toLocaleString('en-IN')}</td>
                      <td>{statusBadge(item.status)}</td>
                      <td>{actionBadge(item.action)}</td>
                      <td>
                        <div className="row-actions">
                          {item.action !== 'accepted' && (
                            <button
                              type="button"
                              className="btn outline tiny"
                              onClick={() => handleAction(item._id, 'accepted')}
                              aria-label={`Accept invoice ${item.invoiceNo}`}
                            >
                              Accept
                            </button>
                          )}
                          {item.action !== 'on_hold' && (
                            <button
                              type="button"
                              className="btn outline tiny"
                              style={{ color: 'var(--amber-ink)' }}
                              onClick={() => handleAction(item._id, 'on_hold')}
                              aria-label={`Put invoice ${item.invoiceNo} on hold`}
                            >
                              Hold
                            </button>
                          )}
                          {(item.status === 'missing' || item.status === 'mismatch') && (
                            <>
                              <button
                                type="button"
                                className="btn tiny"
                                style={{ background: '#d97706' }}
                                onClick={() => handleNotifyVendor(item.supplierGstin)}
                                disabled={notifying}
                                aria-label={`Email discrepancy alert for invoice ${item.invoiceNo}`}
                              >
                                ✉️ Alert Vendor
                              </button>
                              <button
                                type="button"
                                className="btn outline tiny"
                                onClick={() => handleOpenNudge(item.supplierGstin)}
                                disabled={nudgeLoading}
                                title="Open WhatsApp & Multi-Channel Vendor Communication Center"
                                aria-label={`Open vendor communication center for invoice ${item.invoiceNo}`}
                              >
                                📢 Nudge
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredResults.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0, border: 'none' }}>
                        <EmptyState
                          icon="🔍"
                          title={`No "${filter}" records in this run`}
                          description={`All ${results.length} invoice lines in run ${currentRun.period} are classified differently. Pick another status filter to review them.`}
                          action={{ label: 'Show all records', onClick: () => setFilter('all') }}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                Showing {filteredResults.length} of {results.length} invoice lines · Run {currentRun.period}
              </span>
              <span>
                {runs.length} reconciliation run{runs.length === 1 ? '' : 's'} on file
                {currentRun.createdAt ? ` · Generated ${new Date(currentRun.createdAt).toLocaleString('en-IN')}` : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {/* PRD Section 2.5: Automated Vendor Communication Loop ("Nudge" Center Modal) */}
      <Modal
        open={!!nudgeModal}
        onClose={() => setNudgeModal(null)}
        title="Vendor Communication Center"
        subtitle={
          nudgeModal
            ? `Automated discrepancy nudge for ${nudgeModal.vendorName} (${nudgeModal.vendorGstin})`
            : ''
        }
        maxWidth={560}
        footer={
          <>
            <button type="button" className="btn ghost small" onClick={() => setNudgeModal(null)}>
              Close
            </button>
            <a href={nudgeModal?.mailtoUrl} className="btn outline small">
              📧 Dispatch Email
            </a>
            <a
              href={nudgeModal?.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn success small"
            >
              💬 Open WhatsApp
            </a>
          </>
        }
      >
        {nudgeModal ? (
          <div className="space-y-4">
            <Callout
              tone="risk"
              icon="⚠️"
              title="Discrepancy impact"
              description={
                <>
                  {nudgeModal.discrepancyCount} invoice(s) affecting{' '}
                  <strong>₹{Number(nudgeModal.totalTaxInvolved || 0).toLocaleString('en-IN')}</strong> in blocked ITC.
                </>
              }
            />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="nudge-preview">Preview message payload</label>
              <textarea
                id="nudge-preview"
                readOnly
                rows={6}
                value={nudgeModal.textBody}
                className="input mono"
              />
              <div className="form-hint">Direct statutory communication channels:</div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
