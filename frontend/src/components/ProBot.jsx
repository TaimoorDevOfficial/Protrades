import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api } from "../api";

const QUICK = [
  { label: "📊 Market Update", text: "Give me a concise Indian market update for today with sources." },
  { label: "🏢 Corporate Actions", text: "Corporate actions for my watchlist and holdings this week." },
  { label: "💰 My P&L", text: "Summarize my portfolio P&L contextually for ProTrades." },
];

export default function ProBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef = useRef(null);

  const scrollBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollBottom();
  }, [msgs, typing, open]);

  useEffect(() => {
    const openProbot = () => {
      setOpen(true);
      setUnread(0);
    };
    window.addEventListener("probot-open", openProbot);
    return () => window.removeEventListener("probot-open", openProbot);
  }, []);

  useEffect(() => {
    const tick = async () => {
      try {
        const st = await api("/api/probot/briefing-status");
        if (st.should_show_auto_briefing) {
          const prev = await api("/api/probot/morning-preview");
          setMsgs((m) => [
            ...m,
            { role: "assistant", content: prev.text, id: `brief-${Date.now()}` },
          ]);
          setUnread((u) => u + 1);
          await api("/api/probot/briefing/ack", { method: "POST" });
        }
      } catch {
        /* offline */
      }
    };
    const id = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(id);
  }, []);

  const send = useCallback(
    async (text) => {
      const t = text.trim();
      if (!t) return;
      const next = [...msgs, { role: "user", content: t, id: `u-${Date.now()}` }];
      setMsgs(next);
      setInput("");
      setTyping(true);
      try {
        const body = {
          session_id: "main",
          messages: next.map(({ role, content }) => ({ role, content })),
        };
        const res = await api("/api/probot/chat", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setMsgs((m) => [...m, { role: "assistant", content: res.reply, id: `a-${Date.now()}` }]);
      } catch (e) {
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: `ProBot error: ${e.message}`, id: `e-${Date.now()}` },
        ]);
      } finally {
        setTyping(false);
        setUnread(0);
      }
    },
    [msgs]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setUnread(0);
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed shadow-lg shadow-primary/30 ring-2 ring-primary/30"
        aria-label="Open ProBot"
      >
        <span className="text-lg font-bold tracking-tight">PB</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[min(100vw-2rem,420px)] flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container shadow-ambient">
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-high/40 px-4 py-3">
            <div>
              <p className="font-headline text-sm font-semibold text-primary">AI Alpha Assistant</p>
              <p className="text-xs text-on-surface-variant">ProTrades · Quant Edge</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-outline-variant/10 px-3 py-2">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => send(q.text)}
                className="rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs text-on-surface hover:border-primary/40"
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="max-h-[360px] space-y-3 overflow-y-auto px-3 py-3">
            {msgs.length === 0 && (
              <p className="text-sm text-on-surface-variant">
                Ask about markets, corporate actions, or your workflow.
              </p>
            )}
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-primary/10 text-on-surface"
                    : "mr-4 bg-surface-container-high/80 text-on-surface"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-2 text-on-surface-variant">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-surface-container-highest"
                      onClick={() => navigator.clipboard.writeText(m.content)}
                      title="Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-surface-container-highest" title="Good">
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1 hover:bg-surface-container-highest" title="Bad">
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-1 px-2">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "120ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: "240ms" }} />
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="border-t border-outline-variant/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <div className="flex gap-2">
              <input
                className="input-qe min-w-0 flex-1"
                placeholder="Ask ProBot…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-md bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-sm font-semibold text-on-primary-fixed hover:opacity-95"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
