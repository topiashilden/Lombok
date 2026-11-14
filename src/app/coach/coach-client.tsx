"use client";

import { ArrowUp, ArrowUpRight, Check, GraduationCap, ReceiptText, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LearnPack } from "@/components/learn/learn-pack";
import { BackButton, Group, TopBar, eur } from "@/components/solvo/ui";
import { PACK_IDS, PACK_META, getPack, packFromText, type LearnContext, type PackId } from "@/lib/learn";
import { useLearnProgress } from "@/lib/learn-store";
import type { SpendingResult } from "@/lib/spending";

type Msg = {
  role: "user" | "coach";
  text: string;
  checks?: SpendingResult[];
  source?: "gemini" | "offline";
  ms?: number;
  pack?: PackId; // a learning pack, played inside the chat
};

const SUGGESTIONS = [
  "How much did I spend on taxis?",
  "Can I afford an €80 dinner this week?",
  "Where could I save the most?",
  "Paljonko käytin ravintoloihin kesällä?",
];

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const fmtMonth = (iso: string) => monthFmt.format(new Date(`${iso}T00:00:00Z`));

export function CoachClient({ learn }: { learn: LearnContext }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const progress = useLearnProgress();

  function openPack(id: PackId, asked?: string) {
    const p = getPack(id, learn);
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", text: asked ?? `Teach me: ${p.title}` },
      { role: "coach", text: p.intro, pack: id },
    ]);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const packId = packFromText(q);
    if (packId) return openPack(packId, q);
    const history: Msg[] = [...messages, { role: "user", text: q }];
    setMessages(history);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Learning packs stay in the browser; the coach only sees the conversation text.
        body: JSON.stringify({ messages: history.filter((m) => !m.pack).map(({ role, text }) => ({ role, text })) }),
      });
      const d = await res.json();
      setMessages([...history, { role: "coach", text: d.answer ?? "Sorry, something went wrong.", checks: d.checks, source: d.source, ms: d.ms }]);
    } catch {
      setMessages([...history, { role: "coach", text: "I couldn't connect. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  // A question can arrive from the home page as /coach?q=..., and a learning pack as /coach?learn=fees.
  // The page stays mounted (hidden) between visits, so the parameter is removed once handled, and the effect
  // runs again each time the page is shown.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const l = params.get("learn") as PackId | null;
    if (!q && !l) return;
    window.history.replaceState(null, "", "/coach");
    if (l && PACK_IDS.includes(l)) setTimeout(() => openPack(l), 0);
    else if (q) setTimeout(() => void ask(q), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  return (
    <main className="flex min-h-dvh flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-background/85 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
        {/* Once a pack or question is open, a way back to the start screen with the packs and suggestions. */}
        <TopBar
          back={
            messages.length > 0 ? (
              <BackButton
                label="Start"
                onClick={() => {
                  setMessages([]);
                  setInput("");
                  window.scrollTo({ top: 0 });
                }}
              />
            ) : undefined
          }
        />
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
            <Group
              title="Learn with your own numbers"
              aside={`${PACK_IDS.filter((id) => progress.done[id]).length} of ${PACK_IDS.length} done`}
              className="mt-0"
            >
              {PACK_META.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPack(p.id)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left active:bg-muted [&+&]:border-t"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${progress.done[p.id] ? "bg-primary text-white" : "bg-accent text-primary"}`}
                  >
                    {progress.done[p.id] ? <Check className="size-[18px]" strokeWidth={2.75} aria-hidden /> : <GraduationCap className="size-[18px]" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-medium">{p.title}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {progress.done[p.id] ? "Done. Tap to go through it again" : `${p.minutes} min, a quiz and your own numbers`}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </Group>
            <Group title="Try asking">
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
            <div
              key={i}
              className={`flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-2 duration-300 ${m.pack ? "self-stretch [&>div:first-child]:mr-8 [&>div:first-child]:self-start" : "mr-8 self-start"}`}
            >
              <div className="rounded-[22px] rounded-bl-md bg-card px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
                {m.text}
              </div>
              {m.pack && <LearnPack id={m.pack} ctx={learn} onAsk={(q) => void ask(q)} onOpen={(id) => openPack(id)} />}
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
        className="sticky bottom-0 z-10 bg-background/85 px-4 pt-2 pb-[calc(0.75rem+var(--tabbar-h))] backdrop-blur-xl"
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
