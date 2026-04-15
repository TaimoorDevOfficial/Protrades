import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MsIcon from "../components/MsIcon.jsx";
import { api, getToken, setToken } from "../api.js";

export default function Login() {
  const nav = useNavigate();
  const [clientCode, setClientCode] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [ssoUrl, setSsoUrl] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    let cancelled = false;
    api("/api/auth/status")
      .then((s) => {
        if (cancelled) return;
        if (s?.connected) nav("/dashboard", { replace: true });
        else setToken("");
      })
      .catch(() => {
        if (!cancelled) setToken("");
      });
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
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
      const u = await api(`/api/auth/oauth/rupeezzy/url`);
      if (!u.url) {
        setErr(u.message || "Vortex flow URL not configured");
        return;
      }
      window.open(u.url, "_blank", "noopener,noreferrer");
    } catch {
      setErr("Could not load Vortex flow URL");
    }
  };

  const completeSso = async (e) => {
    e.preventDefault();
    setErr("");
    const raw = ssoUrl.trim();
    if (!raw) {
      setErr("Paste the full redirect URL from the browser after flow.rupeezy.in login, or paste the token only.");
      return;
    }
    setSsoLoading(true);
    try {
      const res = await api("/api/auth/rupeezzy/session", {
        method: "POST",
        body: JSON.stringify(
          raw.startsWith("http://") || raw.startsWith("https://")
            ? { callback_url: raw }
            : { auth_code: raw }
        ),
      });
      setToken(res.access_token);
      nav("/dashboard", { replace: true });
    } catch (e2) {
      setErr(e2.message || "SSO login failed");
    } finally {
      setSsoLoading(false);
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

          <details className="rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-3 py-2 text-xs text-on-surface-variant">
            <summary className="cursor-pointer font-medium text-on-surface">Where do client code, password &amp; TOTP come from?</summary>
            <p className="mt-2 leading-relaxed">
              These are your <strong>Rupeezy / trading account</strong> credentials, not the Vortex app id.{" "}
              <strong>Client code</strong> is your broker user id (often shown on statements or the Rupeezy app).{" "}
              <strong>Password</strong> is your trading login password.{" "}
              <strong>TOTP</strong> is the 6-digit code from an authenticator app after you enable 2FA for trading in the Rupeezy / Vortex
              portal (same as logging in on the broker site).
            </p>
          </details>

          {err && <p className="mt-3 text-sm text-tertiary-container">{err}</p>}

          <form className="mt-4 space-y-4" onSubmit={submit}>
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
                type={showSecret ? "text" : "password"}
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

            <button type="submit" disabled={loading} className="btn-primary-qe disabled:opacity-50">
              {loading ? "Connecting…" : "Initialize terminal"}
              <MsIcon name="arrow_forward" className="text-sm" />
            </button>
          </form>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-outline">
              <span className="bg-surface-container px-3">Or explore</span>
            </div>
          </div>

          <button type="button" onClick={oauth} className="btn-secondary-qe w-full">
            <MsIcon name="account_balance" />
            Vortex browser login (flow.rupeezy.in)
          </button>

          <form className="mt-4 space-y-2" onSubmit={completeSso}>
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low/30 p-3">
              <p className="text-xs font-medium text-on-surface">After browser login — paste redirect link</p>
              <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
                If you did not configure a callback URL, Rupeezy may redirect to a page whose address bar contains the auth token.
                Copy the <strong>entire URL</strong> from the browser and paste it below (or paste only the token string).
              </p>
              <textarea
                className="input-qe mt-3 min-h-[88px] resize-y font-mono text-xs"
                placeholder="https://...?auth=... or paste token only"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={ssoLoading || loading}
                className="mt-2 w-full rounded-md border border-primary/40 bg-surface-container-high py-2.5 text-sm font-medium text-primary hover:bg-surface-container-highest disabled:opacity-50"
              >
                {ssoLoading ? "Completing…" : "Complete browser login"}
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={guestLogin}
            disabled={guestLoading || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-outline-variant/25 bg-surface-container-low py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <MsIcon name="science" className="text-lg" />
            {guestLoading ? "Opening demo…" : "Continue as guest"}
          </button>

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Uses Rupeezy Vortex (<code className="text-[10px]">vortex-api.rupeezy.in</code>). Your login token is saved in this
            browser (<code className="text-[10px]">localStorage</code>) until it expires. Guest mode uses sample data only.
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
