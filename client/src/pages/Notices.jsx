import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [drcModal, setDrcModal] = useState(null);
  const [drcAmount, setDrcAmount] = useState('');
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

  const load = () => {
    api.getNotices()
      .then(data => setNotices(data.notices || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleIngestNotice = async () => {
    setIngesting(true);
    try {
      const res = await api.post('/notices/ingest', { rawText: rawNoticeInput, source: 'portal_api' });
      alert(res.message || 'Legal notice ingested & ticket created successfully!');
      setShowIngestModal(false);
      load();
      if (res.notice) setSelectedNotice(res.notice);
    } catch (err) {
      alert(err.message);
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
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateTicket = async (status, priority) => {
    if (!selectedNotice) return;
    try {
      const updated = await api.patch(`/notices/${selectedNotice._id}/ticket`, { status, priority });
      setSelectedNotice(updated);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  // Section 4.4: AI Legal Response Drafting Assistant
  const handleDraftReply = async (noticeId) => {
    setDrafting(true);
    try {
      const res = await api.draftNoticeReply(noticeId);
      setSelectedNotice(res.notice);
      load();
      alert('AI Legal Response drafted successfully with statutory citations and jurisprudence!');
    } catch (err) {
      alert(err.message);
    } finally {
      setDrafting(false);
    }
  };

  const handleSettleDRC03 = async () => {
    if (!drcModal) return;
    try {
      await api.settleNoticeDRC03(drcModal._id, { amountPaid: drcAmount });
      setDrcModal(null);
      setDrcAmount('');
      load();
      setSelectedNotice(null);
      alert('Notice settled via voluntary DRC-03 payment!');
    } catch (err) {
      alert(err.message);
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
      drafting: 'amber',
      replied: 'blue',
      settled_drc03: 'green',
      closed: 'gray',
    };
    return <span className={`badge ${map[s] || 'gray'}`}>{s?.toUpperCase()}</span>;
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Automated Notice Management & Legal Ticketing Workflow (DRC-01 / ASMT-10)</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Automated portal ingestion, legal deadline ticketing, AI response drafting & DRC-03 voluntary ledger
            </div>
          </div>
          <button className="btn small" onClick={() => setShowIngestModal(true)}>
            📥 Ingest Portal Notice (OCR / API)
          </button>
        </div>

        {/* Modal: Ingest Notice from Portal / Scrape */}
        {showIngestModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
            <div className="card" style={{ width: '90%', maxWidth: 650, background: '#fff' }}>
              <div className="card-header">
                <h3>Portal Legal Notice Ingestion & Ticket Creation</h3>
                <button className="close-btn" onClick={() => setShowIngestModal(false)}>✕</button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                Paste the text from a GST Portal communication, scanned ASMT-10, DRC-01, or SCN notice. The parser will extract statutory sections, reference numbers, demand amounts, and create a managed response ticket.
              </p>
              <textarea
                className="input"
                rows={9}
                value={rawNoticeInput}
                onChange={e => setRawNoticeInput(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 14 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn outline small" onClick={() => setShowIngestModal(false)}>Cancel</button>
                <button className="btn small" onClick={handleIngestNotice} disabled={ingesting}>
                  {ingesting ? 'Parsing Notice...' : '⚡ Ingest Notice & Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="empty">Loading departmental notices...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Notice No.</th>
                <th>Type</th>
                <th>Section</th>
                <th>Deadline</th>
                <th>Demand (Tax+Int)</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notices.map(n => (
                <tr key={n._id} onClick={() => setSelectedNotice(n)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                      {n.ticketId || `TKT-${n.noticeNo.slice(-6)}`}
                    </span>
                  </td>
                  <td><strong>{n.noticeNo}</strong></td>
                  <td><span className="badge blue" style={{ fontSize: 10.5 }}>{n.type}</span></td>
                  <td>{n.section}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>
                    {formatDate(n.dueDate)}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    ₹ {Number(n.demandAmount?.total || 0).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`badge ${n.priority === 'critical' ? 'red' : n.priority === 'high' ? 'amber' : 'gray'}`}>
                      {n.priority?.toUpperCase() || 'HIGH'}
                    </span>
                  </td>
                  <td>{statusBadge(n.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn small"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => handleDraftReply(n._id)}
                        disabled={drafting}
                      >
                        {drafting ? 'Drafting...' : '🤖 AI Draft Reply'}
                      </button>
                      {n.status !== 'settled_drc03' && (
                        <button
                          className="btn outline small"
                          style={{ fontSize: 11, padding: '3px 8px', color: 'var(--teal)' }}
                          onClick={() => { setDrcModal(n); setDrcAmount(n.demandAmount?.tax || ''); }}
                        >
                          DRC-03 Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {notices.length === 0 && (
                <tr><td colSpan={9} className="empty">No notices on record. Zero pending proceedings!</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Notice Detail & AI Drafted Reply */}
      {selectedNotice && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <h3>Notice Details: {selectedNotice.noticeNo} ({selectedNotice.type})</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Issuing Authority: {selectedNotice.issuingAuthority} | Period: {selectedNotice.period || selectedNotice.financialYear}
              </div>
            </div>
            <button className="close-btn" onClick={() => setSelectedNotice(null)}>✕</button>
          </div>

          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="badge blue" style={{ fontWeight: 700 }}>
                  Ticket: {selectedNotice.ticketId || 'TKT-PENDING'}
                </span>
                <span className={`badge ${selectedNotice.priority === 'critical' ? 'red' : selectedNotice.priority === 'high' ? 'amber' : 'gray'}`}>
                  Priority: {selectedNotice.priority?.toUpperCase()}
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Assigned: <strong>{selectedNotice.assignedToName || 'Tax Lead'}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, color: 'var(--muted)' }}>Status:</label>
                <select
                  className="input"
                  style={{ padding: '2px 8px', height: 28, fontSize: 12 }}
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

            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>Department Allegation:</div>
            <div style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{selectedNotice.description}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
              Tax Demand: ₹{Number(selectedNotice.demandAmount?.tax || 0).toLocaleString('en-IN')} | Interest: ₹{Number(selectedNotice.demandAmount?.interest || 0).toLocaleString('en-IN')} | Penalty: ₹{Number(selectedNotice.demandAmount?.penalty || 0).toLocaleString('en-IN')} | Total: <strong>₹{Number(selectedNotice.demandAmount?.total || 0).toLocaleString('en-IN')}</strong>
            </div>

            {/* Comments Thread */}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                💬 Tax Team Communication Log & Audit Trail ({selectedNotice.comments?.length || 0})
              </div>
              <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
                {(selectedNotice.comments || []).map((c, i) => (
                  <div key={i} style={{ fontSize: 11.5, background: '#fff', padding: '6px 10px', borderRadius: 4, marginBottom: 4, border: '1px solid #e2e8f0' }}>
                    <strong>{c.author}</strong> ({formatDate(c.createdAt)}): {c.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  style={{ height: 30, fontSize: 12 }}
                  placeholder="Add note or action update to ticket..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                />
                <button className="btn outline small" style={{ padding: '0 10px', height: 30 }} onClick={handleAddComment}>
                  Post Note
                </button>
              </div>
            </div>
          </div>

          {selectedNotice.aiDraftedReply ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: 14, color: 'var(--primary)' }}>
                  ✓ AI-Drafted Legal Defense Reply (Section 4.4)
                </h4>
                <button
                  className="btn outline small"
                  onClick={() => {
                    const blob = new Blob([selectedNotice.aiDraftedReply.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Reply_${selectedNotice.noticeNo.replace(/\//g, '_')}.txt`;
                    a.click();
                  }}
                >
                  📥 Download Legal Reply (.txt)
                </button>
              </div>

              {/* Citations Pill Box */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Statutory Citations & Jurisprudence Applied:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedNotice.aiDraftedReply.legalCitations?.map((c, i) => (
                    <span key={i} className="badge blue" style={{ fontSize: 11 }}>{c}</span>
                  ))}
                </div>
              </div>

              <pre
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  maxHeight: 400,
                  overflowY: 'auto',
                }}
              >
                {selectedNotice.aiDraftedReply.content}
              </pre>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                No formal legal response drafted yet for this notice.
              </p>
              <button className="btn small" onClick={() => handleDraftReply(selectedNotice._id)} disabled={drafting}>
                {drafting ? 'Generating...' : '🤖 Generate AI Legal Reply with Circular Citations'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* DRC-03 Voluntary Payment Modal */}
      {drcModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center' }}>
          <div className="card" style={{ width: '90%', maxWidth: 450, background: '#fff' }}>
            <div className="card-header">
              <h3>Record DRC-03 Voluntary Payment</h3>
              <button className="close-btn" onClick={() => setDrcModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Discharge liability for Notice <strong>{drcModal.noticeNo}</strong> via Form DRC-03 under Section 73(5) to avoid penalty.
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Tax Amount Paid (₹)</label>
              <input
                className="input"
                type="number"
                value={drcAmount}
                onChange={e => setDrcAmount(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn outline small" onClick={() => setDrcModal(null)}>Cancel</button>
              <button type="button" className="btn small" onClick={handleSettleDRC03}>
                Submit DRC-03 Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
