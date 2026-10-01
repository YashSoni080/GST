import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { SkeletonTable, ErrorState, EmptyState, Modal, Callout } from '../components/ui';
import { useToast } from '../components/Toast';

const FILTERS = [
  { id: 'all', label: 'All notices' },
  { id: 'open', label: 'Open' },
  { id: 'replied', label: 'Replied' },
  { id: 'settled', label: 'Settled' },
  { id: 'closed', label: 'Closed' },
];

const FILTER_GROUPS = {
  open: ['pending', 'under_review', 'drafting', 'adjudicated'],
  replied: ['replied'],
  settled: ['settled_drc03'],
  closed: ['closed'],
};

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [drafting, setDrafting] = useState(false);
  const [drcModal, setDrcModal] = useState(null);
  const [drcAmount, setDrcAmount] = useState('');
  const [settling, setSettling] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [rawNoticeInput, setRawNoticeInput] = useState(
`FORM GST ASMT-10
[See rule 99(1)]
Reference No: ZA270926019245M
Date: 2026-09-20
To: Greenshine Traders Pvt. Ltd. (GSTIN: 27AAACG1234F1Z5)

Subject: Notice for intimating discrepancies in the return after scrutiny (Section 61)
Financial Year: 2025-26  Tax Period: August 2026

Discrepancy Details:
1. Inward supplies auto-populated in GSTR-2B reflect total eligible IGST of Rs. 42,000, whereas in Table 4(A)(5) of Form GSTR-3B, Input Tax Credit of Rs. 1,12,000 has been availed.
2. Excess ITC availed without tax payment by supplier under Section 16(2)(c).

Quantification of Demand:
Tax Payable: Rs. 70,000
Interest under Section 50(1): Rs. 8,400
Penalty under Section 73(9): Rs. 10,000
Total Demand: Rs. 88,400

You are hereby requested to submit your explanation within 30 days of receipt of this notice.`
  );
  const [ingesting, setIngesting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const toast = useToast();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    api.getNotices()
      .then(data => setNotices(data.notices || data || []))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const money = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN')}`;

  const handleIngestNotice = async () => {
    setIngesting(true);
    try {
      const res = await api.post('/notices/ingest', { rawText: rawNoticeInput, source: 'portal_api' });
      toast.success('Notice ingested', res.message || 'Portal notice parsed and a legal ticket was created.');
      setShowIngestModal(false);
      load(true);
      if (res.notice) setSelectedNotice(res.notice);
    } catch (err) {
      toast.error(err);
    } finally {
      setIngesting(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedNotice) return;
    try {
      const updated = await api.post(`/notices/${selectedNotice._id}/comments`, { text: commentText });
      setSelectedNotice(updated);
      setCommentText('');
      toast.success('Note posted', 'Added to the ticket communication log & audit trail.');
      load(true);
    } catch (err) {
      toast.error(err);
    }
  };

  const handleUpdateTicket = async (status, priority) => {
    if (!selectedNotice) return;
    try {
      const updated = await api.patch(`/notices/${selectedNotice._id}/ticket`, { status, priority });
      setSelectedNotice(updated);
      toast.success('Ticket updated', `Status set to ${String(status).replace(/_/g, ' ')}.`);
      load(true);
    } catch (err) {
      toast.error(err);
    }
  };

  // Section 4.4: AI Legal Response Drafting Assistant
  const handleDraftReply = async (noticeId) => {
    setDrafting(true);
    try {
      const res = await api.draftNoticeReply(noticeId);
      setSelectedNotice(res.notice);
      load(true);
      toast.success('AI legal reply drafted', 'Statutory citations and jurisprudence applied to the defence response.');
    } catch (err) {
      toast.error(err);
    } finally {
      setDrafting(false);
    }
  };

  const handleSettleDRC03 = async () => {
    if (!drcModal) return;
    setSettling(true);
    try {
      await api.settleNoticeDRC03(drcModal._id, { amountPaid: drcAmount });
      setDrcModal(null);
      setDrcAmount('');
      load(true);
      setSelectedNotice(null);
      toast.success('Settled via DRC-03', 'Voluntary payment recorded and liability discharged under Section 73(5).');
    } catch (err) {
      toast.error(err);
    } finally {
      setSettling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  const statusBadge = (s) => {
    const map = {
      pending: 'red',
      under_review: 'amber',
      drafting: 'amber',
      replied: 'blue',
      adjudicated: 'violet',
      settled_drc03: 'green',
      closed: 'gray',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{String(s || 'pending').toUpperCase()}</span>;
  };

  const visibleNotices = notices.filter(n =>
    filter === 'all' ? true : (FILTER_GROUPS[filter] || []).includes(n.status)
  );
  const openCount = notices.filter(n => FILTER_GROUPS.open.includes(n.status)).length;

  const emptyCell = (colSpan) => (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, border: 'none' }}>
        {filter === 'all' ? (
          <EmptyState
            icon="📜"
            title="No departmental notices on record"
            description="Zero pending proceedings — and nothing to defend. Ingest an ASMT-10, DRC-01 or show-cause notice from the GST portal and this desk will parse the statutory sections, start the reply deadline ticket and draft the legal defence."
            action={{ label: '📥 Ingest a portal notice', onClick: () => setShowIngestModal(true) }}
            secondaryAction={{ label: 'Open audit radar', to: '/audit-radar' }}
          />
        ) : (
          <EmptyState
            icon="🔍"
            title="No notices in this view"
            description={`None of the ${notices.length} notices on file currently sit in this status group.`}
            action={{ label: 'Show all notices', onClick: () => setFilter('all') }}
          />
        )}
      </td>
    </tr>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="pills" role="group" aria-label="Filter notices by ticket status">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`pill ${filter === f.id ? 'active' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn ghost small" onClick={() => load()} disabled={loading}>
            {loading ? <><span className="spinner sm" aria-hidden="true" /> Refreshing…</> : '↻ Refresh'}
          </button>
          <button type="button" className="btn small" onClick={() => setShowIngestModal(true)}>
            📥 Ingest a portal notice
          </button>
        </div>
      </div>

      {!loading && !error && openCount > 0 && (
        <Callout
          tone="risk"
          icon="⏳"
          title={`${openCount} notice${openCount === 1 ? '' : 's'} awaiting a departmental reply`}
          description="ASMT-10 and DRC-01 explanations are due within 30 days of service. Reply from this desk before the deadline lapses — an unanswered notice converts the quantified demand into a recoverable liability."
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Notice management & legal ticketing (DRC-01 / ASMT-10)</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Portal ingestion, statutory deadline ticketing, AI response drafting and DRC-03 voluntary settlement
              </div>
            </div>
          </div>
          {!loading && !error && notices.length > 0 && (
            <span className="badge blue">{visibleNotices.length} shown</span>
          )}
        </div>

        {loading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading departmental notices…</span>
            <SkeletonTable rows={6} cols={7} />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => load()} title="Could not load departmental notices" />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Notice No.</th>
                    <th>Type</th>
                    <th>Section</th>
                    <th>Deadline</th>
                    <th className="num">Demand (Tax+Int)</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNotices.map(n => (
                    <tr
                      key={n._id}
                      onClick={() => setSelectedNotice(n)}
                      onKeyDown={e => { if (e.key === 'Enter') setSelectedNotice(n); }}
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {n.ticketId || `TKT-${String(n.noticeNo || '').slice(-6)}`}
                        </span>
                      </td>
                      <td><strong>{n.noticeNo}</strong></td>
                      <td><span className="badge blue">{n.type}</span></td>
                      <td>{n.section}</td>
                      <td style={{ color: 'var(--red)', fontWeight: 600 }}>
                        {formatDate(n.dueDate)}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {money(n.demandAmount?.total)}
                      </td>
                      <td>
                        <span className={`badge ${n.priority === 'critical' ? 'red' : n.priority === 'high' ? 'amber' : 'gray'}`}>
                          {n.priority?.toUpperCase() || 'HIGH'}
                        </span>
                      </td>
                      <td>{statusBadge(n.status)}</td>
                      <td>
                        <div className="row-actions" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn tiny"
                            onClick={() => handleDraftReply(n._id)}
                            disabled={drafting}
                          >
                            {drafting ? 'Drafting…' : '🤖 AI draft reply'}
                          </button>
                          {n.status !== 'settled_drc03' && (
                            <button
                              type="button"
                              className="btn outline tiny"
                              onClick={() => { setDrcModal(n); setDrcAmount(n.demandAmount?.tax || ''); }}
                            >
                              DRC-03 pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleNotices.length === 0 && emptyCell(9)}
                </tbody>
              </table>
            </div>
            {visibleNotices.length > 0 && (
              <div className="table-meta">
                <span>{visibleNotices.length} of {notices.length} notices shown</span>
                <span>{openCount} open · {notices.length - openCount} replied, settled or closed</span>
              </div>
            )}
          </>
        )}
      </div>

      {selectedNotice && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Notice details: {selectedNotice.noticeNo} ({selectedNotice.type})</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Issuing authority: {selectedNotice.issuingAuthority} · Period: {selectedNotice.period || selectedNotice.financialYear}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="close-btn"
              onClick={() => setSelectedNotice(null)}
              aria-label="Close notice details"
              title="Close notice details"
            >
              ✕
            </button>
          </div>

          <div style={{ background: 'var(--card-soft)', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center gap-3 flex-wrap" style={{ marginBottom: 10 }}>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="badge blue">Ticket: {selectedNotice.ticketId || 'TKT-PENDING'}</span>
                <span className={`badge ${selectedNotice.priority === 'critical' ? 'red' : selectedNotice.priority === 'high' ? 'amber' : 'gray'}`}>
                  Priority: {selectedNotice.priority?.toUpperCase() || 'HIGH'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Assigned: <strong>{selectedNotice.assignedToName || 'Tax Lead'}</strong>
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <label htmlFor="notice-status" className="input-label" style={{ marginBottom: 0 }}>Status</label>
                <select
                  id="notice-status"
                  className="input"
                  style={{ padding: '2px 26px 2px 8px', height: 30, fontSize: 12, width: 'auto' }}
                  value={selectedNotice.status}
                  onChange={e => handleUpdateTicket(e.target.value, selectedNotice.priority)}
                >
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="drafting">Drafting Reply</option>
                  <option value="replied">Replied to Department</option>
                  <option value="adjudicated">Adjudicated</option>
                  <option value="settled_drc03">Settled via DRC-03</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="section-label" style={{ marginBottom: 4, color: 'var(--red)' }}>Department allegation</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{selectedNotice.description}</div>

            <div className="section-label" style={{ margin: '12px 0 6px' }}>Demand quantification</div>
            <div className="flex gap-4 flex-wrap" style={{ fontSize: 12, color: 'var(--muted)' }}>
              <span>Tax <strong className="num" style={{ color: 'var(--ink)' }}>{money(selectedNotice.demandAmount?.tax)}</strong></span>
              <span>Interest <strong className="num" style={{ color: 'var(--ink)' }}>{money(selectedNotice.demandAmount?.interest)}</strong></span>
              <span>Penalty <strong className="num" style={{ color: 'var(--ink)' }}>{money(selectedNotice.demandAmount?.penalty)}</strong></span>
              <span>Total <strong className="num" style={{ color: 'var(--red)' }}>{money(selectedNotice.demandAmount?.total)}</strong></span>
            </div>

            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <div className="section-label" style={{ marginBottom: 6 }}>
                💬 Tax team communication log & audit trail ({selectedNotice.comments?.length || 0})
              </div>
              <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 8 }} aria-live="polite">
                {(selectedNotice.comments || []).map((c, i) => (
                  <div key={i} style={{ fontSize: 12, background: '#fff', padding: '6px 10px', borderRadius: 6, marginBottom: 4, border: '1px solid var(--border)' }}>
                    <strong>{c.author}</strong> ({formatDate(c.createdAt)}): {c.text}
                  </div>
                ))}
                {(selectedNotice.comments || []).length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>
                    No notes yet — record every call, upload and department communication here for the audit trail.
                  </div>
                )}
              </div>
              <div className="flex gap-2 items-center">
                <label htmlFor="notice-comment" className="sr-only">Add a note to this ticket</label>
                <input
                  id="notice-comment"
                  className="input"
                  style={{ height: 32, fontSize: 12.5 }}
                  placeholder="Add note or action update to ticket…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                />
                <button type="button" className="btn outline small" onClick={handleAddComment} disabled={!commentText.trim()}>
                  Post note
                </button>
              </div>
            </div>
          </div>

          {selectedNotice.aiDraftedReply ? (
            <div>
              <div className="flex justify-between items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 0, color: 'var(--primary)' }}>
                  ✓ AI-drafted legal defence reply (Section 4.4)
                </div>
                <button
                  type="button"
                  className="btn outline small"
                  onClick={() => {
                    const blob = new Blob([selectedNotice.aiDraftedReply.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Reply_${selectedNotice.noticeNo.replace(/\//g, '_')}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Legal reply downloaded', `${a.download} saved to your device.`);
                  }}
                >
                  📥 Download reply (.txt)
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  Statutory citations & jurisprudence applied
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(selectedNotice.aiDraftedReply.legalCitations || []).map((c, i) => (
                    <span key={i} className="badge blue">{c}</span>
                  ))}
                  {(selectedNotice.aiDraftedReply.legalCitations || []).length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>No citations attached to this draft.</span>
                  )}
                </div>
              </div>

              <pre
                className="mono"
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  padding: 16,
                  borderRadius: 10,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  maxHeight: 400,
                  overflowY: 'auto',
                }}
              >
                {selectedNotice.aiDraftedReply.content}
              </pre>
            </div>
          ) : (
            <EmptyState
              icon="🤖"
              title="No formal legal response drafted yet"
              description="Generate the AI defence reply for this notice — it cites the governing sections, CBIC circulars and jurisprudence, then gives you an editable draft to file with the department."
              action={{
                label: drafting ? 'Generating reply…' : '🤖 Generate AI legal reply',
                onClick: () => handleDraftReply(selectedNotice._id),
              }}
            />
          )}
        </div>
      )}

      <Modal
        open={showIngestModal}
        onClose={() => setShowIngestModal(false)}
        title="Portal legal notice ingestion"
        subtitle="ASMT-10 · DRC-01 · SCN — extracts sections, reference numbers, demand amounts and opens a response ticket"
        maxWidth={650}
        footer={
          <>
            <button type="button" className="btn outline small" onClick={() => setShowIngestModal(false)}>Cancel</button>
            <button type="button" className="btn small" onClick={handleIngestNotice} disabled={ingesting}>
              {ingesting ? (
                <><span className="spinner sm" aria-hidden="true" /> Parsing notice…</>
              ) : (
                '⚡ Ingest notice & create ticket'
              )}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="input-label" htmlFor="notice-raw-text">Paste the portal communication text</label>
          <textarea
            id="notice-raw-text"
            className="input"
            rows={9}
            value={rawNoticeInput}
            onChange={e => setRawNoticeInput(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
          <div className="form-hint">
            OCR output, portal API text or a scanned notice all work — the parser tags the statutory section and starts the 30-day reply clock.
          </div>
        </div>
      </Modal>

      <Modal
        open={!!drcModal}
        onClose={() => setDrcModal(null)}
        title="Record DRC-03 voluntary payment"
        subtitle={drcModal ? `Notice ${drcModal.noticeNo} · discharge liability under Section 73(5)` : ''}
        maxWidth={450}
        footer={
          <>
            <button type="button" className="btn outline small" onClick={() => setDrcModal(null)} disabled={settling}>Cancel</button>
            <button type="button" className="btn small" onClick={handleSettleDRC03} disabled={settling}>
              {settling ? (
                <><span className="spinner sm" aria-hidden="true" /> Recording…</>
              ) : (
                'Submit DRC-03 settlement'
              )}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Pay the quantified demand through Form DRC-03 to close the proceeding before adjudication and avoid penalty under Section 73.
        </p>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="input-label" htmlFor="drc-amount">Tax amount paid (₹)</label>
          <input
            id="drc-amount"
            className="input"
            type="number"
            min="0"
            value={drcAmount}
            onChange={e => setDrcAmount(e.target.value)}
            required
          />
          <div className="form-hint">Interest and penalty are paid together in the same DRC-03 challan.</div>
        </div>
      </Modal>
    </>
  );
}
