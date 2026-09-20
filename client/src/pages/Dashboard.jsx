import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function BarChart({ data, color = 'primary' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="chart">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div
            className={`bar ${color}`}
            style={{ height: `${Math.round((d.value / max) * 150)}px` }}
            data-label={`₹ ${d.value} L`}
          />
          <div className="month">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    filed: 'green', valid: 'green', IRN_GENERATED: 'green', pushed: 'green',
    draft: 'amber', pending: 'amber', IRN_PENDING: 'amber', validated: 'amber',
    cancelled: 'red', generated: 'blue',
  };
  return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Loading dashboard...</div>;

  const s = stats || {};

  const liabilityData = MONTHS.map((m, i) => ({
    label: m,
    value: s.monthlyLiability?.[i] ?? [14, 17, 16, 21, 19, 22][i],
  }));

  const itcData = MONTHS.map((m, i) => ({
    label: m,
    value: s.monthlyITC?.[i] ?? [12, 13, 15, 18, 17, 21][i],
  }));

  const recentInvoices = s.recentInvoices || [];

  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="stat-label">Turnover (this FY)</div>
          <div className="stat-value">{s.turnover || '₹ 0'}</div>
          {s.turnoverDelta && <div className={`stat-delta ${s.turnoverDelta.startsWith('▲') ? 'up' : 'down'}`}>{s.turnoverDelta}</div>}
        </div>
        <div className="card">
          <div className="stat-label">Output Tax</div>
          <div className="stat-value">{s.outputTax || '₹ 0'}</div>
          {s.outputTaxDelta && <div className={`stat-delta ${s.outputTaxDelta.startsWith('▲') ? 'up' : 'down'}`}>{s.outputTaxDelta}</div>}
        </div>
        <div className="card">
          <div className="stat-label">ITC Availed</div>
          <div className="stat-value">{s.itcAvailed || '₹ 0'}</div>
          {s.itcDelta && <div className={`stat-delta ${s.itcDelta.startsWith('▲') ? 'up' : 'down'}`}>{s.itcDelta}</div>}
        </div>
        <div className="card">
          <div className="stat-label">Net Tax Payable</div>
          <div className="stat-value">{s.netTax || '₹ 0'}</div>
          {s.netTaxNote && <div className="stat-delta amber-text">{s.netTaxNote}</div>}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header">
            <h3>Monthly Tax Liability vs ITC</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>₹ lakhs · last 6 months</span>
          </div>
          <BarChart data={liabilityData} color="primary" />
          <div style={{ marginTop: 8 }}>
            <BarChart data={itcData} color="teal" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Return Filing Status</h3>
            <Link to="/returns" className="btn small">View all</Link>
          </div>
          <table>
            <thead>
              <tr><th>Return</th><th>Period</th><th>Status</th><th>Due</th></tr>
            </thead>
            <tbody>
              {(s.filingStatus || []).map((f, i) => (
                <tr key={i}>
                  <td><strong>{f.type}</strong></td>
                  <td>{f.period}</td>
                  <td><StatusBadge status={f.status} /></td>
                  <td>{f.due || '—'}</td>
                </tr>
              ))}
              {(!s.filingStatus || s.filingStatus.length === 0) && (
                <>
                  <tr><td><strong>GSTR-1</strong></td><td>Current</td><td><span className="badge amber">Pending</span></td><td>—</td></tr>
                  <tr><td><strong>GSTR-3B</strong></td><td>Current</td><td><span className="badge amber">Draft</span></td><td>—</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>Recent E-Invoices</h3>
          <Link to="/invoices" className="btn small">Create invoice →</Link>
        </div>
        <table>
          <thead>
            <tr><th>Inv No.</th><th>Party</th><th>Date</th><th>Taxable Value</th><th>GST</th><th>Status</th></tr>
          </thead>
          <tbody>
            {recentInvoices.map((inv, i) => (
              <tr key={i}>
                <td>{inv.invNo}</td>
                <td>{inv.partyName}</td>
                <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}</td>
                <td>₹ {Number(inv.taxableValue || 0).toLocaleString('en-IN')}</td>
                <td>₹ {Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toLocaleString('en-IN')}</td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr><td colSpan={6} className="empty">No invoices yet. Create your first invoice.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
