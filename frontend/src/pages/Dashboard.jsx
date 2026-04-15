import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api("/api/data/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const pnl = summary?.open_pnl;
  const pnlColor = pnl != null && pnl < 0 ? "text-tertiary-container" : "text-secondary";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">Live snapshot · synced on login and refresh</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="card-qe group relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-colors group-hover:bg-primary/10" />
          <p className="text-xs font-medium uppercase tracking-widest text-on-surface-variant/60">Open P&amp;L</p>
          <div className="mt-4 flex items-baseline gap-2">
            <h2 className={`font-headline text-3xl font-bold tabular-nums ${pnlColor}`}>
              ₹{pnl != null ? Number(pnl).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
            </h2>
          </div>
          <p className="mt-2 text-[10px] text-on-surface-variant">From open positions</p>
        </div>

        <div className="card-qe">
          <p className="text-xs font-medium uppercase tracking-widest text-on-surface-variant/60">Open positions</p>
          <h2 className="font-headline mt-4 text-3xl font-bold tabular-nums text-on-surface">
            {summary?.positions_count ?? "—"}
          </h2>
          <Link to="/holdings" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
            View holdings →
          </Link>
        </div>

        <div className="card-qe border-l-4 border-primary">
          <p className="text-xs font-medium uppercase tracking-widest text-on-surface-variant/60">Funds available</p>
          <h2 className="font-headline mt-4 text-3xl font-bold tabular-nums text-on-surface">
            ₹
            {summary?.funds?.available != null
              ? Number(summary.funds.available).toLocaleString("en-IN")
              : "—"}
          </h2>
          <p className="mt-2 text-[10px] text-on-surface-variant">From last broker sync</p>
        </div>

        <div className="card-qe">
          <p className="text-xs font-medium uppercase tracking-widest text-on-surface-variant/60">Last updated</p>
          <h2 className="font-headline mt-4 text-lg font-bold text-on-surface">
            {summary?.updated_at ? new Date(summary.updated_at).toLocaleString() : "—"}
          </h2>
          <Link to="/watchlist" className="mt-3 inline-block text-xs text-on-surface-variant hover:text-primary">
            Watchlist &amp; chart alerts →
          </Link>
        </div>
      </div>
    </div>
  );
}
