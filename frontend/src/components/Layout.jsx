import { NavLink, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import MsIcon from "./MsIcon.jsx";
import ProBot from "./ProBot.jsx";
import { api, setToken } from "../api.js";
import { useSessionData } from "../context/SessionDataContext.jsx";

function earliestSessionEndIso(status) {
  const times = [];
  if (status?.jwt_expires_at) times.push(new Date(status.jwt_expires_at).getTime());
  if (status?.expires_at) times.push(new Date(status.expires_at).getTime());
  if (!times.length) return null;
  return new Date(Math.min(...times)).toISOString();
}

function formatTimeLeft(iso) {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((end - Date.now()) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

const nav = [
  { to: "/intel", label: "Intel", icon: "auto_awesome" },
  { to: "/market", label: "Market", icon: "candlestick_chart" },
  { to: "/watchlist", label: "Watchlist", icon: "visibility" },
  { to: "/holdings", label: "Holdings", icon: "stacked_line_chart" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function openProbot() {
  window.dispatchEvent(new CustomEvent("probot-open"));
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { clearAll: clearSessionTabCache } = useSessionData();
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);

  const loadStatus = useCallback(() => {
    api("/api/auth/status")
      .then((s) => {
        setConnected(!!s.connected);
        setStatus(s);
      })
      .catch(() => {
        setConnected(false);
        setStatus(null);
      });
  }, []);

  useEffect(() => {
    loadStatus();
    const tick = setInterval(loadStatus, 30_000);
    const id = setInterval(() => {
      api("/api/auth/refresh", { method: "POST" })
        .then(() => loadStatus())
        .catch(() => {});
    }, 45 * 60 * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(id);
    };
  }, [loadStatus]);

  const sessionEndIso = useMemo(() => earliestSessionEndIso(status), [status]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sessionEndIso) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sessionEndIso]);
  const timeLeft = useMemo(() => formatTimeLeft(sessionEndIso), [sessionEndIso, tick]);
  const isGuest = status?.is_guest || status?.is_guest_token;
  const demoMode = status?.demo_mode;

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* still clear local session */
    }
    clearSessionTabCache();
    setToken("");
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
      isActive
        ? "bg-surface-container-highest font-semibold text-primary"
        : "text-on-surface/70 hover:bg-surface-container hover:text-on-surface"
    }`;

  return (
    <div className="min-h-screen bg-surface-container-lowest">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col bg-surface font-headline text-sm tracking-tight md:flex">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container">
              <MsIcon name="query_stats" className="text-on-primary-fixed text-xl" />
            </div>
            <div>
              <h1 className="font-headline text-xl font-bold leading-none text-primary">ProTrades</h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
                Precision Trading
              </p>
            </div>
          </div>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-4">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              <MsIcon name={n.icon} className="text-[22px] opacity-90" />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-outline-variant/10 p-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-xs font-bold text-primary">
              PT
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-on-surface">Session</p>
              <p className="flex items-center gap-1.5 truncate text-[10px] text-on-surface-variant">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${connected ? "bg-secondary" : "bg-outline-variant"}`}
                />
                {!connected
                  ? "Not signed in"
                  : demoMode
                    ? "Demo API (mock data)"
                    : isGuest
                      ? "Guest demo data"
                      : "Broker linked"}
              </p>
              {connected && timeLeft && (
                <p className="mt-1 truncate text-[10px] tabular-nums text-on-surface-variant/90">
                  Ends in ~{timeLeft}
                </p>
              )}
              {connected && !timeLeft && !isGuest && (
                <p className="mt-1 truncate text-[10px] text-on-surface-variant/80">No broker expiry set</p>
              )}
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-2 text-left text-[11px] font-medium text-primary hover:underline"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile: session + logout (sidebar is hidden) */}
      <div className="fixed bottom-4 left-4 z-30 flex max-w-[min(100vw-8rem,16rem)] items-start gap-2 rounded-lg border border-outline-variant/15 bg-surface/95 px-3 py-2 shadow-ambient backdrop-blur md:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-bold text-primary">
          PT
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium text-on-surface">
            {!connected ? "Offline" : demoMode ? "Mock" : isGuest ? "Guest" : "Live"}
          </p>
          {connected && timeLeft && (
            <p className="truncate text-[9px] tabular-nums text-on-surface-variant">~{timeLeft} left</p>
          )}
          <button type="button" onClick={() => void logout()} className="text-[10px] font-medium text-primary hover:underline">
            Log out
          </button>
        </div>
      </div>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant/10 bg-surface/85 px-4 backdrop-blur-xl shadow-ambient md:left-64 md:pl-6 md:pr-6">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="font-headline text-lg font-bold text-primary md:hidden">ProTrades</div>
          <div className="hidden items-center gap-6 text-xs font-medium tabular-nums text-on-surface md:flex">
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant/60">NIFTY</span>
              <span className="text-secondary">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant/60">Engine</span>
              <span className="text-primary">{connected ? "Operational" : "Standby"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-1 rounded-full border border-outline-variant/10 bg-surface-container-high/50 px-3 py-1.5 sm:flex">
            <MsIcon name="search" className="text-lg text-on-surface-variant/60" />
            <input
              type="search"
              readOnly
              className="w-36 border-none bg-transparent text-xs text-on-surface placeholder:text-outline/50 focus:ring-0 lg:w-48"
              placeholder="Search instruments…"
            />
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface transition-opacity hover:opacity-90"
            aria-label="Notifications"
          >
            <MsIcon name="notifications" className="text-[22px]" />
          </button>
          <button
            type="button"
            onClick={openProbot}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-primary transition-opacity hover:opacity-90"
            aria-label="Open AI assistant"
          >
            <MsIcon name="smart_toy" className="text-[22px]" />
          </button>
        </div>
      </header>

      <div className="flex min-h-screen flex-col md:pl-64">
        <div className="flex min-h-screen flex-1 flex-col pt-16">
          <header className="border-b border-outline-variant/10 bg-surface/90 px-3 py-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-full px-3 py-1.5 ${
                      isActive
                        ? "bg-surface-container-highest font-medium text-primary"
                        : "bg-surface-container text-on-surface-variant"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            {children}
          </main>
          <footer className="border-t border-outline-variant/10 px-4 py-4 text-center text-[10px] text-on-surface-variant md:px-8">
            © 2026 ProTrades · Quant Edge design system
          </footer>
        </div>
      </div>
      <ProBot />
    </div>
  );
}
