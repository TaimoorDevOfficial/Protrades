import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import MsIcon from "../components/MsIcon.jsx";
import ScrollFrameBackground from "../components/ScrollFrameBackground.jsx";
import { api, getToken } from "../api.js";

const RUPEEZY_REFERRAL_URL =
  "https://rupeezy.in/open-demat-account?referred_by=9Gcb9&clicked=true";

function Feature({ icon, title, children }) {
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-ambient">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MsIcon name={icon} className="text-2xl" />
        </div>
        <div className="min-w-0">
          <h3 className="font-headline text-base font-semibold text-on-surface">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{children}</p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const pageRef = useRef(null);

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
    <div
      ref={pageRef}
      className="relative min-h-screen bg-surface-container-lowest px-4 font-body text-on-surface selection:bg-primary selection:text-on-primary-fixed"
    >
      <ScrollFrameBackground triggerRef={pageRef} />

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

      <main className="relative z-10 mx-auto w-full max-w-6xl pb-16 pt-4">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
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
              ProTrades is a fast, modern dashboard built around the Rupeezy/Vortex API. Track your holdings, build a watchlist,
              spot corporate actions, automate entries with webhooks, and place manual orders — all in one clean workflow.
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
                  <span>Open your Rupeezy account using the referral link (opens on Rupeezy’s website).</span>
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
                  <span>Use the Intel/Market/Trade tabs for your daily workflow.</span>
                </li>
              </ol>
            </div>

            <div className="rounded-xl border border-outline-variant/15 bg-surface/30 p-5 text-xs text-on-surface-variant">
              Note: The Rupeezy account opening page is hosted by Rupeezy, so ProTrades can’t change its theme or buttons.
              This landing page is your branded entry point.
            </div>
          </section>
        </section>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">What you get in ProTrades</h2>
              <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                Built for speed and clarity. Everything is designed so you can scan, decide, and execute without jumping between tabs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => nav("/login")}
              className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed hover:opacity-95"
            >
              Get started → Login
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Feature icon="auto_awesome" title="Intel (news + signals)">
              One screen to see what matters for your holdings + watchlist. Corporate actions are filtered to your symbols so you don’t miss ex-dates.
            </Feature>
            <Feature icon="candlestick_chart" title="Market brief (snapshot)">
              Auto-generated snapshot from synced broker data: LTP, day % move vs open, and position P&amp;L (when available). Fast refresh and scrollable lists.
            </Feature>
            <Feature icon="visibility" title="Watchlist">
              Keep a clean symbol list that powers Intel and the market snapshot. Great for tracking setups without mixing with holdings.
            </Feature>
            <Feature icon="stacked_line_chart" title="Holdings">
              Your broker-synced holdings in a clean table. Designed to scale: show ~6–7 rows at a time with a scrollbar and sticky headers.
            </Feature>
            <Feature icon="swap_horiz" title="Trade (Rupeezy/Vortex)">
              Manual order entry routed via the Rupeezy/Vortex API. Risk rules and paper-trading settings are enforced server-side.
            </Feature>
            <Feature icon="bolt" title="Automation (Chartink & TradingView)">
              Send BUY/SELL signals into ProTrades through webhooks. Orders go through the same risk checks and can be logged in paper mode.
            </Feature>
          </div>
        </section>

        <section className="mt-14 rounded-3xl border border-outline-variant/30 bg-surface-container p-8 shadow-ambient">
          <div className="grid gap-6 lg:grid-cols-3 lg:items-center">
            <div className="lg:col-span-2">
              <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                Ready to open your Rupeezy account?
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Use the referral link to open your account. Then come back and log in to ProTrades to connect your session and start using the tools.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
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
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-outline-variant/10 py-8 text-center text-[11px] text-on-surface-variant">
        © 2026 ProTrades · Referral landing
      </footer>
    </div>
  );
}

