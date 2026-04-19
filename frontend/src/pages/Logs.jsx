import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Logs() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);

  const load = () => api(`/api/logs?limit=200&q=${encodeURIComponent(q)}`).then(setRows);

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Webhook event log</h1>
        <p className="page-sub">Searchable, source-tagged</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input-qe flex-1"
          placeholder="Search symbol, source, status…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          onClick={() => load().catch(() => {})}
          className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed sm:shrink-0"
        >
          Search
        </button>
      </div>
      <div className="scroll-list-wrap">
        <table className="table-qe min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/10">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 text-xs text-on-surface-variant">{l.timestamp}</td>
                <td className="px-4 py-3 text-xs font-medium text-primary">{l.source}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.symbol}</td>
                <td className="px-4 py-3">{l.action}</td>
                <td className="px-4 py-3 text-xs">{l.status}</td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-on-surface-variant">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
