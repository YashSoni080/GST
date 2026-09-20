import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getReturns()
      .then(data => setReturns(data.returns || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (id) => {
    if (!confirm('Submit this return?')) return;
    try {
      await api.submitReturn(id);
      const data = await api.getReturns();
      setReturns(data.returns || data || []);
      setSelected(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = { filed: 'green', validated: 'green', draft: 'amber', generated: 'blue', partially_filed: 'red' };
    return <span className={`badge ${map[status] || 'gray'}`}>{status}</span>;
  };

  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="stat-label">Total Returns</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{returns.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Filed</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{returns.filter(r => r.status === 'filed').length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Pending</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{returns.filter(r => r.status !== 'filed').length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Penalties</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₹ 0</div>
          <div className="stat-delta up">On-time filing</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>GSTR Returns</h3>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Type</th><th>Period</th><th>GSTIN</th><th>Status</th><th>Filed At</th><th>ARN</th><th></th></tr>
            </thead>
            <tbody>
              {(returns || []).map(ret => (
                <tr key={ret._id} onClick={() => setSelected(ret)} style={{ cursor: 'pointer' }}>
                  <td><strong>{ret.type}</strong></td>
                  <td>{ret.period}</td>
                  <td>{ret.companyGstin}</td>
                  <td>{statusBadge(ret.status)}</td>
                  <td>{ret.filedAt ? new Date(ret.filedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>{ret.arn || '—'}</td>
                  <td>
                    {ret.status !== 'filed' && (
                      <button className="btn small" onClick={(e) => { e.stopPropagation(); handleSubmit(ret._id); }}>
                        File
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!returns || returns.length === 0) && (
                <tr><td colSpan={7} className="empty">No returns found. Returns are generated from invoice data.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <h3>{selected.type} - {selected.period}</h3>
            <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
          </div>

          <div className="progress-track">
            <div className="pt done"><div className="dot" />Data compiled</div>
            <div className={selected.status === 'draft' ? 'pt now' : 'pt done'}><div className="dot" />Validated</div>
            <div className={selected.status === 'filed' ? 'pt done' : 'pt'}><div className="dot" />Filed</div>
          </div>

          {selected.summary && (
            <table style={{ marginTop: 12 }}>
              <thead><tr><th>Section</th><th>Value</th></tr></thead>
              <tbody>
                {Object.entries(selected.summary).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td>₹ {Number(v).toLocaleString('en-IN')}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          {selected.validationErrors?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ color: 'var(--red)', fontSize: 13 }}>Validation Errors:</strong>
              {selected.validationErrors.map((e, i) => <div key={i} style={{ color: 'var(--red)', fontSize: 13 }}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
