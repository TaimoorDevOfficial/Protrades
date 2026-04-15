import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import TradingViewEmbed, { formatTvSymbol } from "../components/TradingViewEmbed.jsx";
import { copyText, useWebhookUrls } from "../hooks/useWebhookUrls.js";
import { appendWebhookKey } from "../utils/webhookUrl.js";

const TV_MESSAGE = `{
  "ticker": "{{ticker}}",
  "action": "BUY",
  "quantity": 1,
  "strategy_id": "watchlist_alert"
}`;

export default function Watchlist() {
  const urls = useWebhookUrls();
  const [rows, setRows] = useState([]);
  const [sym, setSym] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [chartSymbol, setChartSymbol] = useState("NSE:RELIANCE");
  const [customChart, setCustomChart] = useState("");
  const chartSeeded = useRef(false);

  const load = () => api("/api/settings/watchlist").then(setRows);

  useEffect(() => {
    load().catch(() => {});
    api("/api/settings")
      .then((s) => setApiKey(s.protrades_api_key || ""))
      .catch(() => setApiKey(""));
  }, []);

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
    load();
  };

  const tvWebhook = appendWebhookKey(urls.tradingview, apiKey);
  const chartinkWebhook = appendWebhookKey(urls.chartink, apiKey);

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
          Live TradingView chart below · your symbols · webhooks for automated signals
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              Chart (TradingView)
            </h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              Embedded chart for quick context. You can also change symbol inside the widget. For orders from alerts,
              use the webhook section further down.
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

      <section className="space-y-4 rounded-lg border border-outline-variant/10 bg-surface-container p-6">
        <h2 className="font-headline text-sm font-semibold text-primary">Why is there a webhook &quot;link&quot;?</h2>
        <p className="text-sm leading-relaxed text-on-surface-variant">
          The chart above is for <strong className="text-on-surface">viewing</strong>. To <strong className="text-on-surface">automate</strong>{" "}
          (send a trade signal into ProTrades when price crosses a level, etc.), TradingView must call your server over
          the internet. That is the <strong>webhook URL</strong> — you paste it in the alert on{" "}
          <strong className="text-on-surface">tradingview.com</strong> (ChartInk uses its own form). ProTrades then
          receives JSON and can place an order per your risk settings.
        </p>
        {!apiKey && (
          <p className="text-sm text-tertiary-container">
            Load your ProTrades webhook key from Settings first — we attach it to the URL below as{" "}
            <code className="text-primary">?key=…</code> because TradingView cannot send custom HTTP headers.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          TradingView — what you actually do
        </h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-on-surface-variant">
          <li>
            On{" "}
            <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              tradingview.com
            </a>{" "}
            open the <strong className="text-on-surface">same symbol</strong> you chart here (or use the embedded chart
            only for viewing and create the alert from the full site if you prefer).
          </li>
          <li>
            Create an <strong className="text-on-surface">Alert</strong> (clock / bell). Set your condition (price
            cross, indicator, etc.).
          </li>
          <li>
            In alert options, enable <strong className="text-on-surface">Webhook URL</strong> and paste the{" "}
            <strong className="text-on-surface">full URL</strong> from the box below (it includes your auth key).
          </li>
          <li>
            Set the alert <strong className="text-on-surface">Message</strong> to valid JSON. Example (copy the block
            below) — TradingView will replace <code className="text-xs text-primary">{"{{ticker}}"}</code> when the
            alert fires. Change <code className="text-xs">BUY</code> / quantity as needed.
          </li>
          <li>Save the alert. When it fires, check Automation → Live log or Logs for the incoming event.</li>
        </ol>

        <div className="mt-4 space-y-3 rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Webhook URL for TradingView</p>
          <code className="block break-all rounded-md bg-surface-container px-3 py-2 text-[11px] text-primary">
            {tvWebhook || urls.tradingview || "—"}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!tvWebhook}
              onClick={() => copyText(tvWebhook)}
              className="rounded-md bg-gradient-to-br from-primary to-primary-container px-3 py-2 text-xs font-semibold text-on-primary-fixed disabled:opacity-40"
            >
              Copy webhook URL
            </button>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Example alert message (JSON)</p>
          <pre className="overflow-x-auto rounded-md bg-surface-container p-3 text-[11px] leading-relaxed text-on-surface">
            {TV_MESSAGE}
          </pre>
          <button
            type="button"
            onClick={() => copyText(TV_MESSAGE)}
            className="rounded-md border border-outline-variant/25 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
          >
            Copy message template
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          ChartInk (scanner)
        </h2>
        <p className="text-sm text-on-surface-variant">
          In ChartInk (or similar), set the webhook POST URL to the value below. Body fields should match what
          ProTrades expects: at least <code className="text-primary">stocks</code> (comma-separated symbols), optional{" "}
          <code className="text-primary">action</code>, <code className="text-primary">trigger_prices</code>.
        </p>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
          <code className="block break-all text-[11px] text-primary">{chartinkWebhook || urls.chartink || "—"}</code>
          <button
            type="button"
            disabled={!chartinkWebhook}
            onClick={() => copyText(chartinkWebhook)}
            className="mt-3 rounded-md border border-outline-variant/25 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-40"
          >
            Copy ChartInk URL
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Symbols</h2>
        <p className="text-sm text-on-surface-variant">
          Used for the chart dropdown, ProBot context, and to keep tickers aligned with your TradingView alerts.
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
                onClick={() => api(`/api/settings/watchlist/${w.id}`, { method: "DELETE" }).then(() => load())}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
