import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Holdings() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api("/api/data/holdings")
      .then((d) => setRows(d.holdings || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Holdings</h1>
        <p className="page-sub">Synced from Rupeezzy on login / refresh</p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-surface-container">
        <table className="table-qe min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/10">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Avg</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">P&amp;L %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-mono text-xs font-medium text-primary">{h.symbol}</td>
                <td className="numeric px-4 py-3 text-right">{h.quantity ?? h.qty}</td>
                <td className="numeric px-4 py-3 text-right">{h.avg_price ?? h.avg}</td>
                <td className="numeric px-4 py-3 text-right">{h.ltp}</td>
                <td className="numeric px-4 py-3 text-right text-secondary">{h.pnl_percent ?? h.pnl_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
