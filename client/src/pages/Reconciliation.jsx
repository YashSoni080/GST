import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Reconciliation() {
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState(null);
  const [period, setPeriod] = useState('2026-09');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('all');
  const [notifying, setNotifying] = useState(false);
  const [nudgeModal, setNudgeModal] = useState(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);

  const load = () => {
    api.getReconRuns()
      .then(data => {
        const r = data.runs || data || [];
        setRuns(r);
        if (r.length > 0 && !currentRun) {
          setCurrentRun(r[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRunRecon = async () => {
    setRunning(true);
    try {
      const res = await api.runRecon(period);
      load();
      setCurrentRun(res);
      alert(`4-Way Reconciliation completed for period ${period}!`);
    } catch (err) {
      alert(err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleAction = async (itemId, action) => {
    if (!currentRun) return;
    try {
      await api.actionReconItem(currentRun._id, itemId, action);
      // Reload current run
      const refreshed = await api.getReconRun(currentRun._id);
      setCurrentRun(refreshed);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleNotifyVendor = async (supplierGstin) => {
    if (!currentRun) return;
    setNotifying(true);
    try {
      const res = await api.notifyVendor(currentRun._id, supplierGstin);
      alert(res.message || 'Discrepancy alert dispatched to supplier!');
      const refreshed = await api.getReconRun(currentRun._id);
      setCurrentRun(refreshed);
    } catch (err) {
      alert(err.message);
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
      alert(err.message || 'Failed to generate nudge preview');
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

  const filteredResults = (currentRun?.results || []).filter(item => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  return (
    <>
      {/* Metrics Row */}
      {currentRun && (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="stat-label">Total Inward ITC Evaluated</div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              ₹ {Number(currentRun.summary?.itcInvolved || 0).toLocaleString('en-IN')}
            </div>
            <div className="stat-delta">Period {currentRun.period}</div>
          </div>
          <div className="card">
            <div className="stat-label">Exact & Approx Matched</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--teal)' }}>
              {(currentRun.summary?.matched || 0) + (currentRun.summary?.approximate || 0)} Invoices
            </div>
            <div className="stat-delta up">Eligible for 100% ITC Claim</div>
          </div>
          <div className="card">
            <div className="stat-label">Missing in GSTR-2B</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--amber)' }}>
              {currentRun.summary?.missing || 0} Bills
            </div>
            <div className="stat-delta amber-text">Vendor has not filed GSTR-1</div>
          </div>
          <div className="card">
            <div className="stat-label">ITC at Risk (Blocked)</div>
            <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>
              ₹ {Number(currentRun.summary?.itcAtRisk || 0).toLocaleString('en-IN')}
            </div>
            <div className="stat-delta down">Requires Vendor Action</div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="card" style={{ marginBottom: 16, background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong style={{ fontSize: 14 }}>Automated GSTR-2B vs Purchase Register Reconciliation (Section 3.3)</strong>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              4-way rule-based matching: Exact (100%), Approximate (tolerances), Mismatches, and Missing/Extra records.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="month"
              className="input"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              style={{ width: 140 }}
            />
            <button className="btn small" onClick={handleRunRecon} disabled={running}>
              {running ? 'Reconciling...' : '⚡ Run 4-Way Reconciliation'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Reconciliation Results Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Reconciliation Results {currentRun && `— ${currentRun.period}`}</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Click actions on rows to Accept, Hold, or dispatch automated vendor alerts
            </div>
          </div>
          <div className="pills">
            {['all', 'matched', 'approximate', 'mismatch', 'missing', 'extra'].map(f => (
              <span key={f} className={`pill${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading reconciliation runs...</div>
        ) : !currentRun ? (
          <div className="empty">No reconciliation runs found. Click "Run 4-Way Reconciliation" above.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Supplier / GSTIN</th>
                <th>Bill / Doc No</th>
                <th>Books Taxable</th>
                <th>2B Taxable</th>
                <th>Books GST</th>
                <th>2B GST</th>
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
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
                      {item.supplierGstin}
                    </div>
                  </td>
                  <td><strong>{item.invoiceNo}</strong></td>
                  <td>₹ {Number(item.taxable || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(item.docTaxable || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(item.gst || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(item.docGst || 0).toLocaleString('en-IN')}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>{actionBadge(item.action)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.action !== 'accepted' && (
                        <button
                          className="btn outline small"
                          style={{ fontSize: 10.5, padding: '2px 6px' }}
                          onClick={() => handleAction(item._id, 'accepted')}
                        >
                          Accept
                        </button>
                      )}
                      {item.action !== 'on_hold' && (
                        <button
                          className="btn outline small"
                          style={{ fontSize: 10.5, padding: '2px 6px', color: 'var(--amber)' }}
                          onClick={() => handleAction(item._id, 'on_hold')}
                        >
                          Hold
                        </button>
                      )}
                      {(item.status === 'missing' || item.status === 'mismatch') && (
                        <>
                          <button
                            className="btn small"
                            style={{ fontSize: 10.5, padding: '2px 6px', background: '#d97706' }}
                            onClick={() => handleNotifyVendor(item.supplierGstin)}
                            disabled={notifying}
                          >
                            ✉️ Alert Vendor
                          </button>
                          <button
                            className="btn small"
                            style={{ fontSize: 10.5, padding: '2px 6px', background: '#2563eb' }}
                            onClick={() => handleOpenNudge(item.supplierGstin)}
                            disabled={nudgeLoading}
                            title="Open WhatsApp & Multi-Channel Vendor Communication Center"
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
                <tr><td colSpan={9} className="empty">No records matching filter "{filter}"</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PRD Section 2.5: Automated Vendor Communication Loop ("Nudge" Center Modal) */}
      {nudgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Vendor Communication Center</h3>
                <p className="text-xs text-gray-500">
                  Automated discrepancy nudge for {nudgeModal.vendorName} ({nudgeModal.vendorGstin})
                </p>
              </div>
              <button
                onClick={() => setNudgeModal(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <span className="font-semibold">⚠️ Discrepancy Impact:</span> {nudgeModal.discrepancyCount} invoice(s)
              affecting <b>₹{Number(nudgeModal.totalTaxInvolved || 0).toLocaleString('en-IN')}</b> in blocked ITC.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Preview Message Payload:</label>
              <textarea
                readOnly
                rows={6}
                value={nudgeModal.textBody}
                className="w-full text-xs font-mono bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-gray-800"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">
                Direct statutory communication channels:
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={nudgeModal.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1"
                >
                  💬 Open WhatsApp
                </a>
                <a
                  href={nudgeModal.mailtoUrl}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1"
                >
                  📧 Dispatch Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
