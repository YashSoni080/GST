import { useState, useEffect } from 'react';
import { api } from '../api/client';

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
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [channel, setChannel] = useState('amazon');
  const [period, setPeriod] = useState('2026-09');
  const [csvInput, setCsvInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [syncingGstr8, setSyncingGstr8] = useState(false);

  const load = () => {
    api.get('/ecommerce')
      .then(res => {
        const list = res.settlements || [];
        setSettlements(list);
        if (list.length > 0 && !selectedSettlement) {
          api.get(`/ecommerce/${list[0]._id}`).then(s => setSelectedSettlement(s)).catch(() => {});
        }
      })
      .catch(() => {})
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
      alert(res.message || 'E-Commerce settlement report ingested!');
      load();
      if (res.settlement?._id) {
        const full = await api.get(`/ecommerce/${res.settlement._id}`);
        setSelectedSettlement(full);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIngesting(false);
    }
  };

  const handleSelectSettlement = async (id) => {
    try {
      const full = await api.get(`/ecommerce/${id}`);
      setSelectedSettlement(full);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSyncGstr8 = async () => {
    if (!selectedSettlement) return;
    setSyncingGstr8(true);
    try {
      const res = await api.post(`/ecommerce/${selectedSettlement._id}/sync-gstr8`);
      alert(res.message || 'GSTR-8 TCS portal matching complete!');
      const updated = await api.get(`/ecommerce/${selectedSettlement._id}`);
      setSelectedSettlement(updated);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncingGstr8(false);
    }
  };

  return (
    <>
      {/* Top Banner / Ingestion Control */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <h3>Omnichannel E-Commerce Reconciler (PRD Section 2.4)</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Directly ingests multi-state transaction sheets from Amazon, Flipkart, Blinkit. Auto-splits normal sales, B2B orders, customer returns, and tracks Section 52 TCS credit under GSTR-8.
            </div>
          </div>
        </div>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <div>
            <label className="input-label">Marketplace Platform</label>
            <select className="input" value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="amazon">Amazon (Merchant Tax Report - MTR)</option>
              <option value="flipkart">Flipkart (Sales & Return Settlement)</option>
              <option value="meesho">Meesho Supplier Settlement</option>
              <option value="blinkit">Blinkit / Quick Commerce Hub</option>
              <option value="custom">Generic Multi-Channel CSV</option>
            </select>
          </div>
          <div>
            <label className="input-label">Settlement Period</label>
            <input
              type="month"
              className="input"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn small" onClick={handleIngest} disabled={ingesting} style={{ width: '100%', height: 38 }}>
              {ingesting ? 'Processing Settlement...' : '⚡ Ingest & Reconcile Report'}
            </button>
          </div>
        </div>

        <details open style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Input Settlement CSV Data (Paste or Load Template)</span>
            <button
              type="button"
              className="btn outline small"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={(e) => { e.preventDefault(); setCsvInput(SAMPLE_AMAZON_CSV); }}
            >
              Load Sample Template
            </button>
          </summary>
          <textarea
            className="input"
            rows={6}
            placeholder="Paste your Amazon MTR, Flipkart, Blinkit, or marketplace CSV report here..."
            style={{ fontFamily: 'monospace', fontSize: 11.5, marginTop: 8 }}
            value={csvInput}
            onChange={e => setCsvInput(e.target.value)}
          />
        </details>
      </div>

      {/* Selected Settlement Metrics */}
      {selectedSettlement && (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="stat-label">Gross Marketplace Sales</div>
              <div className="stat-value" style={{ fontSize: 20 }}>
                ₹ {Number(selectedSettlement.grossSales || 0).toLocaleString('en-IN')}
              </div>
              <div className="stat-delta">{selectedSettlement.totalOrders || 0} Total Orders Processed</div>
            </div>

            <div className="card">
              <div className="stat-label">Net Taxable Turnover</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--primary)' }}>
                ₹ {Number(selectedSettlement.netTaxableTurnover || 0).toLocaleString('en-IN')}
              </div>
              <div className="stat-delta">After Customer Returns Deduction</div>
            </div>

            <div className="card">
              <div className="stat-label">TCS Deducted (1% Sec 52)</div>
              <div className="stat-value" style={{ fontSize: 20, color: '#d97706' }}>
                ₹ {Number(selectedSettlement.tcsCollected?.total || 0).toLocaleString('en-IN')}
              </div>
              <div className="stat-delta">IGST: ₹{selectedSettlement.tcsCollected?.igst || 0} | CGST+SGST: ₹{(selectedSettlement.tcsCollected?.cgst || 0) * 2}</div>
            </div>

            <div className="card">
              <div className="stat-label">GSTR-8 Portal Reconciliation</div>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--teal)' }}>
                {selectedSettlement.gstr8Reconciliation?.status === 'matched' ? '✓ Matched' : 'Variance'}
              </div>
              <div className="stat-delta up">
                Credit: ₹{Number(selectedSettlement.gstr8Reconciliation?.gstr8ReportedTcs || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Breakdown & GSTR-8 Action Bar */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h4 style={{ margin: 0 }}>Omnichannel Sales & Return Split</h4>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Report: <strong>{selectedSettlement.reportName}</strong> | Platform: <strong>{selectedSettlement.channel?.toUpperCase()}</strong>
                </div>
              </div>
              <button
                className="btn outline small"
                onClick={handleSyncGstr8}
                disabled={syncingGstr8}
              >
                {syncingGstr8 ? 'Matching Portal...' : '🔄 Reconcile with GSTR-8 (TCS Credit)'}
              </button>
            </div>

            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>B2C Consumer Orders (Table 7)</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                  {selectedSettlement.b2cSales?.count || 0} Orders
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Taxable: ₹{Number(selectedSettlement.b2cSales?.taxable || 0).toLocaleString('en-IN')} | Tax: ₹{Number(selectedSettlement.b2cSales?.tax || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>B2B Enterprise Orders (Table 4)</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--primary)' }}>
                  {selectedSettlement.b2bSales?.count || 0} Invoices
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Taxable: ₹{Number(selectedSettlement.b2bSales?.taxable || 0).toLocaleString('en-IN')} | Tax: ₹{Number(selectedSettlement.b2bSales?.tax || 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#fef2f2', padding: 14, borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 11, color: '#b91c1c', textTransform: 'uppercase' }}>Customer Returns & Cancellations</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--red)' }}>
                  {selectedSettlement.returns?.count || 0} Returns
                </div>
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                  Reversal Taxable: -₹{Number(selectedSettlement.returns?.taxable || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* State-wise POS Distribution */}
            {selectedSettlement.stateWiseDistribution?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>State-wise Place of Supply (POS) Distribution</h4>
                <table>
                  <thead>
                    <tr>
                      <th>State Code</th>
                      <th>State Name</th>
                      <th>Net Taxable</th>
                      <th>IGST</th>
                      <th>CGST + SGST</th>
                      <th>TCS (1%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSettlement.stateWiseDistribution.map((s, idx) => (
                      <tr key={idx}>
                        <td><strong>{s.stateCode}</strong></td>
                        <td>{s.stateName}</td>
                        <td>₹ {Number(s.taxable || 0).toLocaleString('en-IN')}</td>
                        <td>₹ {Number(s.igst || 0).toLocaleString('en-IN')}</td>
                        <td>₹ {Number((s.cgst || 0) + (s.sgst || 0)).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#d97706', fontWeight: 600 }}>₹ {Number(s.tcs || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Line Items Table */}
            {selectedSettlement.lineItems?.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Transaction Line Items ({selectedSettlement.lineItems.length})</h4>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Type</th>
                        <th>State (POS)</th>
                        <th>Item Description</th>
                        <th>Taxable</th>
                        <th>GST</th>
                        <th>TCS (1%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSettlement.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{item.orderId}</strong>
                            {item.customerGstin && (
                              <div style={{ fontSize: 10.5, color: 'var(--primary)', fontFamily: 'monospace' }}>
                                B2B: {item.customerGstin}
                              </div>
                            )}
                          </td>
                          <td>
                            {item.isReturn ? (
                              <span className="badge red" style={{ fontSize: 10 }}>RETURN</span>
                            ) : item.supplyType === 'B2B' ? (
                              <span className="badge blue" style={{ fontSize: 10 }}>B2B</span>
                            ) : (
                              <span className="badge gray" style={{ fontSize: 10 }}>B2C</span>
                            )}
                          </td>
                          <td>{item.state} ({item.posStateCode})</td>
                          <td>{item.itemDescription}</td>
                          <td>₹ {Number(item.taxable || 0).toLocaleString('en-IN')}</td>
                          <td>₹ {Number((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)).toLocaleString('en-IN')}</td>
                          <td style={{ color: '#d97706' }}>₹ {Number(item.tcsAmount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* History of Ingested Settlements */}
      {settlements.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Settlement Reports History</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Platform</th>
                <th>Period</th>
                <th>Orders</th>
                <th>Gross Turnover</th>
                <th>TCS Collected</th>
                <th>GSTR-8 Status</th>
                <th>Ingested On</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr
                  key={s._id}
                  onClick={() => handleSelectSettlement(s._id)}
                  style={{ cursor: 'pointer', background: selectedSettlement?._id === s._id ? '#f1f5f9' : 'inherit' }}
                >
                  <td><strong>{s.reportName}</strong></td>
                  <td><span className="badge blue">{s.channel?.toUpperCase()}</span></td>
                  <td>{s.settlementPeriod}</td>
                  <td>{s.totalOrders}</td>
                  <td>₹ {Number(s.grossSales || 0).toLocaleString('en-IN')}</td>
                  <td style={{ color: '#d97706', fontWeight: 600 }}>₹ {Number(s.tcsCollected?.total || 0).toLocaleString('en-IN')}</td>
                  <td><span className="badge green">{s.gstr8Reconciliation?.status?.toUpperCase() || 'MATCHED'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
