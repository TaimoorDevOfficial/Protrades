import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Webhooks() {
  const [key, setKey] = useState("");
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const s = await api("/api/settings");
    setKey(s.protrades_api_key || "");
    const l = await api("/api/logs?limit=30");
    setLogs(l);
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
