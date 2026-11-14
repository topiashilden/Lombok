"use client";

// "How Solvo found these prices": the market agent's last run, its sources, and a "Run now" button.
// The agent runs on Solvo's side for everyone (nightly in production). Running it here is for the demo:
// the steps stream in live, and if anything fails the saved run stays in place.
import { useState } from "react";
import { Check, ChevronDown, Globe, Loader2, RefreshCw, X } from "lucide-react";
import { Chip, secondaryButton } from "@/components/solvo/ui";
import type { ReactNode } from "react";
import { domainOf } from "@/lib/market";
import type { AgentDb, AgentEvent, AgentStep } from "@/lib/market-agent-events";

const STEPS: { step: AgentStep; label: string }[] = [
  { step: "search", label: "Search the market" },
  { step: "read", label: "Read prices from the pages" },
  { step: "check", label: "Check and clean" },
  { step: "segment", label: "Rank per customer group" },
];

type StepState = { status: "waiting" | "running" | "done" | "failed"; detail?: string };

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Helsinki",
});

const NOUN: Record<AgentDb["agent"], { offers: string; sellers: string }> = {
  electricity: { offers: "offers", sellers: "suppliers" },
  telecom: { offers: "plans", sellers: "operators" },
};

/** forYou: what the agent's result means for this customer, e.g. their group and consumption. */
export function MarketAgentCard<D extends AgentDb>(props: { db: D; forYou: ReactNode; onResult: (db: D) => void }) {
  const { db } = props;
  const noun = NOUN[db.agent];
  const [steps, setSteps] = useState<Record<AgentStep, StepState> | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const sellers = new Set(db.offers.map((o) => ("supplier" in o ? o.supplier : o.operator))).size;

  async function run() {
    setRunning(true);
    setNote(null);
    setSteps(Object.fromEntries(STEPS.map((s) => [s.step, { status: "waiting" }])) as Record<AgentStep, StepState>);
    try {
      const res = await fetch("/api/market-agent", { method: "POST", body: JSON.stringify({ agent: db.agent }) });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as AgentEvent;
          if (e.type === "step") setSteps((prev) => (prev ? { ...prev, [e.step]: { status: e.status, detail: e.detail } } : prev));
          else {
            if (e.live) props.onResult(e.db as D);
            else setNote(`Showing the saved run from ${timeFmt.format(new Date(e.db.ranAt))}.`);
          }
        }
      }
    } catch {
      setNote("Couldn't reach the agent. Showing the saved run.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-7 rounded-2xl bg-card p-4 shadow-[0_1px_0_rgba(15,42,31,0.04),0_1px_3px_rgba(15,42,31,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">How Solvo found these prices</h2>
        <Chip tone="green">
          <Globe className="size-3" aria-hidden />
          {timeFmt.format(new Date(db.ranAt))}
        </Chip>
      </div>
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
        Solvo&apos;s market agent compares prices for everyone, every night. It last checked{" "}
        <span className="num font-medium text-foreground">
          {db.offers.length} {noun.offers}
        </span>{" "}
        from{" "}
        <span className="num font-medium text-foreground">
          {sellers} {noun.sellers}
        </span>{" "}
        on {db.pagesRead} websites. {props.forYou}
      </p>

      {steps && (
        <ol className="mt-3 flex flex-col gap-2" aria-live="polite">
          {STEPS.map(({ step, label }) => {
            const s = steps[step];
            return (
              <li key={step} className="flex items-start gap-2.5 text-[14px] leading-snug">
                <span
                  className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full ${
                    s.status === "done"
                      ? "bg-primary text-white"
                      : s.status === "failed"
                        ? "bg-warn-soft text-warn"
                        : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {s.status === "done" ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : s.status === "failed" ? (
                    <X className="size-3" strokeWidth={3} />
                  ) : s.status === "running" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className={s.status === "waiting" ? "text-muted-foreground" : "font-medium"}>{label}</span>
                  {s.detail && <span className="block text-[13px] text-muted-foreground">{s.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {note && <p className="mt-2 text-[13px] text-muted-foreground">{note}</p>}

      <button type="button" className={`${secondaryButton} mt-3 h-11 text-[15px]`} onClick={run} disabled={running}>
        <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden />
        {running ? "Agent is working…" : "Run the agent now"}
      </button>

      <details className="group mt-2">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between text-[14px] font-medium text-primary">
          Sources ({db.sources.length})
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="flex flex-col gap-2 pb-1">
          {db.sources.map((s) => (
            <li key={s.url} className="text-[13px] leading-snug">
              <a href={s.url} className="font-medium text-primary underline-offset-2 active:underline">
                {domainOf(s.url)}
              </a>
              <span className="block text-muted-foreground">{s.title}</span>
            </li>
          ))}
        </ul>
        <p className="pb-1 text-[12px] leading-snug text-muted-foreground">
          Prices are public list prices incl. VAT as shown on these pages
          {db.agent === "electricity" ? ". Transmission and electricity tax are billed separately by your grid company" : ""}.
          Switching is simulated in this demo.
        </p>
      </details>
    </section>
  );
}
