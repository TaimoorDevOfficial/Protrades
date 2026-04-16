import { useEffect, useState } from "react";
import { api } from "../api.js";

function fmt(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export default function MarketBrief() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const d = await api("/api/market/brief");
      setData(d);
    } catch (e) {
      setErr(e.message || "Failed to load market brief");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const rows = data?.holdings || [];
  const actions = data?.corporate_actions || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Market brief</h1>
          <p className="page-sub">Auto-generated from holdings + watchlist (no chatbot)</p>
        </div>
        <button
          type="button"
          onClick={() => load().catch(() => {})}
          className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <div className="card-qe border border-tertiary-container/30 text-sm text-tertiary-container">{err}</div>}

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Snapshot</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          LTP via Vortex quotes. Day change is vs the day open candle. Includes holdings and watchlist.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg bg-surface-container">
          <table className="table-qe min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">List</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Avg</th>
                <th className="px-4 py-3 text-right">LTP</th>
                <th className="px-4 py-3 text-right">Day chg</th>
                <th className="px-4 py-3 text-right">Day %</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.day_change_pct;
                const pctColor = pct != null && pct < 0 ? "text-tertiary-container" : "text-secondary";
                const pnlColor = r.pnl != null && r.pnl < 0 ? "text-tertiary-container" : "text-secondary";
                return (
                  <tr key={`${r.exchange}-${r.token}`} className="border-b border-outline-variant/5">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.symbol}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">
                      {r.source === "watchlist" ? "Watchlist" : "Holding"}
                    </td>
                    <td className="numeric px-4 py-3 text-right">{fmt(r.quantity, 0)}</td>
                    <td className="numeric px-4 py-3 text-right">{r.source === "watchlist" ? "—" : `₹${fmt(r.avg_price)}`}</td>
                    <td className="numeric px-4 py-3 text-right">₹{fmt(r.ltp)}</td>
                    <td className="numeric px-4 py-3 text-right">₹{fmt(r.day_change)}</td>
                    <td className={`numeric px-4 py-3 text-right text-xs font-semibold ${pctColor}`}>
                      {pct == null ? "—" : `${fmt(pct)}%`}
                    </td>
                    <td className={`numeric px-4 py-3 text-right text-xs font-semibold ${pnlColor}`}>
                      {r.source === "watchlist" ? "—" : r.pnl == null ? "—" : `₹${fmt(r.pnl)}`}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-xs text-on-surface-variant" colSpan={8}>
                    No snapshot yet. Log in to broker and add symbols to watchlist.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Corporate actions (NSE)</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Best-effort feed from NSE; may be empty if NSE blocks automated requests.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg bg-surface-container">
          <table className="table-qe min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Ex date</th>
                <th className="px-4 py-3">Record date</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a, idx) => (
                <tr key={idx} className="border-b border-outline-variant/5">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{a.symbol || a.SYMBOL}</td>
                  <td className="px-4 py-3 text-xs">{a.subject || a.SUBJECT || a.purpose || "—"}</td>
                  <td className="px-4 py-3 text-xs">{a.exDate || a.ex_date || a.EXDATE || "—"}</td>
                  <td className="px-4 py-3 text-xs">{a.recordDate || a.record_date || a.RECORDDATE || "—"}</td>
                </tr>
              ))}
              {actions.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-xs text-on-surface-variant" colSpan={4}>
                    No corporate actions found for holdings (or NSE blocked the feed).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

