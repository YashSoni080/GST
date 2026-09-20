import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function ITC() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getITC()
      .then(data => setEntries(data.entries || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="stat-label">Total ITC Availed</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₹ {summary.availed.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">Total Utilized</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₹ {summary.utilized.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">CGST Credit</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₹ {summary.cgst.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">SGST Credit</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₹ {summary.sgst.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3>ITC Entries</h3>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>Period</th><th>Type</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Reference</th><th>Note</th></tr>
            </thead>
            <tbody>
              {(entries || []).map(e => (
                <tr key={e._id}>
                  <td>{e.period}</td>
                  <td>{typeBadge(e.type)}</td>
                  <td>₹ {Number(e.cgst || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(e.sgst || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(e.igst || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {(Number(e.cgst || 0) + Number(e.sgst || 0) + Number(e.igst || 0)).toLocaleString('en-IN')}</td>
                  <td>{e.ref}</td>
                  <td>{e.note || '—'}</td>
                </tr>
              ))}
              {(!entries || entries.length === 0) && (
                <tr><td colSpan={8} className="empty">No ITC entries found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
