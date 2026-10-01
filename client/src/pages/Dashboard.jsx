import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard, Callout, SkeletonCard, ErrorState, EmptyState } from '../components/ui';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function BarChart({ data, color = 'primary', hideEmpty }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    if (hideEmpty) return null;
    return (
      <div className="empty" style={{ padding: '26px 12px' }}>
        No activity recorded in the last 6 months yet.
      </div>
    );
  }
  return (
    <div className="chart" role="img" aria-label="Last six months">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div
            className={`bar ${color}`}
            style={{ height: `${Math.max(4, Math.round((d.value / max) * 140))}px` }}
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
  return <span className={`badge ${map[status] || 'gray'}`}>{String(status || '—').replace(/_/g, ' ')}</span>;
}

const QUICK_ACTIONS = [
  { to: '/recon', icon: '⚖️', title: 'GSTR-2B Recon', desc: '4-way rule-based matching & vendor mailers', go: 'Run matching' },
  { to: '/itc-optimizer', icon: '⚡', title: 'ITC Optimizer', desc: 'Rule 37 180-day & Sec 17(5) blocked credits', go: 'Optimize credit' },
  { to: '/ctc-escrow', icon: '🛡️', title: 'CTC & Smart Escrow', desc: 'Zero-batch validation & split-payments', go: 'Open rail' },
  { to: '/notices', icon: '📜', title: 'Notices & DRC-03', desc: 'AI legal reply assistant & circular citations', go: 'Review notices' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.dashboard(), api.getAuditRadar().catch(() => null)])
      .then(([s, r]) => {
        setStats(s);
        setRadar(r);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <div className="grid-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} height={118} />)}
        </div>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} onRetry={load} title="Could not load the executive dashboard" />;

  const s = stats || {};
  const liabilityData = MONTHS.map((m, i) => ({ label: m, value: s.monthlyLiability?.[i] ?? 0 }));
  const itcData = MONTHS.map((m, i) => ({ label: m, value: s.monthlyITC?.[i] ?? 0 }));
  const recentInvoices = s.recentInvoices || [];
  const filings = s.filingStatus || [];
  const hasInvoices = recentInvoices.length > 0;

  return (
    <>
      {radar && (
        <Callout
          tone={radar.riskBand === 'LOW' ? 'success' : 'risk'}
          icon="🎯"
          title={
            <>
              Predictive Audit Radar · Score {radar.overallRiskScore}/100{' '}
              <span className={`badge ${radar.riskBand === 'LOW' ? 'green' : 'amber'}`} style={{ marginLeft: 6 }}>
                {radar.riskBand} TIER
              </span>
            </>
          }
          description={
            <>
              Department scrutiny likelihood is <strong>{radar.auditLikelihood}</strong>.{' '}
              {radar.anomalies?.length || 0} active compliance flags.
            </>
          }
          actions={
            <>
              <Link to="/assistant" className="btn outline small">💬 Ask AI Copilot</Link>
              <Link to="/audit-radar" className="btn small">View radar →</Link>
            </>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="grid-4">
        <StatCard
          label="Turnover (this FY)"
          icon="📈"
          value={s.turnover || '₹ 0.00'}
          delta={<><span className="up">▲</span> {s.turnoverDelta || 'Awaiting first invoice'}</>}
        />
        <StatCard
          label="Output Tax Liability"
          icon="🏛️"
          value={s.outputTax || '₹ 0'}
          delta={s.outputTaxDelta || 'IGST + CGST + SGST'}
        />
        <StatCard
          label="ITC Availed (2B)"
          icon="♻️"
          value={s.itcAvailed || '₹ 0'}
          accent="teal"
          delta={s.itcDelta || 'Eligible inward credit'}
          deltaClass="up"
        />
        <StatCard
          label="Net Cash Outflow (PMT-06)"
          icon="💵"
          value={s.netTax || '₹ 0'}
          accent="primary"
          delta={s.netTaxNote || 'Optimized via Rule 88A'}
          deltaClass="amber-text"
        />
      </div>

      {!hasInvoices && (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            icon="🧾"
            title="Your ledger is empty"
            description="No invoices have been recorded yet. Issue your first Rule 46 tax invoice to start compiling GSTR-1, GSTR-3B and ITC data automatically."
            action={{ label: '+ Create your first invoice', to: '/invoices' }}
            secondaryAction={{ label: 'Add vendors & parties', to: '/parties' }}
          />
        </div>
      )}

      <div className="grid-4" style={{ marginTop: 16 }}>
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="card action-card">
            <div className="ac-icon" aria-hidden="true">{a.icon}</div>
            <div className="ac-title">{a.title}</div>
            <div className="ac-desc">{a.desc}</div>
            <div className="ac-go">{a.go} <span aria-hidden="true">→</span></div>
          </Link>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Monthly Tax Liability vs ITC</h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>₹ lakhs · last 6 months</span>
          </div>
          <div className="chart-legend" style={{ marginBottom: 4 }}>
            <span className="lg"><span className="sw" style={{ background: 'var(--primary)' }} /> Output liability</span>
            <span className="lg"><span className="sw" style={{ background: 'var(--teal)' }} /> ITC available</span>
          </div>
          <BarChart data={liabilityData} color="primary" />
          <div style={{ marginTop: 6 }}>
            <BarChart data={itcData} color="teal" hideEmpty />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <span className="dot" />
              <h3>Return Filing Status</h3>
            </div>
            <Link to="/returns" className="btn outline small">All filings →</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Return</th>
                <th>Period</th>
                <th>Status</th>
                <th>ARN / Due</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => (
                <tr key={i}>
                  <td><strong>{f.type}</strong></td>
                  <td>{f.period}</td>
                  <td><StatusBadge status={f.status} /></td>
                  <td className="mono">{f.due || '—'}</td>
                </tr>
              ))}
              {filings.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 0, border: 'none' }}>
                    <EmptyState
                      icon="🗂️"
                      title="No returns compiled yet"
                      description="Auto-compile GSTR-1 and GSTR-3B from your invoices in one click."
                      action={{ label: 'Go to GSTR Filing', to: '/returns' }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <h3>Recent E-Invoices</h3>
          </div>
          <Link to="/invoices" className="btn small">+ New invoice</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Inv No.</th>
              <th>Party</th>
              <th>Date</th>
              <th className="num">Taxable Value</th>
              <th className="num">GST</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((inv) => (
              <tr key={inv._id || inv.invNo}>
                <td><strong>{inv.invNo}</strong></td>
                <td>{inv.partyName}</td>
                <td>{inv.date ? new Date(inv.date).toLocaleDateString('en-IN') : '—'}</td>
                <td className="num">₹ {Number(inv.taxableValue || 0).toLocaleString('en-IN')}</td>
                <td className="num">
                  ₹ {Number((inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0)).toLocaleString('en-IN')}
                </td>
                <td><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon="📄"
                    title="No invoices issued yet"
                    description="Create an invoice to see IRN, e-Way bill and tax breakdowns here."
                    action={{ label: '+ Create invoice', to: '/invoices' }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
