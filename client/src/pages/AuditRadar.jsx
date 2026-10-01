import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { SkeletonCard, SkeletonTable, ErrorState, EmptyState, StatCard } from '../components/ui';
import { useToast } from '../components/Toast';

export default function AuditRadar() {
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.getAuditRadar()
      .then(data => setRadar(data))
      .catch(err => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await api.getAuditRadar();
      setRadar(data);
      setError(null);
      toast.success('Audit radar refreshed', 'Risk score recomputed from your latest invoices, returns and e-Way bills.');
    } catch (err) {
      toast.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const getRiskColor = (band) => {
    switch (band) {
      case 'CRITICAL': return 'var(--red)';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return 'var(--amber)';
      default: return 'var(--teal)';
    }
  };

  // darker variants for white text on filled badges (WCAG AA)
  const getRiskBadge = (band) => {
    switch (band) {
      case 'CRITICAL': return '#b91c1c';
      case 'HIGH': return '#c2410c';
      case 'MEDIUM': return '#b45309';
      default: return '#0f766e';
    }
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Recalculating predictive audit radar…</span>
        <SkeletonCard height={172} />
        <div className="grid-3" style={{ marginTop: 16 }}>
          {[0, 1, 2].map(i => <SkeletonCard key={i} height={112} />)}
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <SkeletonTable rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={load} title="Could not calculate your departmental risk score" />;
  }

  if (!radar) {
    return (
      <EmptyState
        icon="🎯"
        title="Risk score unavailable"
        description="The predictive audit radar needs at least one invoice or return to simulate DGARM scrutiny algorithms. Run a refresh once your ledger has data."
        action={{ label: '↻ Recalculate radar', onClick: load }}
        secondaryAction={{ label: 'Go to dashboard', to: '/' }}
      />
    );
  }

  const anomalies = radar.anomalies || [];
  const suppliers = radar.supplierHealth || [];
  const critical = anomalies.filter(a => a.severity === 'critical').length;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${radar.riskBand === 'LOW' ? 'green' : radar.riskBand === 'CRITICAL' ? 'red' : 'amber'}`}>
            {radar.riskBand} risk tier
          </span>
          <span className="text-[11px] text-gray-500" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
            DGARM / BIFA simulation · Rule 88C &amp; 88D
          </span>
        </div>
        <button type="button" className="btn outline small" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <><span className="spinner sm" aria-hidden="true" /> Recomputing…</>
          ) : (
            '↻ Refresh radar'
          )}
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #101828, #1e293b)',
          color: '#fff',
          padding: 24,
        }}
      >
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div style={{ minWidth: 0 }}>
            <span className="badge" style={{ background: getRiskBadge(radar.riskBand), color: '#fff' }}>
              Department risk tier: {radar.riskBand}
            </span>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#fff' }}>
              Predictive Audit Radar (DGARM / BIFA simulation)
            </h2>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Simulates central &amp; state GST department scrutiny risk algorithms, flagging red flags before statutory ASMT-10 notices are served.
            </div>
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Department scrutiny likelihood:{' '}
              <strong style={{ color: getRiskColor(radar.riskBand) }}>{radar.auditLikelihood}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', padding: '16px 28px', borderRadius: 12 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>
              Overall risk score
            </div>
            <div className="num" style={{ fontSize: 44, fontWeight: 800, color: getRiskColor(radar.riskBand), lineHeight: 1.1 }}>
              {radar.overallRiskScore}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Scale: 0 (safe) to 100 (audit imminent)</div>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <StatCard
          label="Active red flags"
          icon="🚩"
          value={anomalies.length}
          delta={critical > 0 ? `${critical} critical severity` : 'No critical flags'}
          deltaClass={critical > 0 ? 'down' : 'up'}
        />
        <StatCard
          label="Critical severity flags"
          icon="🚨"
          value={critical}
          accent="amber"
          delta="Escalate before the reply deadline"
        />
        <StatCard
          label="Suppliers scored"
          icon="🏭"
          value={suppliers.length}
          accent="teal"
          delta="Filing punctuality & 2B match rate"
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Identified department red flags &amp; anomalies ({anomalies.length})</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Statutory discrepancies that trigger algorithmic scrutiny under Rule 88C / Rule 88D
              </div>
            </div>
          </div>
          {anomalies.length > 0 && <span className={`badge ${critical > 0 ? 'red' : 'amber'}`}>{critical} critical</span>}
        </div>

        {anomalies.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No audit red flags detected"
            description="Turnover, ITC reconciliation and e-Way bill data are aligned with your filed returns. The radar re-runs every time you refresh, so clear flags here before they become ASMT-10 notices."
            action={{ label: '↻ Re-run the radar', onClick: handleRefresh }}
            secondaryAction={{ label: 'Review GSTR-2B recon', to: '/recon' }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {anomalies.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: a.severity === 'critical' ? '#fff1f2' : a.severity === 'high' ? '#fff7ed' : 'var(--card-soft)',
                  border: `1px solid ${a.severity === 'critical' ? '#fecdd3' : a.severity === 'high' ? '#fed7aa' : 'var(--border)'}`,
                }}
              >
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <div style={{ fontWeight: 700, fontSize: 14, color: a.severity === 'critical' ? 'var(--red)' : '#c2410c' }}>
                    ⚠️ {a.metric} — <span className="num">{a.value}</span>
                  </div>
                  <span className={`badge ${a.severity === 'critical' ? 'red' : 'amber'}`}>
                    {String(a.severity || 'medium').toUpperCase()} severity
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>{a.detail}</div>
                <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 6, fontWeight: 600 }}>
                  Recommended action: {a.action}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title-row">
            <span className="dot" />
            <div>
              <h3>Supplier compliance health scorecard</h3>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Real-time vendor risk scores from filing punctuality and GSTR-2B match rates
              </div>
            </div>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <EmptyState
            icon="🏭"
            title="No suppliers scored yet"
            description="Record purchase bills and run a GSTR-2B reconciliation — every vendor then earns a compliance grade so you can avoid availing credit from high-risk suppliers."
            action={{ label: '+ Record a purchase bill', to: '/purchases' }}
            secondaryAction={{ label: 'Run 2B reconciliation', to: '/recon' }}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Supplier / vendor</th>
                    <th>GSTIN</th>
                    <th className="num">Bills received</th>
                    <th className="num">ITC amount involved</th>
                    <th>GSTR-2B match rate</th>
                    <th>Compliance grade</th>
                    <th>Audit risk tier</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map(s => (
                    <tr key={s.gstin}>
                      <td><strong>{s.name}</strong></td>
                      <td><span className="mono">{s.gstin}</span></td>
                      <td className="num">{s.totalPurchases}</td>
                      <td className="num">₹ {Number(s.totalGst).toLocaleString('en-IN')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 80, height: 6, background: 'var(--bg-sunken)', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${s.complianceRate}%`,
                                height: '100%',
                                background: s.complianceRate >= 80 ? 'var(--teal)' : 'var(--red)',
                              }}
                            />
                          </div>
                          <span className="num" style={{ fontSize: 12, fontWeight: 600 }}>{s.complianceRate}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${s.grade === 'A+' || s.grade === 'A' ? 'green' : s.grade === 'B' ? 'blue' : 'red'}`}>
                          {s.grade}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.risk === 'high' ? 'red' : s.risk === 'medium' ? 'amber' : 'green'}`}>
                          {String(s.risk || 'low').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>{suppliers.length} suppliers scored</span>
              <span>{suppliers.filter(s => s.risk === 'high').length} high risk · {suppliers.filter(s => s.risk === 'medium').length} medium risk</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
