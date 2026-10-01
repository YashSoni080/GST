import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { SkeletonTable, SkeletonCard, ErrorState, EmptyState, StatCard } from '../components/ui';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function BarChart({ data, color = 'teal' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="chart" role="img" aria-label="Tax collected versus paid over the last six months">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div
            className={`bar ${color}`}
            style={{ height: `${Math.max(4, Math.round((d.value / max) * 150))}px` }}
            data-label={`Rs ${d.value} L`}
          />
          <div className="month">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [hsnData, setHsnData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const load = useCallback(
    (isRetry) => {
      setLoading(true);
      setError(null);
      api.getHSNCodes()
        .then(data => {
          const rows = data.hsnCodes || data || [];
          const list = Array.isArray(rows) ? rows : [];
          setHsnData(list);
          if (isRetry) toast.success('HSN directory refreshed', `${list.length} codes loaded from the statutory register.`);
        })
        .catch(err => {
          setError(err);
          if (isRetry) toast.error('Could not load HSN codes', err.message);
        })
        .finally(() => setLoading(false));
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const rows = Array.isArray(hsnData) ? hsnData : [];
    const goods = rows.filter(r => r.type === 'goods').length;
    const services = rows.filter(r => r.type === 'service').length;
    const rates = rows.map(r => Number(r.rate)).filter(n => Number.isFinite(n));
    const slabs = [...new Set(rates)].sort((a, b) => a - b);
    const reverseCharge = rows.filter(r => r.reverseCharge).length;
    const exempt = rows.filter(r => r.exempt).length;
    return {
      total: rows.length,
      goods,
      services,
      slabs,
      minRate: slabs[0],
      maxRate: slabs[slabs.length - 1],
      reverseCharge,
      exempt,
    };
  }, [hsnData]);

  const taxData = MONTHS.map((m, i) => ({
    label: m,
    value: [12, 13, 15, 18, 17, 21][i],
  }));

  const rows = Array.isArray(hsnData) ? hsnData : [];
  const showSummary = !loading && !error && rows.length > 0;

  return (
    <>
      {loading && (
        <div className="grid-4" aria-hidden="true">
          {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={112} />)}
        </div>
      )}

      {showSummary && (
        <div className="grid-4">
          <StatCard
            label="HSN / SAC codes"
            icon="📚"
            value={summary.total.toLocaleString('en-IN')}
            delta="Statutory rate directory"
          />
          <StatCard
            label="Tax slabs on file"
            icon="📊"
            value={String(summary.slabs.length)}
            accent="teal"
            delta={summary.slabs.length ? `${summary.minRate}% – ${summary.maxRate}% notified rates` : 'No rates mapped yet'}
          />
          <StatCard
            label="Reverse charge items"
            icon="🔄"
            value={String(summary.reverseCharge)}
            accent="amber"
            delta="Flagged payable under RCM"
          />
          <StatCard
            label="Nil / exempt items"
            icon="🧾"
            value={String(summary.exempt)}
            accent="primary"
            delta={`${summary.goods} goods · ${summary.services} services`}
          />
        </div>
      )}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>GST by HSN Code</h3>
            </div>
            <div className="row" style={{ gap: 10 }}>
              {!loading && !error && rows.length > 0 && (
                <span className="badge gray">{rows.length} codes</span>
              )}
              <button
                type="button"
                className="btn ghost tiny"
                onClick={() => load(true)}
                disabled={loading}
                aria-label="Refresh HSN directory"
              >
                {loading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {loading ? (
            <SkeletonTable rows={6} cols={4} />
          ) : error ? (
            <ErrorState
              error={error}
              onRetry={() => load(true)}
              title="Could not load the HSN directory"
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No HSN/SAC codes on file"
              description="The statutory rate directory is empty, so line-level HSN classification cannot be validated on invoices or returns. Seed the master data or reload the directory to populate it."
              action={{ label: '↻ Reload directory', onClick: () => load(true) }}
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>HSN / SAC</th>
                      <th>Description</th>
                      <th>Type</th>
                      <th className="num">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(h => (
                      <tr key={h._id || h.code}>
                        <td><strong className="mono">{h.code}</strong></td>
                        <td>{h.description}</td>
                        <td>
                          <span className={`badge ${h.type === 'service' ? 'violet' : 'blue'}`}>
                            {h.type === 'service' ? 'Service' : 'Goods'}
                          </span>
                        </td>
                        <td className="num">
                          <span className="badge amber">{h.rate}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-meta">
                <span>
                  {rows.length} codes · {summary.goods} goods, {summary.services} services · {summary.reverseCharge} reverse-charge
                </span>
                <span>Rates as notified under the GST rate schedule</span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Tax Collected vs Paid</h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>₹ lakhs · last 6 months</span>
          </div>
          <BarChart data={taxData} color="teal" />
        </div>
      </div>
    </>
  );
}
