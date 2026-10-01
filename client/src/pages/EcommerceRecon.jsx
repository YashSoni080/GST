import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard, SkeletonCard, SkeletonTable, EmptyState, ErrorState } from '../components/ui';
import { useToast } from '../components/Toast';

const SAMPLE_AMAZON_CSV = `Order ID,Date,State,Customer GSTIN,Item Description,Taxable,Tax,Type
ORD-AMZ-901,2026-09-02,27 Maharashtra,,Wireless Bluetooth Headphones,2500,450,Sale
ORD-AMZ-902,2026-09-04,29 Karnataka,29AABCE1234F1Z1,Office Ergonomic Chair,8000,1440,Sale
ORD-AMZ-903,2026-09-07,07 Delhi,,USB-C Fast Charging Hub,1200,216,Sale
ORD-AMZ-904,2026-09-09,27 Maharashtra,,Smart Fitness Tracker,3500,630,Return
ORD-AMZ-905,2026-09-12,24 Gujarat,,Mechanical Gaming Keyboard,4500,810,Sale
ORD-AMZ-906,2026-09-14,33 Tamil Nadu,33AABCD5678G1Z8,Enterprise Server Rack PDU,15000,2700,Sale
ORD-AMZ-907,2026-09-18,27 Maharashtra,,Wireless Optical Mouse,800,144,Sale
ORD-AMZ-908,2026-09-21,06 Haryana,,Noise Cancelling Earbuds,3000,540,Sale`;

export default function EcommerceRecon() {
  const toast = useToast();
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [channel, setChannel] = useState('amazon');
  const [period, setPeriod] = useState('2026-09');
  const [csvInput, setCsvInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ingesting, setIngesting] = useState(false);
  const [syncingGstr8, setSyncingGstr8] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/ecommerce')
      .then(res => {
        const list = res.settlements || [];
        setSettlements(list);
        if (list.length > 0 && !selectedSettlement) {
          api.get(`/ecommerce/${list[0]._id}`)
            .then(s => setSelectedSettlement(s))
            .catch(err => toast.error('Could not open the settlement report', err.message));
        }
      })
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const res = await api.post('/ecommerce/ingest', {
        csvText: csvInput,
        channel,
        period,
        reportName: `${channel.toUpperCase()} Settlement MTR (${period})`,
      });
      toast.success(res.message || 'E-Commerce settlement report ingested!', `${channel.toUpperCase()} · ${period} reconciled against marketplace TCS.`);
      load();
      if (res.settlement?._id) {
        const full = await api.get(`/ecommerce/${res.settlement._id}`);
        setSelectedSettlement(full);
      }
    } catch (err) {
      toast.error('Settlement ingest failed', err.message);
    } finally {
      setIngesting(false);
    }
  };

  const handleSelectSettlement = async (id) => {
    try {
      const full = await api.get(`/ecommerce/${id}`);
      setSelectedSettlement(full);
    } catch (err) {
      toast.error('Could not open the settlement report', err.message);
    }
  };

  const handleSyncGstr8 = async () => {
    if (!selectedSettlement) return;
    setSyncingGstr8(true);
    try {
      const res = await api.post(`/ecommerce/${selectedSettlement._id}/sync-gstr8`);
      toast.success(res.message || 'GSTR-8 TCS portal matching complete!', 'Section 52 TCS credit reconciled against the portal statement.');
      const updated = await api.get(`/ecommerce/${selectedSettlement._id}`);
      setSelectedSettlement(updated);
      load();
    } catch (err) {
      toast.error('GSTR-8 reconciliation failed', err.message);
    } finally {
      setSyncingGstr8(false);
    }
  };

  const loadSampleTemplate = () => {
    setCsvInput(SAMPLE_AMAZON_CSV);
    toast.info('Sample Amazon MTR loaded', 'Paste-ready CSV is in the input box — hit Ingest & Reconcile to try the flow.');
  };

  return (
    <>
      {/* Top Banner / Ingestion Control */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Omnichannel E-Commerce Reconciler (PRD Section 2.4)</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Directly ingests multi-state transaction sheets from Amazon, Flipkart, Blinkit. Auto-splits normal sales, B2B orders, customer returns, and tracks Section 52 TCS credit under GSTR-8.
              </div>
            </div>
          </div>
          <span className="badge blue">Section 52 · GSTR-8</span>
        </div>

        <div className="form-row-3" style={{ marginBottom: 12 }}>
          <div>
            <label className="input-label" htmlFor="ec-channel">Marketplace platform</label>
            <select id="ec-channel" className="input" value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="amazon">Amazon (Merchant Tax Report - MTR)</option>
              <option value="flipkart">Flipkart (Sales & Return Settlement)</option>
              <option value="meesho">Meesho Supplier Settlement</option>
              <option value="blinkit">Blinkit / Quick Commerce Hub</option>
              <option value="custom">Generic Multi-Channel CSV</option>
            </select>
          </div>
          <div>
            <label className="input-label" htmlFor="ec-period">Settlement period</label>
            <input
              id="ec-period"
              type="month"
              className="input"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn block"
              onClick={handleIngest}
              disabled={ingesting}
              style={{ height: 38 }}
            >
              {ingesting ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  Processing settlement…
                </>
              ) : (
                '⚡ Ingest & Reconcile Report'
              )}
            </button>
          </div>
        </div>

        <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: 'var(--muted)', minHeight: 16, marginBottom: 8 }}>
          {ingesting
            ? `Parsing and reconciling the ${channel.toUpperCase()} settlement for ${period}…`
            : syncingGstr8
              ? 'Matching TCS credit against the GSTR-8 portal statement…'
              : ''}
        </div>

        <details open style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}>
            Input Settlement CSV Data (Paste or Load Template)
          </summary>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              className="btn outline small"
              onClick={loadSampleTemplate}
            >
              Load Sample Template
            </button>
          </div>
          <label className="input-label" htmlFor="ec-csv" style={{ marginTop: 8 }}>
            Settlement CSV
          </label>
          <textarea
            id="ec-csv"
            className="input mono"
            rows={6}
            placeholder="Paste your Amazon MTR, Flipkart, Blinkit, or marketplace CSV report here..."
            value={csvInput}
            onChange={e => setCsvInput(e.target.value)}
          />
        </details>
      </div>

      {/* Selected Settlement Metrics */}
      {loading && !selectedSettlement ? (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
      ) : selectedSettlement ? (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <StatCard
              label="Gross Marketplace Sales"
              icon="🛍️"
              value={`₹ ${Number(selectedSettlement.grossSales || 0).toLocaleString('en-IN')}`}
              delta={`${selectedSettlement.totalOrders || 0} Total Orders Processed`}
            />
            <StatCard
              label="Net Taxable Turnover"
              icon="📊"
              accent="primary"
              value={`₹ ${Number(selectedSettlement.netTaxableTurnover || 0).toLocaleString('en-IN')}`}
              delta="After Customer Returns Deduction"
            />
            <StatCard
              label="TCS Deducted (1% Sec 52)"
              icon="🏛️"
              accent="amber"
              value={`₹ ${Number(selectedSettlement.tcsCollected?.total || 0).toLocaleString('en-IN')}`}
              delta={`IGST: ₹${selectedSettlement.tcsCollected?.igst || 0} | CGST+SGST: ₹${(selectedSettlement.tcsCollected?.cgst || 0) * 2}`}
            />
            <StatCard
              label="GSTR-8 Portal Reconciliation"
              icon="🧾"
              accent="teal"
              value={selectedSettlement.gstr8Reconciliation?.status === 'matched' ? '✓ Matched' : 'Variance'}
              delta={`Credit: ₹${Number(selectedSettlement.gstr8Reconciliation?.gstr8ReportedTcs || 0).toLocaleString('en-IN')}`}
              deltaClass={selectedSettlement.gstr8Reconciliation?.status === 'matched' ? 'up' : 'amber-text'}
            />
          </div>

          {/* Breakdown & GSTR-8 Action Bar */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title-row">
                <span className="dot" />
                <div>
                  <h4 style={{ margin: 0 }}>Omnichannel Sales & Return Split</h4>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    Report: <strong>{selectedSettlement.reportName}</strong> | Platform:{' '}
                    <strong>{selectedSettlement.channel?.toUpperCase()}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn outline small"
                onClick={handleSyncGstr8}
                disabled={syncingGstr8}
              >
                {syncingGstr8 ? (
                  <>
                    <span className="spinner sm" aria-hidden="true" />
                    Matching portal…
                  </>
                ) : (
                  '🔄 Reconcile with GSTR-8 (TCS Credit)'
                )}
              </button>
            </div>

            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="section-label">B2C Consumer Orders (Table 7)</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {selectedSettlement.b2cSales?.count || 0} Orders
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Taxable: ₹{Number(selectedSettlement.b2cSales?.taxable || 0).toLocaleString('en-IN')} | Tax:{' '}
                  ₹{Number(selectedSettlement.b2cSales?.tax || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="card">
                <div className="section-label">B2B Enterprise Orders (Table 4)</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                  {selectedSettlement.b2bSales?.count || 0} Invoices
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Taxable: ₹{Number(selectedSettlement.b2bSales?.taxable || 0).toLocaleString('en-IN')} | Tax:{' '}
                  ₹{Number(selectedSettlement.b2bSales?.tax || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="card" style={{ borderColor: '#fecaca' }}>
                <div className="section-label" style={{ color: '#b91c1c' }}>
                  Customer Returns & Cancellations
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>
                  {selectedSettlement.returns?.count || 0} Returns
                </div>
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                  Reversal Taxable: -₹{Number(selectedSettlement.returns?.taxable || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* State-wise POS Distribution */}
            {selectedSettlement.stateWiseDistribution?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-label">State-wise Place of Supply (POS) Distribution</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>State Code</th>
                        <th>State Name</th>
                        <th className="num">Net Taxable</th>
                        <th className="num">IGST</th>
                        <th className="num">CGST + SGST</th>
                        <th className="num">TCS (1%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSettlement.stateWiseDistribution.map((s, idx) => (
                        <tr key={idx}>
                          <td><strong className="mono">{s.stateCode}</strong></td>
                          <td>{s.stateName}</td>
                          <td className="num">₹ {Number(s.taxable || 0).toLocaleString('en-IN')}</td>
                          <td className="num">₹ {Number(s.igst || 0).toLocaleString('en-IN')}</td>
                          <td className="num">₹ {Number((s.cgst || 0) + (s.sgst || 0)).toLocaleString('en-IN')}</td>
                          <td className="num" style={{ color: '#d97706', fontWeight: 600 }}>
                            ₹ {Number(s.tcs || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-meta">
                  <span>{selectedSettlement.stateWiseDistribution.length} state(s) with place of supply</span>
                </div>
              </div>
            )}

            {/* Line Items Table */}
            {selectedSettlement.lineItems?.length > 0 && (
              <div>
                <div className="section-label">Transaction Line Items ({selectedSettlement.lineItems.length})</div>
                <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Type</th>
                        <th>State (POS)</th>
                        <th>Item Description</th>
                        <th className="num">Taxable</th>
                        <th className="num">GST</th>
                        <th className="num">TCS (1%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSettlement.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong className="mono">{item.orderId}</strong>
                            {item.customerGstin && (
                              <div className="mono" style={{ fontSize: 10.5, color: 'var(--primary)' }}>
                                B2B: {item.customerGstin}
                              </div>
                            )}
                          </td>
                          <td>
                            {item.isReturn ? (
                              <span className="badge red">RETURN</span>
                            ) : item.supplyType === 'B2B' ? (
                              <span className="badge blue">B2B</span>
                            ) : (
                              <span className="badge gray">B2C</span>
                            )}
                          </td>
                          <td>{item.state} ({item.posStateCode})</td>
                          <td>{item.itemDescription}</td>
                          <td className="num">₹ {Number(item.taxable || 0).toLocaleString('en-IN')}</td>
                          <td className="num">₹ {Number((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)).toLocaleString('en-IN')}</td>
                          <td className="num" style={{ color: '#d97706' }}>
                            ₹ {Number(item.tcsAmount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-meta">
                  <span>{selectedSettlement.lineItems.length} order line(s) parsed from {selectedSettlement.channel?.toUpperCase()}</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* History of Ingested Settlements */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <h3>Settlement Reports History</h3>
          </div>
          {settlements.length > 0 && !loading && !error ? (
            <span className="badge gray">{settlements.length} reports</span>
          ) : null}
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={load} title="Could not load settlement reports" />
        ) : settlements.length === 0 ? (
          <EmptyState
            icon="🛒"
            title="No marketplace settlements ingested yet"
            description="Paste an Amazon MTR, Flipkart or Blinkit settlement CSV above to split B2C sales (GSTR-8 Table 7), B2B invoices (Table 4) and customer returns — then match the 1% Section 52 TCS credit against your GSTR-8 statement."
            action={{ label: 'Load Sample Template', onClick: loadSampleTemplate }}
            secondaryAction={{ label: 'Open GSTR filings', to: '/returns' }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Report Name</th>
                    <th>Platform</th>
                    <th>Period</th>
                    <th className="num">Orders</th>
                    <th className="num">Gross Turnover</th>
                    <th className="num">TCS Collected</th>
                    <th>GSTR-8 Status</th>
                    <th>Ingested On</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr
                      key={s._id}
                      onClick={() => handleSelectSettlement(s._id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectSettlement(s._id);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Open settlement report ${s.reportName}`}
                      style={{ cursor: 'pointer', background: selectedSettlement?._id === s._id ? '#f1f5f9' : 'inherit' }}
                    >
                      <td><strong>{s.reportName}</strong></td>
                      <td><span className="badge blue">{s.channel?.toUpperCase()}</span></td>
                      <td className="mono">{s.settlementPeriod}</td>
                      <td className="num">{s.totalOrders}</td>
                      <td className="num">₹ {Number(s.grossSales || 0).toLocaleString('en-IN')}</td>
                      <td className="num" style={{ color: '#d97706', fontWeight: 600 }}>
                        ₹ {Number(s.tcsCollected?.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge ${s.gstr8Reconciliation?.status === 'matched' ? 'green' : 'amber'}`}>
                          {s.gstr8Reconciliation?.status?.toUpperCase() || 'MATCHED'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>{settlements.length} settlement report(s) · click a row to inspect it</span>
              <span>Platform TCS reconciled under Section 52</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
