import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

function upper(s) {
  return String(s || "").trim().toUpperCase();
}

export default function Trade() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [symbol, setSymbol] = useState("RELIANCE");
  const [action, setAction] = useState("BUY");
  const [qty, setQty] = useState("1");
  const [exchange, setExchange] = useState("NSE");
  const [product, setProduct] = useState("CNC");
  const [ordertype, setOrdertype] = useState("MARKET");
  const [price, setPrice] = useState("");
  const [token, setToken] = useState("");

  const load = useCallback(() => api("/api/settings").then(setSettings), []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const place = async (e) => {
    e.preventDefault();
    setResult(null);
    const sym = upper(symbol);
    if (!sym) {
      setResult({ ok: false, msg: "Enter a symbol." });
      return;
    }
    setLoading(true);
    try {
      const body = {
        symbol: sym,
        action,
        qty: Number(qty) || 1,
        exchange,
        product,
        ordertype,
        price: price.trim() ? Number(price) : 0,
      };
      const t = token.trim();
      if (t) body.token = Number(t);

      const r = await api("/api/trade/place", { method: "POST", body: JSON.stringify(body) });
      if (!r || r.status !== "success") {
        throw new Error(r?.detail || "Rejected");
      }
      setResult({ ok: true, msg: r.detail || "OK", orderId: r.order_id });
    } catch (err) {
      setResult({ ok: false, msg: err?.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Trade</h1>
        <p className="page-sub">Manual order entry routed via Rupeezy/Vortex (risk + paper mode enforced)</p>
      </div>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Place order</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          If you’re trading F&amp;O symbols, you may need to pass the numeric <code className="text-primary">token</code>{" "}
          (from Rupeezy master.csv). Cash equities on NSE/BSE usually resolve automatically.
        </p>
        {settings?.risk?.paper_trading ? (
          <p className="mt-3 rounded-md border border-secondary/30 bg-secondary/10 px-4 py-2 text-xs font-medium text-secondary">
            Paper trading is ON — orders will be logged but not sent to the broker.
          </p>
        ) : null}

        <form onSubmit={place} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-on-surface-variant">
            Symbol
            <input className="input-qe mt-1" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </label>
          <label className="text-xs text-on-surface-variant">
            Action
            <select className="input-qe mt-1" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Quantity
            <input type="number" min={1} className="input-qe mt-1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="text-xs text-on-surface-variant">
            Exchange
            <select className="input-qe mt-1" value={exchange} onChange={(e) => setExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Product
            <select className="input-qe mt-1" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="CNC">CNC</option>
              <option value="MIS">MIS</option>
              <option value="NRML">NRML</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Order type
            <select className="input-qe mt-1" value={ordertype} onChange={(e) => setOrdertype(e.target.value)}>
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Limit price (optional)
            <input
              type="number"
              step="any"
              className="input-qe mt-1"
              placeholder="0 = market"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="text-xs text-on-surface-variant">
            Token (optional)
            <input
              className="input-qe mt-1"
              placeholder="e.g. 2885"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>

          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-gradient-to-br from-primary to-primary-container px-6 py-3 text-sm font-semibold text-on-primary-fixed disabled:opacity-50"
            >
              {loading ? "Placing…" : "Place order"}
            </button>
          </div>
        </form>

        {result && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              result.ok
                ? "border-secondary/40 bg-secondary/10 text-secondary"
                : "border-tertiary-container/40 bg-tertiary-container/10 text-tertiary-container"
            }`}
          >
            {result.ok ? (
              <>
                <p className="font-medium">Order accepted</p>
                <p className="mt-1 text-xs opacity-90">{result.msg}</p>
                {result.orderId != null && result.orderId !== "" && (
                  <p className="mt-1 font-mono text-xs">Order id: {result.orderId}</p>
                )}
              </>
            ) : (
              <p>{result.msg}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

