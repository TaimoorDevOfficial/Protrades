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
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
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

  const loadBrief = async () => {
    setBriefLoading(true);
    try {
      const d = await api("/api/intel/brief");
      setBrief(d);
    } catch (e) {
      setErr(e.message || "Failed to load daily briefing");
    } finally {
      setBriefLoading(false);
    }
  };

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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadBrief().catch(() => {})}
            className="rounded-md border border-outline-variant/25 px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container-high disabled:opacity-50"
            disabled={briefLoading}
          >
            {briefLoading ? "Generating…" : "Generate daily briefing"}
          </button>
          <button
            type="button"
            onClick={() => load().catch(() => {})}
            className="rounded-md bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary-fixed disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh feed"}
          </button>
        </div>
      </div>

      {err && <div className="card-qe border border-tertiary-container/30 text-sm text-tertiary-container">{err}</div>}

      <section className="card-qe border border-outline-variant/10">
        <h2 className="font-headline text-sm font-semibold text-on-surface">Daily briefing</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          Rules-based summary from price moves, corporate actions and headline tone. No chatbot required.
        </p>
        {!brief && (
          <p className="mt-4 text-sm text-on-surface-variant">
            Click <strong>Generate daily briefing</strong> to create an actionable snapshot for holdings and watchlist.
          </p>
        )}
        {brief ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-surface-container px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">Summary</p>
              <div className="mt-2 space-y-1 text-sm text-on-surface">
                {(brief.summary || []).map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
                {(brief.summary || []).length === 0 && <p className="text-on-surface-variant">No high-priority changes detected.</p>}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(brief.cards || []).map((c) => (
                <div key={c.symbol} className="rounded-lg bg-surface-container px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold text-primary">{c.symbol}</p>
                    <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">
                      {c.held ? "Holding" : "Watchlist"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {c.price_move_pct != null && (
                      <span className={`rounded-full px-2 py-1 ${c.price_move_pct < 0 ? "bg-tertiary-container/15 text-tertiary-container" : "bg-secondary/15 text-secondary"}`}>
                        {Number(c.price_move_pct).toFixed(2)}%
                      </span>
                    )}
                    {c.tone && <span className="rounded-full bg-surface-container-high px-2 py-1 text-on-surface-variant">{c.tone}</span>}
                    {(c.events || []).map((e) => (
                      <span key={e} className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                        {e}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-on-surface">{c.action}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

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

