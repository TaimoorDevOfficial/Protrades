import { useEffect, useState } from "react";
import { api } from "../api.js";

function badge(status) {
  const s = (status || "").toUpperCase();
  if (s.includes("COMPLETE") || s === "FILLED") return "text-secondary";
  if (s.includes("REJECT") || s.includes("CANCEL")) return "text-tertiary-container";
  return "text-primary";
}

export default function Orders() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api("/api/data/orders")
      .then((d) => setRows(d.orders || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Order book</h1>
        <p className="page-sub">Complete / rejected / pending</p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-surface-container">
        <table className="table-qe min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/10">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-mono text-xs">{o.order_id ?? o.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{o.symbol}</td>
                <td className="px-4 py-3">{o.side}</td>
                <td className="numeric px-4 py-3 text-right">{o.quantity}</td>
                <td className={`px-4 py-3 text-xs font-medium ${badge(o.status)}`}>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
