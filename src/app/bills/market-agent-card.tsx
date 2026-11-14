"use client";

// "How Solvo found these prices": the market agent's last run, its sources, and a "Run now" button.
// The agent runs on Solvo's side for everyone (nightly in production). Running it here is for the demo:
// the steps stream in live, and if anything fails the saved run stays in place.
import { useState } from "react";
import { Check, ChevronDown, Globe, Loader2, RefreshCw, X, Search } from "lucide-react";
import { Chip, primaryButton, secondaryButton } from "@/components/solvo/ui";
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

type FoundRow = { id: string; group: string; title: string; price: string; conditions: string | null; sourceUrl: string; checkedAt: string; sort: number };

/** Everything the agent found, as display rows grouped by contract type, cheapest first. */
function foundRows(db: AgentDb): FoundRow[] {
  if (db.agent === "electricity")
    return db.offers.map((o) => ({
      id: o.id,
      group: o.pricing === "fixed" ? "Fixed price" : "Spot price",
      title: `${o.supplier} ${o.product}`,
      price:
        (o.pricing === "fixed" ? `${o.centsPerKwh.toFixed(2)} c/kWh` : `Spot + ${o.centsPerKwh.toFixed(2)} c/kWh margin`) +
        ` + ${o.monthlyFee.toFixed(2)} €/mo` +
        (o.termMonths ? `, ${o.termMonths} months` : ""),
      conditions: o.conditions,
      sourceUrl: o.sourceUrl,
      checkedAt: o.checkedAt,
      sort: (o.pricing === "fixed" ? 0 : 1000) + o.centsPerKwh,
    }));
  return db.offers.map((o) => ({
    id: o.id,
    group: o.kind === "mobile" ? "Mobile plans" : "Home internet",
    title: `${o.operator} ${o.product}`,
    price: `${o.monthlyPrice.toFixed(2)} €/mo, ${o.speedMbps} Mbit/s`,
    conditions: o.conditions,
    sourceUrl: o.sourceUrl,
    checkedAt: o.checkedAt,
    sort: (o.kind === "mobile" ? 0 : 1000) + o.monthlyPrice,
  }));
}

// Which agents have run in this visit. The demo starts with no offers on screen: the person runs the
// agent and the options appear. Kept in memory only, so a page reload starts the demo over.
const ranThisVisit = new Set<AgentDb["agent"]>();
export const agentHasRun = (agent: AgentDb["agent"]) => ranThisVisit.has(agent);

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * forYou: what the agent's result means for this customer, e.g. their group and consumption.
 * shortlist: ids of the offers shown to this customer, marked in the full list.
 */
export function MarketAgentCard<D extends AgentDb>(props: {
  db: D;
  forYou: ReactNode;
  shortlist?: string[];
  onResult: (db: D) => void;
  /** Called when a run ends, live or from the saved database. Before the first run the card invites a run. */
  onFinished?: () => void;
}) {
  const { db } = props;
  const noun = NOUN[db.agent];
  const [steps, setSteps] = useState<Record<AgentStep, StepState> | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showFound, setShowFound] = useState(false);
  const rows = foundRows(db).sort((a, b) => a.sort - b.sort);
  const groups = [...new Set(rows.map((r) => r.group))];
  const mine = new Set(props.shortlist ?? []);
  const [fresh, setFresh] = useState(() => !agentHasRun(db.agent));
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
            else setNote(`Showing the saved run from ${timeFmt.format(new Date(e.db.ranAt))}.${e.error ? ` (${e.error.slice(0, 120)})` : ""}`);
          }
        }
      }
    } catch (err) {
      setNote(`Couldn't reach the agent (${String(err).slice(0, 80)}). Showing the saved run.`);
    } finally {
      setRunning(false);
      ranThisVisit.add(db.agent);
      setFresh(false);
      props.onFinished?.();
    }
  }

  return (
    <section className="mt-7 rounded-2xl bg-card p-4 shadow-[0_1px_0_rgba(15,42,31,0.04),0_1px_3px_rgba(15,42,31,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">
          {fresh ? "Put it out to tender" : "How Solvo found these prices"}
        </h2>
        {!fresh && (
          <Chip tone="green">
            <Globe className="size-3" aria-hidden />
            {timeFmt.format(new Date(db.ranAt))}
          </Chip>
        )}
      </div>
      {fresh ? (
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Solvo&apos;s market agent searches the public prices of {noun.sellers} across Finland, checks them and picks the
          best ones for you, with the source of every price. Nothing changes without your approval.
        </p>
      ) : (
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
      )}

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

      {fresh ? (
        <button type="button" className={`${primaryButton} mt-4`} onClick={run} disabled={running}>
          {running ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Search className="size-[18px]" aria-hidden />}
          {running ? "Agent is searching…" : "Find better offers"}
        </button>
      ) : (
        <button type="button" className={`${secondaryButton} mt-3 h-11 text-[15px]`} onClick={run} disabled={running}>
          <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden />
          {running ? "Agent is working…" : "Run the agent again"}
        </button>
      )}

      {!fresh && (
        <>

    <details className="group/found mt-2" open={showFound} onToggle={(e) => setShowFound(e.currentTarget.open)}>
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between text-[14px] font-medium text-primary">
              What the agent found ({rows.length})
              <ChevronDown className="size-4 transition-transform group-open/found:rotate-180" aria-hidden />
            </summary>
            <p className="text-[12px] leading-snug text-muted-foreground">
              Searched for: {db.queries.map((q) => `“${q}”`).join(", ")}. {db.mode === "exa" ? "Last run" : "Saved run"} {timeFmt.format(new Date(db.ranAt))}. Offers
              not seen in the latest run keep their older check date.
            </p>
            {groups.map((g) => (
              <div key={g} className="mt-3">
                <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</h3>
                <ul className="mt-1 divide-y">
                  {rows
                    .filter((r) => r.group === g)
                    .map((r) => (
                      <li key={r.id} className="py-2.5 text-[13px] leading-snug">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-medium">{r.title}</span>
                          {mine.has(r.id) && <Chip tone="green">For you</Chip>}
                        </div>
                        <span className="num block">{r.price}</span>
                        {r.conditions && <span className="block text-muted-foreground">{r.conditions}</span>}
                        <span className="block text-muted-foreground">
                          <a href={r.sourceUrl} className="text-primary underline-offset-2 active:underline">
                            {domainOf(r.sourceUrl)}
                          </a>
                          , checked {dayFmt.format(new Date(`${r.checkedAt}T00:00:00Z`))}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </details>

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
        </>
      )}
    </section>
  );
}
