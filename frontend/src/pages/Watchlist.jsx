import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import TradingViewEmbed, { formatTvSymbol } from "../components/TradingViewEmbed.jsx";
import { SessionRefreshBanner, useSessionCachedFetch } from "../context/SessionDataContext.jsx";

export default function Watchlist() {
  const loadWatch = useCallback(() => api("/api/settings/watchlist"), []);
  const { data, error, reload } = useSessionCachedFetch("watchlist", loadWatch);
  const rows = data ?? [];

  const [sym, setSym] = useState("");
  const [chartSymbol, setChartSymbol] = useState("NSE:RELIANCE");
  const [customChart, setCustomChart] = useState("");
  const chartSeeded = useRef(false);

  useEffect(() => {
    if (!chartSeeded.current && rows.length > 0) {
      chartSeeded.current = true;
      setChartSymbol(formatTvSymbol(rows[0].exchange, rows[0].symbol));
    }
  }, [rows]);

  const add = async () => {
    if (!sym.trim()) return;
    await api("/api/settings/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbol: sym, exchange: "NSE" }),
    });
    setSym("");
    reload();
  };

  const chartOptions = useMemo(() => {
    const fromRows = rows.map((w) => formatTvSymbol(w.exchange, w.symbol));
    const uniq = [...new Set(["NSE:RELIANCE", ...fromRows])];
    if (chartSymbol && !uniq.includes(chartSymbol)) uniq.unshift(chartSymbol);
    return uniq;
  }, [rows, chartSymbol]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Watchlist</h1>
        <p className="page-sub">
          Live TradingView chart below · your symbols feed Intel and Market pages
        </p>
      </div>

      <SessionRefreshBanner cacheKey="watchlist" />

      {error && (
        <div className="rounded-lg border border-tertiary-container/30 px-4 py-3 text-sm text-tertiary-container">
          {error}{" "}
          <button type="button" className="font-medium text-primary underline" onClick={() => reload()}>
            Retry
          </button>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              Chart (TradingView)
            </h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              Embedded chart for quick context. You can also change symbol inside the widget.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs text-on-surface-variant">
              Watchlist
              <select
                className="input-qe mt-1 min-w-[200px]"
                value={chartSymbol}
                onChange={(e) => setChartSymbol(e.target.value)}
              >
                {chartOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <input
                className="input-qe mt-1 min-w-[160px] sm:mt-0"
                placeholder="NSE:NIFTY"
                value={customChart}
                onChange={(e) => setCustomChart(e.target.value)}
              />
              <button
                type="button"
                className="mt-1 rounded-md border border-outline-variant/25 px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-high sm:mt-0"
                onClick={() => {
                  const t = customChart.trim().toUpperCase();
                  if (t) setChartSymbol(t.includes(":") ? t : `NSE:${t}`);
                }}
              >
                Load
              </button>
            </div>
          </div>
        </div>
        <TradingViewEmbed symbol={chartSymbol} />
      </section>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Symbols</h2>
        <p className="text-sm text-on-surface-variant">
          Used for the chart dropdown and to power the Intel feed.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input-qe flex-1"
            placeholder="e.g. RELIANCE"
            value={sym}
            onChange={(e) => setSym(e.target.value)}
          />
          <button
            type="button"
            onClick={() => add().catch(() => {})}
            className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed sm:shrink-0"
          >
            Add
          </button>
        </div>
        <div className="scroll-card-list">
          <div className="grid gap-3 md:grid-cols-2">
          {rows.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg bg-surface-container px-4 py-3 transition-colors hover:bg-surface-container-high/80"
            >
              <div>
                <p className="font-mono text-sm font-medium text-primary">{w.symbol}</p>
                <p className="text-xs text-on-surface-variant">{w.exchange}</p>
              </div>
              <button
                type="button"
                className="text-xs text-tertiary-container hover:underline"
                onClick={() =>
                  api(`/api/settings/watchlist/${w.id}`, { method: "DELETE" }).then(() => reload())
                }
              >
                Remove
              </button>
            </div>
          ))}
          </div>
        </div>
      </section>
    </div>
  );
}
