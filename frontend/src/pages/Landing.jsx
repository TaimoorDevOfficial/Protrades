import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MsIcon from "../components/MsIcon.jsx";
import { api, getToken } from "../api.js";

const RUPEEZY_REFERRAL_URL =
  "https://rupeezy.in/open-demat-account?referred_by=9Gcb9&clicked=true";

export default function Landing() {
  const nav = useNavigate();

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    api("/api/auth/status")
      .then((s) => {
        if (s?.connected) nav("/intel", { replace: true });
      })
      .catch(() => {});
  }, [nav]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-container-lowest px-4 font-body text-on-surface selection:bg-primary selection:text-on-primary-fixed">
      <div className="trading-pattern-bg pointer-events-none absolute inset-0 z-0 opacity-40" />
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden opacity-[0.12]">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 400">
          <path
            d="M0,350 L100,320 L200,360 L300,280 L400,310 L500,240 L600,260 L700,180 L800,220 L900,120 L1000,150"
            fill="none"
            stroke="#A4E6FF"
            strokeWidth="2"
          />
          <path
            d="M0,380 L150,340 L300,370 L450,290 L600,330 L750,210 L900,250 L1000,180"
            fill="none"
            opacity="0.5"
            stroke="#44E092"
            strokeDasharray="8 4"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container">
            <MsIcon name="query_stats" className="text-on-primary-fixed text-2xl" />
          </div>
          <div>
            <p className="font-headline text-lg font-bold leading-none text-primary">ProTrades</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/70">
              Precision Trading
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/login")}
            className="rounded-md border border-outline-variant/20 bg-surface/40 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Login
          </button>
          <a
            href={RUPEEZY_REFERRAL_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-xs font-semibold text-on-primary-fixed hover:opacity-95"
          >
            Open Rupeezy account
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-8 pb-16 pt-4 lg:grid-cols-2 lg:items-center">
        <section className="space-y-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface/30 px-3 py-1 text-[11px] font-medium text-on-surface-variant">
              <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
              Rupeezy partner onboarding
            </p>
            <h1 className="mt-4 font-headline text-4xl font-bold tracking-tight text-on-surface md:text-5xl">
              Open a Rupeezy Demat + Trading account.
              <span className="block text-primary">Then trade smarter with ProTrades.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm text-on-surface-variant md:text-base">
              Use my referral link to open your Rupeezy account. After you’re set up, log into ProTrades to see holdings,
              watchlist intel, corporate actions, and place orders through the Rupeezy/Vortex API.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={RUPEEZY_REFERRAL_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary-qe w-auto px-6"
            >
              <MsIcon name="person_add" className="text-xl" />
              Open Rupeezy account
            </a>
            <button type="button" onClick={() => nav("/login")} className="btn-secondary-qe w-auto px-6">
              <MsIcon name="login" className="text-xl" />
              Login to ProTrades
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="glass-panel rounded-xl border border-outline-variant/15 p-5">
              <p className="text-xs font-semibold text-primary">Portfolio view</p>
              <p className="mt-1 text-sm text-on-surface-variant">Holdings, P&amp;L, and day change from synced Rupeezy data.</p>
            </div>
            <div className="glass-panel rounded-xl border border-outline-variant/15 p-5">
              <p className="text-xs font-semibold text-primary">Corporate actions</p>
              <p className="mt-1 text-sm text-on-surface-variant">Ex-date and record dates filtered to your symbols.</p>
            </div>
            <div className="glass-panel rounded-xl border border-outline-variant/15 p-5">
              <p className="text-xs font-semibold text-primary">Automation</p>
              <p className="mt-1 text-sm text-on-surface-variant">Chartink &amp; TradingView webhooks supported.</p>
            </div>
            <div className="glass-panel rounded-xl border border-outline-variant/15 p-5">
              <p className="text-xs font-semibold text-primary">Manual trade</p>
              <p className="mt-1 text-sm text-on-surface-variant">Place orders via the Rupeezy/Vortex API (risk &amp; paper mode apply).</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="glass-panel rounded-2xl border border-outline-variant/15 p-6 shadow-ambient">
            <p className="text-xs font-semibold text-on-surface">How it works</p>
            <ol className="mt-4 space-y-3 text-sm text-on-surface-variant">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  1
                </span>
                <span>
                  Open your Rupeezy account using the referral link (opens on Rupeezy’s website).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  2
                </span>
                <span>
                  Come back and <strong className="text-on-surface">log in to ProTrades</strong> to connect your broker session.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  3
                </span>
                <span>
                  Use the Intel/Market/Trade tabs for your daily workflow.
                </span>
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-outline-variant/15 bg-surface/30 p-5 text-xs text-on-surface-variant">
            Note: The Rupeezy account opening page is hosted by Rupeezy, so ProTrades can’t change its theme or buttons.
            This landing page is your branded entry point.
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-outline-variant/10 py-8 text-center text-[11px] text-on-surface-variant">
        © 2026 ProTrades · Referral landing
      </footer>
    </div>
  );
}

