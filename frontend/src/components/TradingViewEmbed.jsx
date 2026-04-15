import { useEffect, useRef } from "react";

const TV_SCRIPT = "https://s3.tradingview.com/tv.js";

let scriptPromise = null;

function loadTradingViewScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.TradingView) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${TV_SCRIPT}"]`);
      if (existing) {
        if (window.TradingView) resolve();
        else {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("TradingView script error")));
        }
        return;
      }
      const s = document.createElement("script");
      s.src = TV_SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("TradingView script failed to load"));
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/** Build TradingView symbol e.g. NSE + RELIANCE → NSE:RELIANCE */
export function formatTvSymbol(exchange, symbol) {
  const sym = (symbol || "").trim().toUpperCase();
  if (!sym) return "NSE:RELIANCE";
  if (sym.includes(":")) return sym;
  const ex = (exchange || "NSE").toUpperCase();
  return `${ex}:${sym}`;
}

/**
 * Embedded chart from TradingView’s free widget (their data, their UI).
 * Alerts/automation still use the webhook URL — this is view-only in-app.
 */
export default function TradingViewEmbed({ symbol, className = "" }) {
  const containerId = useRef(`tv_${Math.random().toString(36).slice(2, 12)}`).current;
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el || !symbol) return undefined;

    loadTradingViewScript()
      .then(() => {
        if (cancelled || !el || !window.TradingView) return;
        el.innerHTML = "";
        // TradingView global constructor
        // eslint-disable-next-line new-cap -- TradingView API
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval: "60",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          allow_symbol_change: true,
          container_id: containerId,
          hide_top_toolbar: false,
          details: false,
          hotlist: false,
          calendar: false,
        });
      })
      .catch(() => {
        if (!cancelled && el) {
          el.innerHTML =
            '<p class="p-4 text-sm text-on-surface-variant">Chart could not load (network or script blocked). Try again or open tradingview.com.</p>';
        }
      });

    return () => {
      cancelled = true;
      if (el) el.innerHTML = "";
    };
  }, [symbol, containerId]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-container ${className}`.trim()}
    >
      <div
        ref={containerRef}
        id={containerId}
        className="h-[min(520px,55vh)] w-full min-h-[380px]"
      />
      <p className="border-t border-outline-variant/10 px-3 py-2 text-[10px] leading-relaxed text-on-surface-variant">
        Chart powered by TradingView (free widget). Symbol search inside the chart is from TradingView. Automated
        orders still require a webhook alert configured below.
      </p>
    </div>
  );
}
