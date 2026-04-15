import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api.js";
import WebhookUrlBlock from "../components/WebhookUrlBlock.jsx";
import { useWebhookUrls } from "../hooks/useWebhookUrls.js";

export default function SettingsPage() {
  const nav = useNavigate();
  const urls = useWebhookUrls();
  const [data, setData] = useState(null);
  const [claude, setClaude] = useState("");
  const [rkey, setRkey] = useState("");
  const [rsec, setRsec] = useState("");
  const [maxV, setMaxV] = useState(100000);
  const [wl, setWl] = useState("");
  const [loss, setLoss] = useState(5);
  const [paper, setPaper] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const load = () =>
    api("/api/settings").then((s) => {
      setData(s);
      setMaxV(s.risk?.max_order_value ?? 100000);
      setWl((s.risk?.symbol_whitelist || []).join(","));
      setLoss(s.risk?.daily_loss_limit_pct ?? 5);
      setPaper(!!s.risk?.paper_trading);
      setDisabled(!!s.risk?.webhooks_disabled);
    });

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const saveRisk = async () => {
    await api("/api/settings/risk", {
      method: "POST",
      body: JSON.stringify({
        max_order_value: Number(maxV),
        symbol_whitelist: wl
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        daily_loss_limit_pct: Number(loss),
        paper_trading: paper,
        webhooks_disabled: disabled,
      }),
    });
    load();
  };

  const saveKeys = async () => {
    await api("/api/settings/keys", {
      method: "POST",
      body: JSON.stringify({
        claude_key: claude || undefined,
        rupeezzy_api_key: rkey || undefined,
        rupeezzy_api_secret: rsec || undefined,
      }),
    });
    setClaude("");
    setRkey("");
    setRsec("");
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">API keys, risk, script webhooks, and guardrails</p>
      </div>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">ProTrades webhook key</h2>
        <p className="mt-1 text-xs text-on-surface-variant">Send as X-ProTrades-Key from scripts and integrations</p>
        <code className="mt-3 block break-all rounded-md bg-surface-container-low px-3 py-3 text-sm text-primary">
          {data?.protrades_api_key}
        </code>
      </section>

      <WebhookUrlBlock
        title="Python / custom HTTP"
        description="POST JSON signals from your own code, n8n, or server cron. Same key header as other webhooks."
        url={urls.python}
        icon="code"
      />

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Risk engine</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-on-surface-variant">
            Max order value (₹)
            <input type="number" className="input-qe mt-1" value={maxV} onChange={(e) => setMaxV(e.target.value)} />
          </label>
          <label className="text-sm text-on-surface-variant">
            Daily loss limit (%)
            <input type="number" className="input-qe mt-1" value={loss} onChange={(e) => setLoss(e.target.value)} />
          </label>
          <label className="text-sm text-on-surface-variant md:col-span-2">
            Symbol whitelist (comma separated, empty = allow all)
            <input className="input-qe mt-1" value={wl} onChange={(e) => setWl(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={paper} onChange={(e) => setPaper(e.target.checked)} className="rounded border-outline-variant/30" />
            Paper trading (log only)
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} className="rounded border-outline-variant/30" />
            Disable webhooks (manual override)
          </label>
        </div>
        <button
          type="button"
          onClick={() => saveRisk().catch(() => {})}
          className="mt-4 rounded-md bg-gradient-to-br from-primary to-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-fixed"
        >
          Save risk settings
        </button>
      </section>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Anthropic and Rupeezzy</h2>
        <p className="mt-1 text-xs text-on-surface-variant">Stored encrypted server-side</p>
        <label className="mt-3 block text-sm text-on-surface-variant">
          Claude API key
          <input
            type="password"
            className="input-qe mt-1"
            value={claude}
            onChange={(e) => setClaude(e.target.value)}
            placeholder={data?.has_claude_key ? "••••••••" : ""}
          />
        </label>
        <label className="mt-3 block text-sm text-on-surface-variant">
          Vortex application id (optional rotate)
          <input className="input-qe mt-1" value={rkey} onChange={(e) => setRkey(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm text-on-surface-variant">
          Vortex x-api-key (API secret from developer portal)
          <input type="password" className="input-qe mt-1" value={rsec} onChange={(e) => setRsec(e.target.value)} />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => saveKeys().catch(() => {})}
            className="rounded-md border border-outline-variant/25 px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high"
          >
            Save keys
          </button>
          <button
            type="button"
            onClick={() => {
              setToken("");
              nav("/login", { replace: true });
            }}
            className="rounded-md border border-tertiary-container/40 px-4 py-2 text-sm text-tertiary-container hover:bg-surface-container-high"
          >
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
