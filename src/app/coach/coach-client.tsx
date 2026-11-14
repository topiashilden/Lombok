"use client";

import { ArrowUp, ArrowUpRight, ReceiptText, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackLink, Group, TopBar, eur } from "@/components/solvo/ui";
import type { SpendingResult } from "@/lib/spending";

type Msg = { role: "user" | "coach"; text: string; checks?: SpendingResult[]; source?: "gemini" | "offline"; ms?: number };

const SUGGESTIONS = [
  "How much did I spend on taxis?",
  "Can I afford an €80 dinner this week?",
  "Where could I save the most?",
  "Paljonko käytin ravintoloihin kesällä?",
];

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
    <main className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-background/85 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <TopBar back={<BackLink href="/" label="Home" />} />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col">
            <div className="mt-3 mb-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-slab text-mint shadow-[0_10px_24px_-12px_rgba(12,53,36,0.8)]">
                <Sparkles className="size-6" aria-hidden />
              </span>
              <h1 className="mt-4 font-display text-[32px] leading-[1.05] font-semibold tracking-[-0.02em]">Ask Solvo</h1>
              <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
                Answers come from your own S-Pankki transactions. Solvo never moves money without your approval.
              </p>
            </div>
            <Group title="Try asking" className="mt-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] active:bg-muted [&+&]:border-t"
                >
                  <span className="flex-1">{s}</span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </Group>
          </div>
        ) : (
          <h1 className="sr-only">Ask Solvo</h1>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="ml-12 animate-in fade-in slide-in-from-bottom-2 self-end rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-snug text-primary-foreground duration-300"
            >
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-8 flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-2 self-start duration-300">
              <div className="rounded-[22px] rounded-bl-md bg-card px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
                {m.text}
              </div>
              {m.checks?.map((c, j) => (
                <div
                  key={j}
                  className="flex items-start gap-2.5 rounded-2xl border border-border/80 bg-card/50 px-3 py-2.5 text-[12px] leading-snug"
                >
                  <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        Checked {c.count} {c.count === 1 ? "transaction" : "transactions"}
                      </span>
                      <span className="num font-semibold">{eur.format(c.total)}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {c.filter}, {fmtMonth(c.from)} to {fmtMonth(c.to)}
                    </p>
                  </div>
                </div>
              ))}
              {m.source && (
                <span className="px-1 text-[11px] text-muted-foreground">
                  {m.source === "gemini"
                    ? `Answered by Gemini in ${((m.ms ?? 0) / 1000).toFixed(1)} s`
                    : "Offline answer, AI unavailable"}
                </span>
              )}
            </div>
          ),
        )}

        {busy && (
          <div
            className="flex h-11 w-[68px] items-center justify-center gap-1 self-start rounded-[22px] rounded-bl-md bg-card shadow-[0_1px_3px_rgba(15,42,31,0.06)]"
            aria-label="Solvo is thinking"
          >
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-1.5 animate-bounce rounded-full bg-primary/50"
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
        className="sticky bottom-0 z-10 bg-background/85 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
      >
        <div className="flex items-center gap-1.5 rounded-full bg-card p-1.5 pl-4 shadow-[0_1px_3px_rgba(15,42,31,0.08),0_8px_24px_-12px_rgba(15,42,31,0.18)] focus-within:ring-2 focus-within:ring-primary/30">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your money"
            aria-label="Ask about your money"
            enterKeyHint="send"
            className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:bg-muted disabled:text-muted-foreground"
          >
            <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </form>
    </main>
  );
}
