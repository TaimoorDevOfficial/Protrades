import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);

  useEffect(() => {
    api("/api/data/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
    api("/api/data/holdings")
      .then((d) => setHoldings(d.holdings || []))
      .catch(() => setHoldings([]));
  }, []);

  const totalQty = holdings.reduce((acc, h) => acc + Number(h.quantity ?? h.qty ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Portfolio</h1>
        <p className="page-sub">Allocation view from synced broker holdings</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-qe lg:col-span-2">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">Estimated exposure</p>
          <p className="font-headline mt-3 text-3xl font-bold tabular-nums text-on-surface">
            {holdings.length} line{holdings.length === 1 ? "" : "s"}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">Total quantity across holdings: {totalQty}</p>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-container transition-all"
              style={{ width: `${Math.min(100, holdings.length * 12)}%` }}
            />
          </div>
        </div>
        <div className="card-qe border-l-4 border-secondary">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/60">Open P&amp;L</p>
          <p
            className={`font-headline mt-3 text-3xl font-bold tabular-nums ${
              (summary?.open_pnl ?? 0) < 0 ? "text-tertiary-container" : "text-secondary"
            }`}
          >
            ₹{summary?.open_pnl != null ? Number(summary.open_pnl).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
          </p>
          <Link to="/holdings" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">
            Full holdings table →
          </Link>
        </div>
      </div>

      <div className="rounded-lg bg-surface-container p-6">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Top holdings</h2>
        <ul className="mt-4 space-y-3">
          {holdings.slice(0, 8).map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md bg-surface-container-low px-3 py-2 text-sm hover:bg-surface-container-high/50"
            >
              <span className="font-mono text-primary">{h.symbol}</span>
              <span className="numeric text-on-surface-variant">{h.quantity ?? h.qty}</span>
            </li>
          ))}
        </ul>
        {holdings.length === 0 && <p className="text-sm text-on-surface-variant">No holdings yet — connect broker or use guest mode.</p>}
      </div>
    </div>
  );
}
