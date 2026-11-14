"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SpendingResult } from "@/lib/spending";

type Msg = { role: "user" | "coach"; text: string; checks?: SpendingResult[]; source?: "gemini" | "offline"; ms?: number };

const SUGGESTIONS = [
  "How much did I spend on taxis?",
  "Can I afford an €80 dinner this week?",
  "Where could I save the most?",
  "Paljonko käytin ravintoloihin kesällä?",
];

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtMonth = (iso: string) => monthFmt.format(new Date(`${iso}T00:00:00Z`));

export function CoachClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", text: q }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, text }) => ({ role, text })) }),
      });
      const d = await res.json();
      setMessages([...history, { role: "coach", text: d.answer ?? "Sorry, something went wrong.", checks: d.checks, source: d.source, ms: d.ms }]);
    } catch {
      setMessages([...history, { role: "coach", text: "I couldn't connect. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  // A question can arrive from the home page as /coach?q=...
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setTimeout(() => void ask(q), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground">
          ← Home
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/solvo-logo.png" alt="Solvo" className="h-5 w-auto" />
      </header>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ask Solvo</h1>
        <p className="text-sm text-muted-foreground">
          Answers come from your own S-Pankki transactions. Solvo never moves money without your approval.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Try asking</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="rounded-xl border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-10 self-end rounded-2xl rounded-br-sm bg-emerald-800 px-3.5 py-2 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-6 flex flex-col gap-1.5 self-start">
              <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed">{m.text}</div>
              {m.checks?.map((c, j) => (
                <div key={j} className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="rounded-full border px-2 py-0.5">
                    Checked {c.count} {c.count === 1 ? "transaction" : "transactions"}: {c.filter}
                  </span>
                  <span className="rounded-full border px-2 py-0.5">
                    {fmtMonth(c.from)} – {fmtMonth(c.to)}
                  </span>
                  <span className="rounded-full border px-2 py-0.5 tabular-nums">{eur.format(c.total)}</span>
                </div>
              ))}
              {m.source && (
                <span className="text-[11px] text-muted-foreground">
                  {m.source === "gemini"
                    ? `Gemini · ${((m.ms ?? 0) / 1000).toFixed(1)} s`
                    : "Offline answer (AI unavailable)"}
                </span>
              )}
            </div>
          ),
        )}

        {busy && (
          <div className="flex w-16 items-center justify-center gap-1 self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your money…"
          className="h-11 flex-1 rounded-xl border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-emerald-700/40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-11 rounded-xl bg-emerald-800 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </main>
  );
}
