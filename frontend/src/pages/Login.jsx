import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MsIcon from "../components/MsIcon.jsx";
import { api, setToken } from "../api.js";

export default function Login() {
  const nav = useNavigate();
  const [applicationId, setApplicationId] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          application_id: applicationId,
          api_secret: apiSecret,
          client_code: clientCode,
          password,
          totp,
        }),
      });
      setToken(res.access_token);
      nav("/dashboard", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const oauth = async () => {
    try {
      const u = await api(`/api/auth/oauth/rupeezzy/url?application_id=${encodeURIComponent(applicationId)}`);
      if (!u.url) {
        setErr(u.message || "Set Application ID first");
        return;
      }
      window.open(u.url, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Could not load Vortex flow URL");
    }
  };

  const guestLogin = async () => {
    setErr("");
    setGuestLoading(true);
    try {
      const res = await api("/api/auth/guest", { method: "POST" });
      setToken(res.access_token);
      nav("/dashboard", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Guest login failed");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-container-lowest px-4 font-body text-on-surface selection:bg-primary selection:text-on-primary-fixed">
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

      <main className="relative z-10 w-full max-w-md px-2">
        <div className="glass-panel rounded-xl border border-outline-variant/15 p-8 shadow-ambient md:p-10">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-outline-variant/10 bg-surface-container-highest">
              <MsIcon name="precision_manufacturing" className="text-3xl text-primary" />
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">ProTrades</h1>
            <p className="mt-1 font-body text-xs uppercase tracking-[0.2em] text-on-surface-variant">
              Precision Trading Observatory
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label className="block px-1 text-xs font-medium text-on-surface-variant" htmlFor="app-id">
                Vortex application id
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MsIcon name="key" className="text-sm text-outline" />
                </div>
                <input
                  id="app-id"
                  className="input-qe pl-10"
                  autoComplete="off"
                  placeholder="From Vortex developer portal"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block px-1 text-xs font-medium text-on-surface-variant" htmlFor="api-secret">
                x-api-key (API secret)
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MsIcon name="lock" className="text-sm text-outline" />
                </div>
                <input
                  id="api-secret"
                  type={showSecret ? "text" : "password"}
                  className="input-qe pl-10 pr-10"
                  autoComplete="off"
                  placeholder="Server-side secret — never expose in frontend apps"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline hover:text-on-surface"
                  onClick={() => setShowSecret((s) => !s)}
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                >
                  <MsIcon name={showSecret ? "visibility_off" : "visibility"} className="text-sm" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block px-1 text-xs font-medium text-on-surface-variant" htmlFor="client-code">
                Client code
              </label>
              <input
                id="client-code"
                className="input-qe"
                autoComplete="username"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block px-1 text-xs font-medium text-on-surface-variant" htmlFor="pwd">
                Password
              </label>
              <input
                id="pwd"
                type="password"
                className="input-qe"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block px-1 text-xs font-medium text-on-surface-variant" htmlFor="totp">
                TOTP (authenticator)
              </label>
              <input
                id="totp"
                className="input-qe"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
              />
            </div>

            {err && <p className="text-sm text-tertiary-container">{err}</p>}

            <button type="submit" disabled={loading} className="btn-primary-qe disabled:opacity-50">
              {loading ? "Connecting…" : "Initialize terminal"}
              <MsIcon name="arrow_forward" className="text-sm" />
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/10" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-outline">
                <span className="bg-surface-container px-3">Or explore</span>
              </div>
            </div>

            <button type="button" onClick={oauth} className="btn-secondary-qe">
              <MsIcon name="account_balance" />
              Vortex browser login (flow.rupeezy.in)
            </button>

            <button
              type="button"
              onClick={guestLogin}
              disabled={guestLoading || loading}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-outline-variant/25 bg-surface-container-low py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              <MsIcon name="science" className="text-lg" />
              {guestLoading ? "Opening demo…" : "Continue as guest"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Uses Rupeezy Vortex (<code className="text-[10px]">vortex-api.rupeezy.in</code>). Session JWT is stored locally
            until expiry. Guest mode uses sample data only.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 rounded-full border border-outline-variant/10 bg-surface-container/50 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-tight text-on-surface-variant">
              Core engine: operational
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
