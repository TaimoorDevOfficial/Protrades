import { useEffect, useState } from "react";
import { api } from "../api.js";
import WebhookUrlBlock from "../components/WebhookUrlBlock.jsx";

const CHARTINK_SAMPLE = `{
  "stocks": "RELIANCE,TCS",
  "trigger_prices": "123.45,456.0",
  "action": "BUY"
}`;

export default function Chartink() {
  const [key, setKey] = useState("");
  const [urls, setUrls] = useState({});

  useEffect(() => {
    (async () => {
      const s = await api("/api/settings");
      setKey(s.protrades_api_key || "");
      const u = await api("/api/webhook-urls");
      setUrls(u || {});
    })().catch(() => {});
  }, []);

  const chartinkUrl = urls?.chartink && key ? `${urls.chartink}?key=${encodeURIComponent(key)}` : urls?.chartink || "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Chartink</h1>
        <p className="page-sub">Connect Chartink alerts → ProTrades webhook → Rupeezy/Vortex order pipeline.</p>
      </div>

      <section className="space-y-4">
        <WebhookUrlBlock
          title="Chartink Webhook URL"
          description="Paste this into Chartink alert webhook URL. Uses ?key= because some platforms can’t send custom headers."
          url={chartinkUrl}
          icon="bolt"
        />

        <div className="card-qe border border-outline-variant/10">
          <h2 className="font-headline text-sm font-semibold text-on-surface">Payload format</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            ProTrades expects <code className="text-primary">stocks</code> as a comma-separated list. Optional{" "}
            <code className="text-primary">trigger_prices</code> can be comma-separated too (same order).{" "}
            <code className="text-primary">action</code> should be BUY or SELL.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-surface-container p-3 text-[11px] text-on-surface">
            {CHARTINK_SAMPLE}
          </pre>
        </div>

        <div className="card-qe border border-outline-variant/10">
          <h2 className="font-headline text-sm font-semibold text-on-surface">What happens after the alert?</h2>
          <ul className="mt-2 space-y-2 text-sm text-on-surface-variant">
            <li>1) ProTrades normalizes the payload (one order per symbol).</li>
            <li>2) Risk checks run (market hours, max order value, whitelist, daily loss cutoff).</li>
            <li>3) If Paper Trading is ON, it logs only. Otherwise it routes the order to Rupeezy/Vortex.</li>
            <li>4) Result appears in the Webhooks log.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

