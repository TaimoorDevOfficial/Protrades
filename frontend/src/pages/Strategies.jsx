import { useEffect, useState } from "react";
import { api } from "../api.js";
import { copyText } from "../hooks/useWebhookUrls.js";
import { useWebhookUrls } from "../hooks/useWebhookUrls.js";
import { appendWebhookKey } from "../utils/webhookUrl.js";

const AMI_SAMPLE_JSON = `{
  "symbol": "RELIANCE",
  "action": "BUY",
  "qty": 1,
  "exchange": "NSE",
  "product": "CNC",
  "ordertype": "MARKET",
  "strategy": "my_scan_or_system"
}`;

const AMI_AFL_TEMPLATE = `// ProTrades — example: POST on your signal (throttle in real use)
if (LastValue(C > MA(C, 20)))
{
  url = "PASTE_YOUR_FULL_WEBHOOK_URL_HERE";
  headers = "Content-Type: application/json\\r\\n";
  body = "{ ""symbol"": ""RELIANCE"", ""action"": ""BUY"", ""qty"": 1, ""exchange"": ""NSE"", ""product"": ""CNC"", ""ordertype"": ""MARKET"", ""strategy"": ""afl_signal"" }";
  ih = InternetPostRequest(url, headers, body);
}`;

export default function Strategies() {
  const urls = useWebhookUrls();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("custom");
  const [apiKey, setApiKey] = useState("");

  const [sigSymbol, setSigSymbol] = useState("RELIANCE");
  const [sigAction, setSigAction] = useState("BUY");
  const [sigQty, setSigQty] = useState("1");
  const [sigExchange, setSigExchange] = useState("NSE");
  const [sigProduct, setSigProduct] = useState("CNC");
  const [sigOrdertype, setSigOrdertype] = useState("MARKET");
  const [sigStrategy, setSigStrategy] = useState("manual_ui");
  const [sigPrice, setSigPrice] = useState("");
  const [sigLoading, setSigLoading] = useState(false);
  const [sigResult, setSigResult] = useState(null);

  const load = () => api("/api/settings/strategies").then(setRows);

  useEffect(() => {
    load().catch(() => {});
    api("/api/settings")
      .then((s) => setApiKey(s.protrades_api_key || ""))
      .catch(() => setApiKey(""));
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    await api("/api/settings/strategies", {
      method: "POST",
      body: JSON.stringify({
        name,
        source: source === "amibroker" ? "amibroker" : "custom",
        symbol_list: [],
        is_active: true,
      }),
    });
    setName("");
    setSource("custom");
    load();
  };

  const sendSignalFromApp = async (e) => {
    e.preventDefault();
    setSigResult(null);
    if (!apiKey) {
      setSigResult({ ok: false, msg: "Load Settings once so your ProTrades API key is available." });
      return;
    }
    const sym = sigSymbol.trim().toUpperCase();
    if (!sym) {
      setSigResult({ ok: false, msg: "Enter a symbol." });
      return;
    }
    setSigLoading(true);
    try {
      const body = {
        symbol: sym,
        action: sigAction,
        qty: Number(sigQty) || 1,
        exchange: sigExchange,
        product: sigProduct,
        ordertype: sigOrdertype,
        strategy: sigStrategy.trim() || "manual_ui",
      };
      const pr = sigPrice.trim() ? Number(sigPrice) : 0;
      if (pr > 0) body.price = pr;

      const r = await fetch("/webhook/amibroker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ProTrades-Key": apiKey,
        },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text || r.statusText };
      }
      if (!r.ok) {
        const err = typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail || data);
        throw new Error(err || `HTTP ${r.status}`);
      }
      setSigResult({
        ok: true,
        msg: data.detail || data.status || "OK",
        orderId: data.order_id,
      });
    } catch (err) {
      setSigResult({ ok: false, msg: err.message || "Request failed" });
    } finally {
      setSigLoading(false);
    }
  };

  const abUrl = appendWebhookKey(urls.amibroker, apiKey);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Strategy builder</h1>
        <p className="page-sub">
          Fire BUY/SELL signals here — same pipeline as the AmiBroker webhook. No AmiBroker app or external site
          required for manual or test orders.
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-primary/25 bg-surface-container p-6 shadow-primary-glow">
        <h2 className="font-headline text-sm font-semibold text-primary">Send signal from ProTrades</h2>
        <p className="text-sm text-on-surface-variant">
          This uses the exact same backend route as an AmiBroker HTTP POST. Outcome follows your{" "}
          <strong className="text-on-surface">risk</strong> and <strong className="text-on-surface">paper trading</strong>{" "}
          settings. AmiBroker cannot run inside the browser — it is optional desktop software for automation; this form
          is the in-app equivalent.
        </p>

        <form onSubmit={sendSignalFromApp} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-on-surface-variant sm:col-span-1">
            Symbol
            <input className="input-qe mt-1" value={sigSymbol} onChange={(e) => setSigSymbol(e.target.value)} />
          </label>
          <label className="text-xs text-on-surface-variant">
            Action
            <select className="input-qe mt-1" value={sigAction} onChange={(e) => setSigAction(e.target.value)}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Quantity
            <input
              type="number"
              min={1}
              className="input-qe mt-1"
              value={sigQty}
              onChange={(e) => setSigQty(e.target.value)}
            />
          </label>
          <label className="text-xs text-on-surface-variant">
            Exchange
            <select className="input-qe mt-1" value={sigExchange} onChange={(e) => setSigExchange(e.target.value)}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="NFO">NFO</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Product
            <select className="input-qe mt-1" value={sigProduct} onChange={(e) => setSigProduct(e.target.value)}>
              <option value="CNC">CNC</option>
              <option value="MIS">MIS</option>
              <option value="NRML">NRML</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant">
            Order type
            <select className="input-qe mt-1" value={sigOrdertype} onChange={(e) => setSigOrdertype(e.target.value)}>
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </label>
          <label className="text-xs text-on-surface-variant sm:col-span-2">
            Strategy label (logged)
            <input className="input-qe mt-1" value={sigStrategy} onChange={(e) => setSigStrategy(e.target.value)} />
          </label>
          <label className="text-xs text-on-surface-variant">
            Limit price (optional)
            <input
              type="number"
              step="any"
              className="input-qe mt-1"
              placeholder="0 = market"
              value={sigPrice}
              onChange={(e) => setSigPrice(e.target.value)}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={sigLoading}
              className="rounded-md bg-gradient-to-br from-primary to-primary-container px-6 py-3 text-sm font-semibold text-on-primary-fixed disabled:opacity-50"
            >
              {sigLoading ? "Sending…" : "Send signal"}
            </button>
          </div>
        </form>

        {sigResult && (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              sigResult.ok
                ? "border-secondary/40 bg-secondary/10 text-secondary"
                : "border-tertiary-container/40 bg-tertiary-container/10 text-tertiary-container"
            }`}
          >
            {sigResult.ok ? (
              <>
                <p className="font-medium">Signal accepted</p>
                <p className="mt-1 text-xs opacity-90">{sigResult.msg}</p>
                {sigResult.orderId != null && sigResult.orderId !== "" && (
                  <p className="mt-1 font-mono text-xs">Order id: {sigResult.orderId}</p>
                )}
              </>
            ) : (
              <p>{sigResult.msg}</p>
            )}
          </div>
        )}
      </section>

      <details className="group rounded-lg border border-outline-variant/10 bg-surface-container p-4 open:border-outline-variant/20">
        <summary className="cursor-pointer font-headline text-sm font-semibold text-on-surface marker:text-primary">
          Optional: automate from AmiBroker on your PC
        </summary>
        <div className="mt-4 space-y-4 text-sm text-on-surface-variant">
          <p>
            For <strong className="text-on-surface">live/historical data</strong> inside AmiBroker, use the{" "}
            <strong className="text-on-surface">OpenAlgo AmiBroker Data Plugin</strong> in{" "}
            <code className="text-primary">OpenAlgoPlugin-master/</code> (build <code className="text-primary">OpenAlgo.dll</code>
            , point it at a running <code className="text-primary">openalgo-main</code> server). That is separate from
            ProTrades; see the repo root README.
          </p>
          <p>
            If you use the <strong className="text-on-surface">AmiBroker Windows app</strong>, it can POST the same JSON
            to your public webhook URL when a scan or system fires — you do not need to open amibroker.com; the software
            runs locally.
          </p>
          {!apiKey && (
            <p className="text-tertiary-container">
              Open Settings while logged in so your API key loads for the URL below.
            </p>
          )}
          <div className="space-y-2 rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Webhook URL</p>
            <code className="block break-all rounded-md bg-surface-container px-3 py-2 text-[11px] text-primary">
              {abUrl || urls.amibroker || "—"}
            </code>
            <button
              type="button"
              disabled={!abUrl}
              onClick={() => copyText(abUrl)}
              className="rounded-md border border-outline-variant/25 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            >
              Copy URL
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">JSON sample</p>
            <pre className="overflow-x-auto rounded-md bg-surface-container p-3 text-[11px] text-on-surface">
              {AMI_SAMPLE_JSON}
            </pre>
            <button
              type="button"
              onClick={() => copyText(AMI_SAMPLE_JSON)}
              className="rounded-md border border-outline-variant/25 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
            >
              Copy JSON
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-outline-variant/10 bg-surface-container-low p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">AFL sketch (AmiBroker 6.4+)</p>
            <pre className="max-h-40 overflow-auto rounded-md bg-surface-container p-3 text-[10px] text-on-surface">
              {AMI_AFL_TEMPLATE}
            </pre>
            <button
              type="button"
              onClick={() => copyText(AMI_AFL_TEMPLATE)}
              className="rounded-md border border-outline-variant/25 px-3 py-1.5 text-xs text-on-surface hover:bg-surface-container-high"
            >
              Copy AFL
            </button>
          </div>
        </div>
      </details>

      <section className="space-y-4">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Strategy list</h2>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          <input
            className="input-qe min-w-[200px] flex-1"
            placeholder="Strategy name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="flex flex-col text-xs text-on-surface-variant md:min-w-[160px]">
            Source
            <select className="input-qe mt-1" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="custom">Custom</option>
              <option value="amibroker">AmiBroker</option>
            </select>
          </label>
          <button
            type="button"
            onClick={add}
            className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed md:self-end"
          >
            Add strategy
          </button>
        </div>
        <div className="scroll-card-list">
          <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg bg-surface-container p-4">
              <div className="flex items-center justify-between">
                <p className="font-headline font-semibold text-on-surface">{r.name}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.is_active ? "bg-secondary/15 text-secondary" : "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {r.is_active ? "Active" : "Off"}
                </span>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                Source: <span className="text-primary">{r.source}</span>
              </p>
            </div>
          ))}
          </div>
        </div>
      </section>
    </div>
  );
}
