import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function IMSWorkspace() {
  const [period, setPeriod] = useState('2026-09');
  const [filterState, setFilterState] = useState('all');
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Goods or services not received / Incorrect invoice details');
  const [targetRejectIds, setTargetRejectIds] = useState([]);

  const loadData = () => {
    setLoading(true);
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
        console.error('Failed to load IMS docs:', err);
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
      alert(res.message || `Invoices successfully marked as ${action}`);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update IMS state');
    } finally {
      setActing(false);
      setRejectModalOpen(false);
    }
  };

  const handleOpenReject = (ids) => {
    setTargetRejectIds(ids);
    setRejectModalOpen(true);
  };

  const handleSyncPortal = async () => {
    if (!window.confirm(`Push all ${period} IMS determinations to the GSTN Portal? This locks your GSTR-2B inward ITC register.`)) {
      return;
    }
    setSyncing(true);
    try {
      const res = await api.post('/ims/sync-portal', { period });
      setSyncResult(res.syncSummary);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to sync with GSTN portal');
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
      alert('Sample GSTR-2B / IMS Inward documents seeded successfully!');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to seed sample documents');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Native IMS Workspace</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              Rule 36(4) Compliant
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Invoice Management System for statutory inward supply review, bulk acceptance, rejection, and 14th-of-month GSTN sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white shadow-sm"
          />
          <button
            onClick={seedSampleDocs}
            title="Load sample inward 2B records for walkthrough / testing"
            className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
          >
            Load Demo Template
          </button>
          <button
            onClick={handleSyncPortal}
            disabled={syncing}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5"
          >
            {syncing ? 'Pushing to GSTN...' : '⚡ Push Decisions to GSTN'}
          </button>
        </div>
      </div>

      {/* Sync Banner if just synced */}
      {syncResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-start justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-800">✅ Official GSTN IMS Sync Complete</span>
              <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono">
                ACK: {syncResult.ackId}
              </span>
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              Synced {syncResult.totalPushed} documents for {syncResult.period}. Accepted ITC:{' '}
              <b>₹{syncResult.accepted.itcValue.toLocaleString('en-IN')}</b> ({syncResult.accepted.count} docs) | Rejected:{' '}
              <b>{syncResult.rejected.count}</b> docs | Pending: <b>{syncResult.pending.count}</b> docs.
            </p>
          </div>
          <button onClick={() => setSyncResult(null)} className="text-xs text-emerald-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Inward Docs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalCount}</p>
            <p className="text-xs text-gray-500 mt-1">
              Taxable: ₹{summary.totalTaxable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Accepted for ITC</p>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{summary.acceptedCount}</p>
            <p className="text-xs text-emerald-700 font-medium mt-1">
              ITC: ₹{summary.acceptedITC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Pending Decision</p>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            </div>
            <p className="text-2xl font-bold text-amber-900 mt-1">{summary.pendingCount}</p>
            <p className="text-xs text-amber-700 font-medium mt-1">
              ITC: ₹{summary.pendingITC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-rose-700 uppercase tracking-wider">Rejected</p>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            </div>
            <p className="text-2xl font-bold text-rose-900 mt-1">{summary.rejectedCount}</p>
            <p className="text-xs text-rose-700 font-medium mt-1">
              Blocked ITC: ₹{summary.rejectedITC.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* Filter and Bulk Action Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b md:border-b-0 pb-2 md:pb-0">
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'pending', label: 'Pending Action' },
              { id: 'accepted', label: 'Accepted' },
              { id: 'rejected', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterState(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterState === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search Invoice #, GSTIN, Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Selected Rows Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mt-2">
            <span className="text-xs font-semibold text-indigo-900">
              {selectedIds.length} invoice(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => performAction(selectedIds, 'accepted')}
                disabled={acting}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium shadow-sm"
              >
                ✓ Bulk Accept
              </button>
              <button
                onClick={() => performAction(selectedIds, 'pending')}
                disabled={acting}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium shadow-sm"
              >
                ⏸ Keep Pending
              </button>
              <button
                onClick={() => handleOpenReject(selectedIds)}
                disabled={acting}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium shadow-sm"
              >
                ✕ Bulk Reject
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={documents.length > 0 && selectedIds.length === documents.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                </th>
                <th className="px-4 py-3 text-left">Invoice No / Date</th>
                <th className="px-4 py-3 text-left">Supplier Info</th>
                <th className="px-4 py-3 text-left">Doc Type</th>
                <th className="px-4 py-3 text-right">Taxable Value</th>
                <th className="px-4 py-3 text-right">Tax (ITC)</th>
                <th className="px-4 py-3 text-center">IMS Status</th>
                <th className="px-4 py-3 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Loading inward supplier documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No inward supplier documents found for {period} ({filterState}). Inward GSTR-2B invoices will appear here upon portal sync or upload.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const itc = (doc.igst || 0) + (doc.cgst || 0) + (doc.sgst || 0) + (doc.cess || 0) || (doc.gst || 0);
                  const isSelected = selectedIds.includes(doc._id);

                  let badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                  let statusLabel = 'Pending';
                  if (doc.imsState === 'accepted') {
                    badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    statusLabel = 'Accepted';
                  } else if (doc.imsState === 'rejected') {
                    badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                    statusLabel = 'Rejected';
                  }

                  return (
                    <tr key={doc._id} className={isSelected ? 'bg-indigo-50/40' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(doc._id)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{doc.invoiceNo}</p>
                        <p className="text-gray-500">
                          {doc.docDate ? new Date(doc.docDate).toLocaleDateString('en-IN') : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{doc.supplierName || 'Unknown Vendor'}</p>
                        <p className="font-mono text-gray-500 text-[11px]">{doc.supplierGstin}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                          {doc.docType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{(doc.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-indigo-600">
                        ₹{itc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeColor}`}>
                          {statusLabel}
                        </span>
                        {doc.rejectedReason && (
                          <p className="text-[10px] text-rose-600 max-w-[150px] truncate mt-0.5" title={doc.rejectedReason}>
                            {doc.rejectedReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            title="Accept for GSTR-2B"
                            onClick={() => performAction([doc._id], 'accepted')}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 text-xs font-bold"
                          >
                            ✓
                          </button>
                          <button
                            title="Keep Pending"
                            onClick={() => performAction([doc._id], 'pending')}
                            className="p-1 rounded text-amber-600 hover:bg-amber-50 text-xs font-bold"
                          >
                            ⏸
                          </button>
                          <button
                            title="Reject"
                            onClick={() => handleOpenReject([doc._id])}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Reject Inward Invoice(s)</h3>
            <p className="text-xs text-gray-500">
              Provide a statutory rejection reason. This will be transmitted to the supplier via GSTN IMS.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-white"
              >
                <option value="Goods or services not received / Incorrect invoice details">
                  Goods or services not received / Incorrect invoice details
                </option>
                <option value="Incorrect recipient GSTIN / Wrong customer">
                  Incorrect recipient GSTIN / Wrong customer
                </option>
                <option value="Duplicate invoice entered by supplier">
                  Duplicate invoice entered by supplier
                </option>
                <option value="Mismatched tax rates or wrong HSN computation">
                  Mismatched tax rates or wrong HSN computation
                </option>
                <option value="Commercial dispute / Pending credit note">
                  Commercial dispute / Pending credit note
                </option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => performAction(targetRejectIds, 'rejected', rejectReason)}
                className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
