import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, Callout, SkeletonCard, SkeletonTable, EmptyState, ErrorState, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

const TABS = [
  { id: 'all', label: 'All Invoices' },
  { id: 'pending', label: 'Pending Action' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
];

const REJECT_REASONS = [
  'Goods or services not received / Incorrect invoice details',
  'Incorrect recipient GSTIN / Wrong customer',
  'Duplicate invoice entered by supplier',
  'Mismatched tax rates or wrong HSN computation',
  'Commercial dispute / Pending credit note',
];

export default function IMSWorkspace() {
  const toast = useToast();
  const [period, setPeriod] = useState('2026-09');
  const [filterState, setFilterState] = useState('all');
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [targetRejectIds, setTargetRejectIds] = useState([]);

  const loadData = () => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      period,
      imsState: filterState,
      ...(search ? { search } : {}),
      limit: '100',
    });

    api.get(`/ims?${query.toString()}`)
      .then((res) => {
        setDocuments(res.documents || []);
        setSummary(res.summary || null);
        setSelectedIds([]);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [period, filterState]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(documents.map((d) => d._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const performAction = async (docIds, action, reason = null) => {
    if (!docIds || docIds.length === 0) return;
    setActing(true);
    try {
      const res = await api.patch('/ims/action', {
        docIds,
        action,
        rejectedReason: reason,
      });
      toast.success(
        res.message || `Marked ${docIds.length} invoice(s) as ${action}`,
        `${period} IMS determinations updated.`
      );
      loadData();
    } catch (err) {
      toast.error('Failed to update IMS state', err.message);
    } finally {
      setActing(false);
      setRejectModalOpen(false);
    }
  };

  const handleOpenReject = (ids) => {
    setTargetRejectIds(ids);
    setRejectModalOpen(true);
  };

  const handleSyncPortal = () => {
    setConfirmSyncOpen(true);
  };

  const handleConfirmSyncPortal = async () => {
    setConfirmSyncOpen(false);
    setSyncing(true);
    try {
      const res = await api.post('/ims/sync-portal', { period });
      setSyncResult(res.syncSummary);
      toast.success('GSTN IMS sync complete', `${period} determinations pushed to the portal.`);
      loadData();
    } catch (err) {
      toast.error('Failed to sync with GSTN portal', err.message);
    } finally {
      setSyncing(false);
    }
  };

  const seedSampleDocs = async () => {
    try {
      const sampleDocs = [
        {
          period,
          docDate: '2026-09-03',
          supplierGstin: '27AABCU9603R1ZM',
          supplierName: 'Acme Cloud Infrastructure Pvt Ltd',
          invoiceNo: 'INV/2026/0912',
          docType: 'invoice',
          taxableValue: 120000,
          igst: 21600,
          cgst: 0,
          sgst: 0,
          placeOfSupply: '27 Maharashtra',
          imsState: 'pending',
        },
        {
          period,
          docDate: '2026-09-07',
          supplierGstin: '29AABCL2026K1ZP',
          supplierName: 'Bharat Precision Logistics Ltd',
          invoiceNo: 'BPL-2026-441',
          docType: 'invoice',
          taxableValue: 45000,
          cgst: 4050,
          sgst: 4050,
          placeOfSupply: '29 Karnataka',
          imsState: 'accepted',
        },
        {
          period,
          docDate: '2026-09-12',
          supplierGstin: '07AAECR7890M1Z2',
          supplierName: 'Zenith Legal & Corporate Advisors',
          invoiceNo: 'ZN-LEG-88',
          docType: 'invoice',
          taxableValue: 35000,
          igst: 6300,
          cgst: 0,
          sgst: 0,
          placeOfSupply: '07 Delhi',
          imsState: 'pending',
        },
        {
          period,
          docDate: '2026-09-15',
          supplierGstin: '24AAACP4412E1Z8',
          supplierName: 'Surat Textiles & Raw Fibres',
          invoiceNo: 'TX-2026-9041',
          docType: 'creditNote',
          taxableValue: -15000,
          cgst: -750,
          sgst: -750,
          placeOfSupply: '24 Gujarat',
          imsState: 'accepted',
        },
        {
          period,
          docDate: '2026-09-18',
          supplierGstin: '33AABCT3311D1ZX',
          supplierName: 'Titan Enterprise Hardware Solutions',
          invoiceNo: 'TH-99410',
          docType: 'invoice',
          taxableValue: 88000,
          igst: 15840,
          cgst: 0,
          sgst: 0,
          placeOfSupply: '33 Tamil Nadu',
          imsState: 'rejected',
          rejectedReason: 'Material delivered to wrong warehouse, credit note awaited',
        },
      ];

      await api.post('/recon/ingest-2b', {
        period,
        documents: sampleDocs,
      });
      toast.success('Sample GSTR-2B / IMS documents seeded', `${sampleDocs.length} inward records loaded for ${period}.`);
      loadData();
    } catch (err) {
      toast.error('Failed to seed sample documents', err.message);
    }
  };

  const activeTabLabel = TABS.find((t) => t.id === filterState)?.label || 'All Invoices';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="section-label">
            Invoice Management System · Rule 36(4)
            <span className="badge violet">Rule 36(4) Compliant</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Statutory inward supply review — accept, reject or hold supplier invoices, then push determinations to GSTN by the 14th of the month.
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="input-label" htmlFor="ims-period">Return period</label>
            <input
              id="ims-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input"
              style={{ width: 156 }}
            />
          </div>
          <button
            type="button"
            onClick={seedSampleDocs}
            title="Load sample inward 2B records for walkthrough / testing"
            className="btn outline"
          >
            Load demo template
          </button>
          <button
            type="button"
            onClick={handleSyncPortal}
            disabled={syncing}
            className="btn"
          >
            {syncing ? (
              <>
                <span className="spinner sm" aria-hidden="true" />
                Pushing to GSTN…
              </>
            ) : (
              '⚡ Push Decisions to GSTN'
            )}
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 16 }}>
        {syncing
          ? `Pushing ${period} IMS determinations to GSTN…`
          : acting
            ? 'Updating invoice determinations…'
            : loading
              ? 'Loading inward supplier documents…'
              : ''}
      </div>

      {/* Sync Banner if just synced */}
      {syncResult && (
        <div aria-live="polite">
          <Callout
            tone="success"
            icon="✅"
            title={
              <>
                Official GSTN IMS Sync Complete{' '}
                <span className="badge green mono" style={{ marginLeft: 6 }}>
                  ACK: {syncResult.ackId}
                </span>
              </>
            }
            description={
              <>
                Synced {syncResult.totalPushed} documents for {syncResult.period}. Accepted ITC:{' '}
                <strong>₹{(syncResult.accepted?.itcValue || 0).toLocaleString('en-IN')}</strong> (
                {syncResult.accepted?.count || 0} docs) · Rejected: <strong>{syncResult.rejected?.count || 0}</strong>{' '}
                docs · Pending: <strong>{syncResult.pending?.count || 0}</strong> docs.
              </>
            }
            actions={
              <button type="button" className="btn ghost small" onClick={() => setSyncResult(null)}>
                Dismiss
              </button>
            }
          />
        </div>
      )}

      {/* KPI Cards */}
      {loading && !summary ? (
        <div className="grid-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={124} />
          ))}
        </div>
      ) : summary ? (
        <div className="grid-4">
          <StatCard
            label="Total Inward Docs"
            icon="📥"
            value={summary.totalCount}
            delta={`Taxable: ₹${(summary.totalTaxable || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          />
          <StatCard
            label="Accepted for ITC"
            icon="✅"
            accent="teal"
            value={summary.acceptedCount}
            delta={`ITC: ₹${(summary.acceptedITC || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            deltaClass="up"
          />
          <StatCard
            label="Pending Decision"
            icon="⏳"
            accent="amber"
            value={summary.pendingCount}
            delta={`ITC: ₹${(summary.pendingITC || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            deltaClass="amber-text"
          />
          <StatCard
            label="Rejected"
            icon="⛔"
            value={<span style={{ color: 'var(--red)' }}>{summary.rejectedCount}</span>}
            delta={`Blocked ITC: ₹${(summary.rejectedITC || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            deltaClass="down"
          />
        </div>
      ) : null}

      {/* Filter toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="seg" role="group" aria-label="Filter invoices by IMS state">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filterState === tab.id}
              className={filterState === tab.id ? 'active' : ''}
              onClick={() => setFilterState(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            id="ims-search"
            type="search"
            aria-label="Search invoice number, GSTIN or supplier"
            placeholder="Search Invoice #, GSTIN, Supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ width: 260 }}
          />
          <button type="submit" className="btn outline small">
            Filter
          </button>
        </form>
      </div>

      {/* Selected Rows Action Bar */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5"
          role="status"
          aria-live="polite"
        >
          <span className="text-xs font-semibold text-indigo-900">
            {selectedIds.length} of {documents.length} invoice(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => performAction(selectedIds, 'accepted')}
              disabled={acting}
              className="btn success small"
            >
              ✓ Bulk Accept
            </button>
            <button
              type="button"
              onClick={() => performAction(selectedIds, 'pending')}
              disabled={acting}
              className="btn outline small"
            >
              ⏸ Keep Pending
            </button>
            <button
              type="button"
              onClick={() => handleOpenReject(selectedIds)}
              disabled={acting}
              className="btn danger small"
            >
              ✕ Bulk Reject
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <h3>Inward Supplier Documents · {period}</h3>
          </div>
          {!loading && !error && documents.length > 0 ? (
            <span className="badge gray">{documents.length} docs · {activeTabLabel}</span>
          ) : null}
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : error ? (
          <ErrorState error={error} onRetry={loadData} title="Could not load inward documents" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon="📥"
            title={`No inward documents for ${period}`}
            description={
              filterState === 'all'
                ? 'Inward GSTR-2B invoices appear here after a GSTN portal sync or an upload. Each decision you take is reported back to the supplier and drives your Rule 36(4) eligible ITC.'
                : `Nothing matches the "${activeTabLabel}" view for ${period}. Switch back to All Invoices, sync the GSTN portal, or load the demo template to try the accept / reject workflow.`
            }
            action={{ label: 'Load demo template', onClick: seedSampleDocs }}
            secondaryAction={{ label: 'Run 2B reconciliation', to: '/recon' }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all invoices on this page"
                        checked={documents.length > 0 && selectedIds.length === documents.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Invoice No / Date</th>
                    <th>Supplier Info</th>
                    <th>Doc Type</th>
                    <th className="num">Taxable Value</th>
                    <th className="num">Tax (ITC)</th>
                    <th>IMS Status</th>
                    <th>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const itc = (doc.igst || 0) + (doc.cgst || 0) + (doc.sgst || 0) + (doc.cess || 0) || (doc.gst || 0);
                    const isSelected = selectedIds.includes(doc._id);

                    let statusBadge = 'badge amber';
                    let statusLabel = 'Pending';
                    if (doc.imsState === 'accepted') {
                      statusBadge = 'badge green';
                      statusLabel = 'Accepted';
                    } else if (doc.imsState === 'rejected') {
                      statusBadge = 'badge red';
                      statusLabel = 'Rejected';
                    }

                    return (
                      <tr key={doc._id} className={isSelected ? 'bg-indigo-50/40' : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select invoice ${doc.invoiceNo}`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(doc._id)}
                          />
                        </td>
                        <td>
                          <strong>{doc.invoiceNo}</strong>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {doc.docDate ? new Date(doc.docDate).toLocaleDateString('en-IN') : '—'}
                          </div>
                        </td>
                        <td>
                          <strong>{doc.supplierName || 'Unknown Vendor'}</strong>
                          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {doc.supplierGstin}
                          </div>
                        </td>
                        <td>
                          <span className="badge gray" style={{ textTransform: 'capitalize' }}>
                            {doc.docType}
                          </span>
                        </td>
                        <td className="num">₹{(doc.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="num" style={{ color: 'var(--primary)', fontWeight: 650 }}>
                          ₹{itc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={statusBadge}>{statusLabel}</span>
                          {doc.rejectedReason && (
                            <div
                              style={{ fontSize: 11, color: 'var(--red)', maxWidth: 170 }}
                              title={doc.rejectedReason}
                            >
                              {doc.rejectedReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              title="Accept for GSTR-2B"
                              aria-label={`Accept invoice ${doc.invoiceNo} for GSTR-2B`}
                              onClick={() => performAction([doc._id], 'accepted')}
                              disabled={acting}
                              className="btn ghost small"
                              style={{ color: 'var(--teal-ink)', padding: '0 8px' }}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              title="Keep Pending"
                              aria-label={`Keep invoice ${doc.invoiceNo} pending`}
                              onClick={() => performAction([doc._id], 'pending')}
                              disabled={acting}
                              className="btn ghost small"
                              style={{ color: 'var(--amber-ink)', padding: '0 8px' }}
                            >
                              ⏸
                            </button>
                            <button
                              type="button"
                              title="Reject"
                              aria-label={`Reject invoice ${doc.invoiceNo}`}
                              onClick={() => handleOpenReject([doc._id])}
                              disabled={acting}
                              className="btn ghost small"
                              style={{ color: 'var(--red)', padding: '0 8px' }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                {selectedIds.length > 0
                  ? `${selectedIds.length} of ${documents.length} selected`
                  : `${documents.length} document(s) shown`}
              </span>
              <span>
                {summary ? `Accepted ${summary.acceptedCount} · Pending ${summary.pendingCount} · Rejected ${summary.rejectedCount}` : ''}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Sync confirmation */}
      <Modal
        open={confirmSyncOpen}
        onClose={() => setConfirmSyncOpen(false)}
        title="Push decisions to the GSTN portal?"
        subtitle={`IMS determinations for ${period}`}
        maxWidth={520}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setConfirmSyncOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={handleConfirmSyncPortal} disabled={syncing}>
              {syncing ? 'Pushing…' : '⚡ Push to GSTN'}
            </button>
          </>
        }
      >
        <Callout
          tone="risk"
          icon="🔒"
          title="This locks your GSTR-2B inward ITC register for the period"
          description="Accepted invoices become claimable ITC, rejections are reported back to the supplier, and pending items stay visible until the next IMS window. Review your selection before pushing."
        />
      </Modal>

      {/* Rejection Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Inward Invoice(s)"
        subtitle="Provide a statutory rejection reason — it is transmitted to the supplier via GSTN IMS."
        maxWidth={520}
        footer={
          <>
            <button type="button" className="btn ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => performAction(targetRejectIds, 'rejected', rejectReason)}
              disabled={acting}
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="ims-reject-reason">Rejection reason</label>
          <select
            id="ims-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="input"
          >
            {REJECT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <div className="form-hint">
            {targetRejectIds.length} invoice(s) will be rejected and the reason shared with the supplier.
          </div>
        </div>
      </Modal>
    </div>
  );
}
