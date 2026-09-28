import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function CompanySettings() {
  const [company, setCompany] = useState(null);
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [activeTab, setActiveTab] = useState('branches'); // 'branches' | 'erp'

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

  const load = () => {
    Promise.all([api.getCompany(), api.getERPConnectors()])
      .then(([comp, conn]) => {
        setCompany(comp);
        setConnectors(conn.connectors || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await api.addGSTINBranch(branchForm);
      setShowAddBranch(false);
      setBranchForm({
        gstin: '', tradeName: '', legalName: '', stateCode: '', state: '',
        city: '', branch: '', invoiceSeries: 'INV', isPrimary: false,
      });
      load();
      alert('New GSTIN branch configured successfully!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetPrimary = async (branchId) => {
    try {
      await api.setPrimaryBranch(branchId);
      load();
      alert('Primary working branch updated!');
    } catch (err) {
      alert(err.message);
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
      alert(`Successfully imported ${res.count} purchase vouchers from ERP connector!`);
    } catch (err) {
      alert(err.message);
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
    } catch (err) {
      alert(err.message || 'Failed to export Tally XML');
    }
  };

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === 'branches' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('branches')}
        >
          🏢 Multi-GSTIN & Branch Master (Section 2.1)
        </button>
        <button
          className={`btn ${activeTab === 'erp' ? '' : 'outline'} small`}
          onClick={() => setActiveTab('erp')}
        >
          🔄 Two-Way ERP & Accounting Connectors (Section 3.2)
        </button>
      </div>

      {loading ? (
        <div className="card empty">Loading organizational master data...</div>
      ) : (
        <>
          {/* TAB 1: Multi-GSTIN & Branch Support */}
          {activeTab === 'branches' && company && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Multi-GSTIN Organizational Registry</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Manage distinct GSTINs across states under single PAN ({company.pan}). Supports branch-level returns & invoice series (Section 2.1).
                  </div>
                </div>
                <button className="btn small" onClick={() => setShowAddBranch(!showAddBranch)}>
                  {showAddBranch ? 'Close' : '+ Add State Branch GSTIN'}
                </button>
              </div>

              {showAddBranch && (
                <form onSubmit={handleAddBranch} style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <div>
                      <label className="input-label">Branch GSTIN (15 Digits)</label>
                      <input
                        className="input"
                        placeholder="e.g. 29AAACG1234F1Z1"
                        value={branchForm.gstin}
                        onChange={e => setBranchForm({ ...branchForm, gstin: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label">Trade / Branch Unit Name</label>
                      <input
                        className="input"
                        placeholder="e.g. Greenshine Traders (South Region Hub)"
                        value={branchForm.tradeName}
                        onChange={e => setBranchForm({ ...branchForm, tradeName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <div>
                      <label className="input-label">State Code (2 Digits)</label>
                      <input
                        className="input"
                        placeholder="e.g. 29"
                        value={branchForm.stateCode}
                        onChange={e => setBranchForm({ ...branchForm, stateCode: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label">State Name</label>
                      <input
                        className="input"
                        placeholder="e.g. Karnataka"
                        value={branchForm.state}
                        onChange={e => setBranchForm({ ...branchForm, state: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label">City</label>
                      <input
                        className="input"
                        placeholder="e.g. Bengaluru"
                        value={branchForm.city}
                        onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ marginBottom: 16 }}>
                    <div>
                      <label className="input-label">Invoice Series Prefix</label>
                      <input
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
                        Set as Primary Corporate Operating GSTIN
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn outline small" onClick={() => setShowAddBranch(false)}>Cancel</button>
                    <button type="submit" className="btn small">Register Branch GSTIN</button>
                  </div>
                </form>
              )}

              <table>
                <thead>
                  <tr>
                    <th>Branch / Hub</th>
                    <th>GSTIN</th>
                    <th>State</th>
                    <th>City</th>
                    <th>Invoice Series</th>
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
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{g.gstin}</span>
                      </td>
                      <td>{g.state} ({g.stateCode})</td>
                      <td>{g.city || '—'}</td>
                      <td><span className="badge blue" style={{ fontSize: 10.5 }}>{g.invoiceSeries}</span></td>
                      <td>
                        {g.isPrimary ? (
                          <span className="badge green">PRIMARY HO</span>
                        ) : (
                          <span className="badge gray">BRANCH</span>
                        )}
                      </td>
                      <td>
                        {!g.isPrimary && (
                          <button
                            className="btn outline small"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => handleSetPrimary(g._id)}
                          >
                            Set Primary
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Two-Way ERP Connectors (Section 3.2) */}
          {activeTab === 'erp' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Two-Way ERP & Accounting Connectors (Section 3.2)</h3>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Turnkey bidirectional sync for SAP S/4HANA, Tally Prime, Zoho Books, Busy, and custom REST Webhooks.
                  </div>
                </div>
                <button className="btn outline small" onClick={handleExportTally}>
                  📤 Export to Tally (XML)
                </button>
              </div>

              {/* Connector Grid */}
              <div className="grid-4" style={{ marginBottom: 20 }}>
                {connectors.map(c => (
                  <div key={c.id} style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>{c.name}</strong>
                      <span className={`badge ${c.status === 'Connected' ? 'green' : 'blue'}`} style={{ fontSize: 10 }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      Sync: {c.syncMode}<br />
                      Last Sync: {c.lastSync}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bulk Import Box */}
              <div style={{ background: '#f8fafc', padding: 18, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 13, color: 'var(--primary)', marginBottom: 6 }}>
                  Direct ERP Batch File Ingestion (CSV / JSON)
                </h4>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                  Paste purchase invoices exported from your internal ERP/accounting package. Fields are mapped automatically.
                </p>
                <textarea
                  className="input"
                  rows={5}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 11.5, marginBottom: 12 }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn small" onClick={handleImportCSV} disabled={importing}>
                    {importing ? 'Importing...' : '📥 Ingest ERP Purchases'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
