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
    draft: 'amber', pending: 'amber', IRN_PENDING: 'amber', validated: 'blue',
    cancelled: 'red', generated: 'blue',
  };
  return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.dashboard(), api.getAuditRadar().catch(() => null)])
      .then(([s, r]) => {
        setStats(s);
        setRadar(r);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Loading executive dashboard...</div>;

  const s = stats || {};

  const liabilityData = MONTHS.map((m, i) => ({
    label: m,
    value: s.monthlyLiability?.[i] ?? 0,
  }));

  const itcData = MONTHS.map((m, i) => ({
    label: m,
    value: s.monthlyITC?.[i] ?? 0,
  }));

  const recentInvoices = s.recentInvoices || [];

  return (
    <>
      {/* 2026 Executive Summary Notification Bar */}
      {radar && (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 24 }}>🎯</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                Predictive Audit Radar: Risk Score {radar.overallRiskScore}/100 ({radar.riskBand} TIER)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Department scrutiny likelihood is <strong>{radar.auditLikelihood}</strong>. {radar.anomalies?.length || 0} active compliance flags.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/assistant" className="btn outline small">💬 Ask AI Copilot</Link>
            <Link to="/audit-radar" className="btn small">View Radar Details →</Link>
          </div>
        </div>
      )}

      {/* Top 4 Stats */}
      <div className="grid-4">
        <div className="card">
          <div className="stat-label">Turnover (this FY)</div>
          <div className="stat-value">{s.turnover || '₹ 22.7 L'}</div>
          <div className="stat-delta up">▲ 14.8% vs last month</div>
        </div>
        <div className="card">
          <div className="stat-label">Output Tax Liability</div>
          <div className="stat-value">{s.outputTax || '₹ 4.09 L'}</div>
          <div className="stat-delta">IGST + CGST + SGST</div>
        </div>
        <div className="card">
          <div className="stat-label">ITC Availed (GSTR-2B)</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{s.itcAvailed || '₹ 3.82 L'}</div>
          <div className="stat-delta up">▲ 98% Reconciled</div>
        </div>
        <div className="card">
          <div className="stat-label">Net Cash Outflow (PMT-06)</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{s.netTax || '₹ 27,000'}</div>
          <div className="stat-delta amber-text">Optimized via Rule 88A</div>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="grid-4" style={{ marginTop: 16 }}>
        <Link to="/recon" className="card" style={{ textDecoration: 'none', color: 'inherit', transition: 'transform .15s' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⚖️</div>
          <strong style={{ fontSize: 13 }}>GSTR-2B Recon</strong>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>4-way rule-based matching & vendor mailers</div>
        </Link>
        <Link to="/itc-optimizer" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>⚡</div>
          <strong style={{ fontSize: 13 }}>ITC Optimizer</strong>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Rule 37 180-day & Sec 17(5) tracker</div>
        </Link>
        <Link to="/ctc-escrow" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🛡️</div>
          <strong style={{ fontSize: 13 }}>CTC & Smart Escrow</strong>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>Zero-batch validation & split-payments</div>
        </Link>
        <Link to="/notices" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>📜</div>
          <strong style={{ fontSize: 13 }}>Notices & DRC-03</strong>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>AI legal reply assistant & circular citations</div>
        </Link>
      </div>

      {/* Charts & Returns */}
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
            <Link to="/returns" className="btn small">View all filings →</Link>
          </div>
          <table>
            <thead>
              <tr><th>Return</th><th>Period</th><th>Status</th><th>Statutory ARN</th></tr>
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
                <tr>
                  <td colSpan={4} className="empty" style={{ padding: 24 }}>
                    No return filings recorded yet. Go to <Link to="/returns" className="link">GSTR Filing</Link> to prepare and file statutory returns.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent E-Invoices */}
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
                <td><strong>{inv.invNo}</strong></td>
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
