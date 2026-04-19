import { useCallback } from "react";
import { api } from "../api.js";
import { SessionRefreshBanner, useSessionCachedFetch } from "../context/SessionDataContext.jsx";

export default function Holdings() {
  const loadHoldings = useCallback(async () => {
    await api("/api/auth/refresh", { method: "POST" });
    return api("/api/data/holdings");
  }, []);

  const { data, error, reload } = useSessionCachedFetch("holdings", loadHoldings);
  const rows = data?.holdings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Holdings</h1>
        <p className="page-sub">Synced from Rupeezzy on login / refresh</p>
      </div>
      <SessionRefreshBanner cacheKey="holdings" />
      {error && (
        <div className="rounded-lg border border-tertiary-container/30 px-4 py-3 text-sm text-tertiary-container">
          {error}{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => reload()}>
            Retry
          </button>
        </div>
      )}
      <div className="scroll-list-wrap">
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
