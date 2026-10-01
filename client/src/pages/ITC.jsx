import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard, SkeletonCard, SkeletonTable, EmptyState, ErrorState } from '../components/ui';

export default function ITC() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.getITC()
      .then(data => setEntries(data.entries || data || []))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = (entries || []).reduce((acc, e) => {
    if (e.type === 'availed') {
      acc.availed += Number(e.cgst || 0) + Number(e.sgst || 0) + Number(e.igst || 0);
    } else if (e.type === 'utilized') {
      acc.utilized += Number(e.cgst || 0) + Number(e.sgst || 0) + Number(e.igst || 0);
    }
    acc.cgst += Number(e.cgst || 0);
    acc.sgst += Number(e.sgst || 0);
    acc.igst += Number(e.igst || 0);
    return acc;
  }, { availed: 0, utilized: 0, cgst: 0, sgst: 0, igst: 0 });

  const typeBadge = (type) => {
    const map = { availed: 'green', utilized: 'blue', refund: 'amber', expired: 'red', reversed: 'red' };
    return <span className={`badge ${map[type] || 'gray'}`}>{type}</span>;
  };

  if (loading) {
    return (
      <div>
        <div role="status" aria-live="polite" className="sr-only">
          Loading ITC ledger…
        </div>
        <div className="grid-4">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={118} />)}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <SkeletonTable rows={6} cols={6} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={load} title="Could not load the ITC ledger" />;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="section-label">
            Input Tax Credit Ledger · Section 16
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Every credit availed, utilised and reversed — the movement behind your GSTR-3B Table 4 and 6.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/itc-optimizer" className="btn outline small">
            ⚡ ITC Optimizer
          </Link>
          <Link to="/recon" className="btn small">
            ⚖️ Run 2B Reconciliation
          </Link>
        </div>
      </div>

      <div className="grid-4">
        <StatCard
          label="Total ITC Availed"
          icon="♻️"
          accent="teal"
          value={`₹ ${summary.availed.toLocaleString('en-IN')}`}
          delta="Sec 16(2) credit claimed"
          deltaClass="up"
        />
        <StatCard
          label="Total Utilized"
          icon="🏛️"
          accent="primary"
          value={`₹ ${summary.utilized.toLocaleString('en-IN')}`}
          delta="Set-off against output liability"
        />
        <StatCard
          label="CGST Credit"
          icon="🔷"
          value={`₹ ${summary.cgst.toLocaleString('en-IN')}`}
          delta="Central component"
        />
        <StatCard
          label="SGST Credit"
          icon="🔶"
          value={`₹ ${summary.sgst.toLocaleString('en-IN')}`}
          delta="State component"
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>ITC Entries</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Availed, utilised, reversed and refunded credit lines for this financial year
              </div>
            </div>
          </div>
          {!loading && entries.length > 0 ? <span className="badge gray">{entries.length} entries</span> : null}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon="♻️"
            title="No ITC entries yet"
            description="This ledger compiles input tax credit as it is availed from your GSTR-2B matches and utilised against output liability in GSTR-3B. Run a reconciliation to start matching supplier invoices into credit."
            action={{ label: '⚡ Run 4-Way Reconciliation', to: '/recon' }}
            secondaryAction={{ label: 'Optimize credit set-off', to: '/itc-optimizer' }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Type</th>
                    <th className="num">CGST</th>
                    <th className="num">SGST</th>
                    <th className="num">IGST</th>
                    <th className="num">Total</th>
                    <th>Reference</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e._id}>
                      <td className="mono">{e.period}</td>
                      <td>{typeBadge(e.type)}</td>
                      <td className="num">₹ {Number(e.cgst || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(e.sgst || 0).toLocaleString('en-IN')}</td>
                      <td className="num">₹ {Number(e.igst || 0).toLocaleString('en-IN')}</td>
                      <td className="num">
                        <strong>
                          ₹ {(Number(e.cgst || 0) + Number(e.sgst || 0) + Number(e.igst || 0)).toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td className="mono">{e.ref || '—'}</td>
                      <td>{e.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                {entries.length} credit entr{entries.length === 1 ? 'y' : 'ies'} · IGST component ₹{' '}
                {summary.igst.toLocaleString('en-IN')}
              </span>
              <span>
                Availed ₹ {summary.availed.toLocaleString('en-IN')} · Utilised ₹ {summary.utilized.toLocaleString('en-IN')}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
