import { useState, useEffect } from 'react';
import { api } from '../api/client';

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function BarChart({ data, color = 'teal' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="chart">
      {data.map((d, i) => (
        <div key={i} className="bar-wrap">
          <div
            className={`bar ${color}`}
            style={{ height: `${Math.round((d.value / max) * 150)}px` }}
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

  useEffect(() => {
    api.getHSNCodes()
      .then(data => setHsnData(data.hsnCodes || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const taxData = MONTHS.map((m, i) => ({
    label: m,
    value: [12, 13, 15, 18, 17, 21][i],
  }));

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header"><h3>GST by HSN Code</h3></div>
        {loading ? (
          <div className="empty">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr><th>HSN</th><th>Description</th><th>Type</th><th>Rate</th></tr>
            </thead>
            <tbody>
              {(hsnData || []).map(h => (
                <tr key={h._id || h.code}>
                  <td>{h.code}</td>
                  <td>{h.description}</td>
                  <td>{h.type}</td>
                  <td>{h.rate}%</td>
                </tr>
              ))}
              {(!hsnData || hsnData.length === 0) && (
                <tr><td colSpan={4} className="empty">No HSN codes found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h3>Tax Collected vs Paid</h3></div>
        <BarChart data={taxData} color="teal" />
      </div>
    </div>
  );
}
