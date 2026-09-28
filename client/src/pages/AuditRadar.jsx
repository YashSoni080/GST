import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function AuditRadar() {
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getAuditRadar()
      .then(data => setRadar(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const getRiskColor = (band) => {
    switch (band) {
      case 'CRITICAL': return 'var(--red)';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return 'var(--amber)';
      default: return 'var(--teal)';
    }
  };

  return (
    <>
      {loading ? (
        <div className="card empty">Running simulated Department Predictive Audit Radar...</div>
      ) : !radar ? (
        <div className="card empty">Failed to calculate risk score.</div>
      ) : (
        <>
          {/* Main Risk Radar Banner */}
          <div
            className="card"
            style={{
              marginBottom: 16,
              background: 'linear-gradient(135deg, #101828, #1e293b)',
              color: '#fff',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span className="badge" style={{ background: getRiskColor(radar.riskBand), color: '#fff', fontSize: 12, marginBottom: 8 }}>
                  DEPARTMENT RISK TIER: {radar.riskBand}
                </span>
                <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  Predictive Audit Radar (DGARM / BIFA Simulation)
                </h2>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Simulates central/state GST department scrutiny risk algorithms. Detects red flags before statutory ASMT-10 notices are served.
                </div>
                <div style={{ marginTop: 12, fontSize: 13 }}>
                  Department Scrutiny Likelihood: <strong style={{ color: getRiskColor(radar.riskBand) }}>{radar.auditLikelihood}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.06)', padding: '16px 28px', borderRadius: 12 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8' }}>Overall Risk Score</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: getRiskColor(radar.riskBand), lineHeight: 1.1 }}>
                  {radar.overallRiskScore}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Scale: 0 (Safe) to 100 (Audit Imminent)</div>
              </div>
            </div>
          </div>

          {/* Anomalies Detected */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div>
                <h3>Identified Department Red Flags & Anomalies ({radar.anomalies?.length || 0})</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Statutory discrepancies triggering algorithmic scrutiny under Rule 88C / Rule 88D
                </div>
              </div>
            </div>

            {radar.anomalies?.length === 0 ? (
              <div className="empty" style={{ color: 'var(--teal)' }}>
                ✓ No audit red flags detected! Turnover, ITC reconciliation, and E-Way bills are aligned.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {radar.anomalies.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 16,
                      borderRadius: 8,
                      background: a.severity === 'critical' ? '#fff1f2' : a.severity === 'high' ? '#fff7ed' : '#f8fafc',
                      border: `1px solid ${a.severity === 'critical' ? '#fecdd3' : a.severity === 'high' ? '#fed7aa' : 'var(--border)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: a.severity === 'critical' ? 'var(--red)' : '#c2410c' }}>
                        ⚠️ {a.metric} — {a.value}
                      </div>
                      <span className={`badge ${a.severity === 'critical' ? 'red' : 'amber'}`}>
                        {a.severity.toUpperCase()} SEVERITY
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', marginTop: 6, lineHeight: 1.5 }}>
                      {a.detail}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 6, fontWeight: 600 }}>
                      Recommended Action: {a.action}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Health Scorecards (Section 4.5) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3>Supplier Compliance Health Scorecard</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  Assigns real-time risk scores to vendors based on filing punctuality and GSTR-2B match rates
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Supplier / Vendor</th>
                  <th>GSTIN</th>
                  <th>Bills Received</th>
                  <th>ITC Amount Involved</th>
                  <th>GSTR-2B Match Rate</th>
                  <th>Compliance Grade</th>
                  <th>Audit Risk Tier</th>
                </tr>
              </thead>
              <tbody>
                {(radar.supplierHealth || []).map(s => (
                  <tr key={s.gstin}>
                    <td><strong>{s.name}</strong></td>
                    <td><span style={{ fontFamily: 'monospace' }}>{s.gstin}</span></td>
                    <td>{s.totalPurchases} Vouchers</td>
                    <td>₹ {Number(s.totalGst).toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${s.complianceRate}%`, height: '100%', background: s.complianceRate >= 80 ? 'var(--teal)' : 'var(--red)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{s.complianceRate}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.grade === 'A+' || s.grade === 'A' ? 'green' : s.grade === 'B' ? 'blue' : 'red'}`} style={{ fontSize: 12 }}>
                        {s.grade}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.risk === 'high' ? 'red' : s.risk === 'medium' ? 'amber' : 'green'}`}>
                        {s.risk.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
