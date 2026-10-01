import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { SkeletonCard, SkeletonTable, ErrorState, EmptyState } from '../components/ui';
import { useToast } from '../components/Toast';

export default function CompanySettings() {
  const [company, setCompany] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [activeTab, setActiveTab] = useState('branches'); // 'branches' | 'erp'
  const [settingPrimary, setSettingPrimary] = useState(null);

  const [branchForm, setBranchForm] = useState({
    gstin: '',
    tradeName: '',
    legalName: '',
    stateCode: '',
    state: '',
    city: '',
    branch: '',
    invoiceSeries: 'INV',
    isPrimary: false,
  });

  const [csvText, setCsvText] = useState(
`billNo,billDate,vendorName,vendorGstin,taxableValue,cgst,sgst,igst,itcEligible
BILL-2026-901,2026-09-18,Precision Components Ltd,27AABCP1122D1Z4,150000,13500,13500,0,yes
BILL-2026-902,2026-09-19,Karnataka Power Systems,29AABCK3344E1Z1,220000,0,0,39600,yes`
  );
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    Promise.all([api.getCompany(), api.getERPConnectors()])
      .then(([comp, conn]) => {
        setCompany(comp);
        setConnectors(conn.connectors || []);
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await api.addGSTINBranch(branchForm);
      setShowAddBranch(false);
      setBranchForm({
        gstin: '', tradeName: '', legalName: '', stateCode: '', state: '',
        city: '', branch: '', invoiceSeries: 'INV', isPrimary: false,
      });
      load(true);
      toast.success('GSTIN branch registered', `${branchForm.tradeName || branchForm.gstin} added to the multi-GSTIN master.`);
    } catch (err) {
      toast.error(err);
    }
  };

  const handleSetPrimary = async (branchId) => {
    setSettingPrimary(branchId);
    try {
      await api.setPrimaryBranch(branchId);
      load(true);
      toast.success('Primary branch updated', 'The corporate operating GSTIN is now the default for returns & invoices.');
    } catch (err) {
      toast.error(err);
    } finally {
      setSettingPrimary(null);
    }
  };

  const handleImportCSV = async () => {
    setImporting(true);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length <= 1) throw new Error('No data rows found in CSV');
      const headers = lines[0].split(',').map(h => h.trim());

      const records = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i]; });
        return row;
      });

      const res = await api.importERPPurchases(records, 'CSV / ERP Sync');
      toast.success('ERP purchases imported', `${res.count} purchase vouchers ingested from the CSV connector.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleExportTally = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/erp/export/tally-xml', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tally_Sales_${new Date().toISOString().slice(0, 10)}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Tally XML exported', `${a.download} downloaded — import it directly into Tally Prime.`);
    } catch (err) {
      toast.error(err);
    }
  };

  const tabs = [
    { id: 'branches', label: '🏢 Multi-GSTIN & branch master (Section 2.1)' },
    { id: 'erp', label: '🔄 Two-way ERP & accounting connectors (Section 3.2)' },
  ];

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading organizational master data…</span>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <SkeletonCard height={38} />
          <SkeletonCard height={30} />
        </div>
        <div className="grid-4">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={92} />)}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <SkeletonTable rows={5} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => load()} title="Could not load organizational master data" />;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="seg" role="tablist" aria-label="Company configuration sections">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`settings-panel-${t.id}`}
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'branches' ? (
          <button
            type="button"
            className="btn small"
            onClick={() => setShowAddBranch(v => !v)}
            aria-expanded={showAddBranch}
          >
            {showAddBranch ? 'Close form' : '+ Add state branch GSTIN'}
          </button>
        ) : (
          <button type="button" className="btn outline small" onClick={handleExportTally}>
            📤 Export to Tally (XML)
          </button>
        )}
      </div>

      {activeTab === 'branches' && (
        <div className="card" id="settings-panel-branches" role="tabpanel" aria-labelledby="settings-tab-branches">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Multi-GSTIN organizational registry</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Distinct GSTINs across states under a single PAN ({company?.pan || '—'}) with branch-level returns and invoice series (Section 2.1).
                </div>
              </div>
            </div>
            {company?.gstins?.length > 0 && <span className="badge blue">{company.gstins.length} GSTINs</span>}
          </div>

          {showAddBranch && (
            <form
              onSubmit={handleAddBranch}
              style={{ marginBottom: 20, padding: 16, background: 'var(--card-soft)', borderRadius: 10, border: '1px solid var(--border)' }}
            >
              <div className="section-label">Register a state branch</div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div>
                  <label className="input-label" htmlFor="branch-gstin">Branch GSTIN (15 digits)</label>
                  <input
                    id="branch-gstin"
                    className="input mono"
                    placeholder="e.g. 29AAACG1234F1Z1"
                    value={branchForm.gstin}
                    onChange={e => setBranchForm({ ...branchForm, gstin: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="branch-trade">Trade / branch unit name</label>
                  <input
                    id="branch-trade"
                    className="input"
                    placeholder="e.g. Greenshine Traders (South Region Hub)"
                    value={branchForm.tradeName}
                    onChange={e => setBranchForm({ ...branchForm, tradeName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row-3" style={{ marginBottom: 12 }}>
                <div>
                  <label className="input-label" htmlFor="branch-state-code">State code (2 digits)</label>
                  <input
                    id="branch-state-code"
                    className="input"
                    placeholder="e.g. 29"
                    value={branchForm.stateCode}
                    onChange={e => setBranchForm({ ...branchForm, stateCode: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="branch-state">State name</label>
                  <input
                    id="branch-state"
                    className="input"
                    placeholder="e.g. Karnataka"
                    value={branchForm.state}
                    onChange={e => setBranchForm({ ...branchForm, state: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="branch-city">City</label>
                  <input
                    id="branch-city"
                    className="input"
                    placeholder="e.g. Bengaluru"
                    value={branchForm.city}
                    onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 16 }}>
                <div>
                  <label className="input-label" htmlFor="branch-series">Invoice series prefix</label>
                  <input
                    id="branch-series"
                    className="input"
                    value={branchForm.invoiceSeries}
                    onChange={e => setBranchForm({ ...branchForm, invoiceSeries: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={branchForm.isPrimary}
                    onChange={e => setBranchForm({ ...branchForm, isPrimary: e.target.checked })}
                  />
                  <label htmlFor="isPrimary" style={{ fontSize: 13, cursor: 'pointer' }}>
                    Set as primary corporate operating GSTIN
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn outline small" onClick={() => setShowAddBranch(false)}>Cancel</button>
                <button type="submit" className="btn small">Register branch GSTIN</button>
              </div>
            </form>
          )}

          {!company ? (
            <EmptyState
              icon="🏢"
              title="Company profile not found"
              description="The organizational master could not be read. Reload the workspace before registering a state branch GSTIN."
              action={{ label: '↻ Reload profile', onClick: () => load() }}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Branch / hub</th>
                      <th>GSTIN</th>
                      <th>State</th>
                      <th>City</th>
                      <th>Invoice series</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(company.gstins || []).map(g => (
                      <tr key={g._id}>
                        <td>
                          <strong>{g.tradeName}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{g.branch}</div>
                        </td>
                        <td><span className="mono" style={{ fontWeight: 700 }}>{g.gstin}</span></td>
                        <td>{g.state} ({g.stateCode})</td>
                        <td>{g.city || '—'}</td>
                        <td><span className="badge blue">{g.invoiceSeries}</span></td>
                        <td>
                          {g.isPrimary ? (
                            <span className="badge green">Primary HO</span>
                          ) : (
                            <span className="badge gray">Branch</span>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {!g.isPrimary && (
                              <button
                                type="button"
                                className="btn outline tiny"
                                onClick={() => handleSetPrimary(g._id)}
                                disabled={settingPrimary === g._id}
                              >
                                {settingPrimary === g._id ? 'Setting…' : 'Set primary'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(company.gstins || []).length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, border: 'none' }}>
                          <EmptyState
                            icon="🏢"
                            title="No state branches registered"
                            description="A single-PAN company can hold one GSTIN per state. Add your first out-of-state branch so place-of-supply, invoice series and branch-wise GSTR-1 filings are computed correctly (Section 2.1)."
                            action={{ label: '+ Add a state branch GSTIN', onClick: () => setShowAddBranch(true) }}
                            secondaryAction={{ label: 'Record invoices', to: '/invoices' }}
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(company.gstins || []).length > 0 && (
                <div className="table-meta">
                  <span>{company.gstins.length} GSTINs on master · PAN {company.pan}</span>
                  <span>{company.gstins.filter(g => g.isPrimary).length} primary operating office</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'erp' && (
        <div className="card" id="settings-panel-erp" role="tabpanel" aria-labelledby="settings-tab-erp">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <div>
                <h3>Two-way ERP &amp; accounting connectors (Section 3.2)</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Bidirectional sync for SAP S/4HANA, Tally Prime, Zoho Books, Busy and custom REST webhooks.
                </div>
              </div>
            </div>
            <span className={`badge ${connectors.length ? 'green' : 'gray'}`}>{connectors.length} connectors</span>
          </div>

          <div className="section-label">Available connectors</div>
          {connectors.length === 0 ? (
            <EmptyState
              icon="🔄"
              title="No connectors configured"
              description="Link an accounting package to push invoices out and pull purchase vouchers in. Until then you can still bulk-ingest purchase bills below (Section 3.2)."
            />
          ) : (
            <div className="grid-4" style={{ marginBottom: 20 }}>
              {connectors.map(c => (
                <div key={c.id} className="rounded-[10px] border border-gray-200 bg-white p-3.5">
                  <div className="flex justify-between items-center gap-2">
                    <strong style={{ fontSize: 13 }}>{c.name}</strong>
                    <span className={`badge ${c.status === 'Connected' ? 'green' : 'blue'}`}>{c.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1.5">
                    Sync: {c.syncMode}<br />
                    Last sync: {c.lastSync}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-label">Direct ERP batch file ingestion (CSV / JSON)</div>
          <div style={{ background: 'var(--card-soft)', padding: 18, borderRadius: 10, border: '1px solid var(--border)' }}>
            <p className="form-hint" style={{ marginBottom: 12 }}>
              Paste purchase invoices exported from your internal ERP or accounting package — fields are mapped automatically to the purchase register.
            </p>
            <label className="input-label" htmlFor="erp-csv">Purchase vouchers (CSV)</label>
            <textarea
              id="erp-csv"
              className="input"
              rows={5}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, marginBottom: 12 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn small" onClick={handleImportCSV} disabled={importing}>
                {importing ? (
                  <><span className="spinner sm" aria-hidden="true" /> Importing…</>
                ) : (
                  '📥 Ingest ERP purchases'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
