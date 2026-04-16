import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items || []) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

export default function Intel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const d = await api("/api/intel/stream");
      setData(d);
    } catch (e) {
      setErr(e.message || "Failed to load intel feed");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const items = data?.items || [];
  const byType = useMemo(() => groupBy(items, (x) => x.type || "other"), [items]);

  const renderList = (list) => (
    <div className="mt-4 overflow-x-auto rounded-lg bg-surface-container">
      <table className="table-qe min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-outline-variant/10">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it, idx) => (
            <tr key={idx} className="border-b border-outline-variant/5">
              <td className="px-4 py-3 font-mono text-xs text-primary">{it.symbol}</td>
              <td className="px-4 py-3 text-xs">
                {it.url ? (
                  <a className="text-primary hover:underline" href={it.url} target="_blank" rel="noreferrer">
                    {it.title || "open"}
                  </a>
                ) : (
                  it.title || "—"
                )}
                {it.summary ? <div className="mt-1 max-w-2xl text-[11px] text-on-surface-variant">{it.summary}</div> : null}
              </td>
              <td className="px-4 py-3 text-xs text-on-surface-variant">{it.source || "—"}</td>
              <td className="px-4 py-3 text-xs text-on-surface-variant">{it.published_at || "—"}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-xs text-on-surface-variant" colSpan={4}>
                No items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Intel</h1>
          <p className="page-sub">Holdings + watchlist → corporate actions, news, and (optional) tweets</p>
        </div>
        <button
          type="button"
          onClick={() => load().catch(() => {})}
          className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && <div className="card-qe border border-tertiary-container/30 text-sm text-tertiary-container">{err}</div>}

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Corporate actions</h2>
        <p className="mt-1 text-xs text-on-surface-variant">Filtered to your holdings + watchlist (NSE feed best-effort).</p>
        {renderList(byType.get("corporate_action") || [])}
      </section>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">News</h2>
        <p className="mt-1 text-xs text-on-surface-variant">Google News RSS per symbol (no API key).</p>
        {renderList(byType.get("news") || [])}
      </section>

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Tweets (optional)</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Enabled only if you set <code className="text-primary">NITTER_BASE</code> on the server. Otherwise this section stays empty.
        </p>
        {renderList(byType.get("tweet") || [])}
      </section>
    </div>
  );
}

