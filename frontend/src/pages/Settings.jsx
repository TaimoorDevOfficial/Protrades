import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api.js";

export default function SettingsPage() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [claude, setClaude] = useState("");
  const [rkey, setRkey] = useState("");
  const [rsec, setRsec] = useState("");

  const load = () =>
    api("/api/settings").then((s) => {
      setData(s);
    });

  useEffect(() => {
    load().catch(() => {});
  }, []);

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
        <p className="page-sub">Keys and account settings</p>
      </div>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Anthropic and Rupeezy</h2>
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
          Vortex application id (optional)
          <input className="input-qe mt-1" value={rkey} onChange={(e) => setRkey(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm text-on-surface-variant">
          Vortex x-api-key (optional)
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
