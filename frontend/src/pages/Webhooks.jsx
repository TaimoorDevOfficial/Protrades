import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import WebhookUrlBlock from "../components/WebhookUrlBlock.jsx";

const CHARTINK_SAMPLE = `{
  "stocks": "RELIANCE,TCS",
  "trigger_prices": "123.45,456.0",
  "action": "BUY"
}`;

export default function Webhooks() {
  const [key, setKey] = useState("");
  const [logs, setLogs] = useState([]);
  const [urls, setUrls] = useState({});

  const load = async () => {
    const s = await api("/api/settings");
    setKey(s.protrades_api_key || "");
    const l = await api("/api/logs?limit=30");
    setLogs(l);
    const u = await api("/api/webhook-urls");
    setUrls(u || {});
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const testFire = async () => {
    await fetch("/webhook/python", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ProTrades-Key": key,
      },
      body: JSON.stringify({
        symbol: "RELIANCE",
        action: "BUY",
        qty: 1,
        exchange: "NSE",
        product: "CNC",
      }),
    });
    load().catch(() => {});
  };

  const chartinkUrl = urls?.chartink && key ? `${urls.chartink}?key=${encodeURIComponent(key)}` : urls?.chartink || "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Webhook & automation</h1>
        <p className="page-sub">
          Central test and activity log. Platform URLs live where you use them:{" "}
          <Link className="text-primary hover:underline" to="/watchlist">
            Watchlist
          </Link>{" "}
          (TradingView, ChartInk),{" "}
          <Link className="text-primary hover:underline" to="/strategies">
            Strategy
          </Link>{" "}
          (AmiBroker),{" "}
          <Link className="text-primary hover:underline" to="/settings">
            Settings
          </Link>{" "}
          (Python / scripts).
        </p>
      </div>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Test signal</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Fires a sample JSON payload to the Python webhook using <code className="text-primary">X-ProTrades-Key</code>{" "}
          (paper mode is respected server-side).
        </p>
        <button
          type="button"
          onClick={testFire}
          className="mt-4 rounded-md bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-fixed"
        >
          Test fire (Python sample)
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Chartink webhook</h2>
        <p className="text-xs text-on-surface-variant">
          Use this URL in Chartink alerts. Chartink can’t always set custom headers, so ProTrades supports auth via{" "}
          <code className="text-primary">?key=</code>.
        </p>

        <WebhookUrlBlock
          title="Chartink → ProTrades"
          description="Paste into Chartink Webhook URL. Sends BUY/SELL signals into the same risk + paper-trading pipeline."
          url={chartinkUrl}
          icon="bolt"
        />

        <div className="card-qe border border-outline-variant/10">
          <h3 className="font-headline text-sm font-semibold text-on-surface">Payload format</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            ProTrades expects <code className="text-primary">stocks</code> as a comma-separated list. Optional{" "}
            <code className="text-primary">trigger_prices</code> can be comma-separated too (same order).
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-surface-container p-3 text-[11px] text-on-surface">
            {CHARTINK_SAMPLE}
          </pre>
        </div>
      </section>

      <section>
        <h2 className="font-headline text-lg font-semibold text-on-surface">Live log</h2>
        <p className="page-sub">Recent webhook events across all sources</p>
        <div className="scroll-list-wrap mt-4">
          <table className="table-qe min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{l.timestamp}</td>
                  <td className="px-4 py-3 text-xs font-medium text-primary">{l.source}</td>
                  <td className="numeric px-4 py-3 text-xs">{l.symbol}</td>
                  <td className="px-4 py-3 text-xs">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
