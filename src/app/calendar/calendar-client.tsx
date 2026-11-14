"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Repeat, Trash2 } from "lucide-react";
import { BackLink, Group, PAGE, PageTitle, Row, TopBar } from "@/components/solvo/ui";
import { NumberField } from "@/components/solvo/fields";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { Sheet } from "@/components/solvo/sheet";
import { StickyAction } from "@/app/bills/switch-ui";
import { addCustomEvent, removeCustomEvent, useCustomEvents } from "@/lib/calendar-store";
import { useOnboarding } from "@/lib/onboarding-store";
import { daysIn, eventsForMonth, isoDay, ordinal, type DayEvent, type Item } from "@/lib/schedule";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function CalendarClient({ items: detected, asOf }: { items: Item[]; asOf: string }) {
  // Items the person confirmed in onboarding win over the guesses.
  const confirmed = useOnboarding().items;
  const items = confirmed ?? detected;
  const custom = useCustomEvents();

  const today = parse(asOf);
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [selected, setSelected] = useState(asOf);
  const [adding, setAdding] = useState(false);

  const events = eventsForMonth(items, custom, year, month);
  const byDate = new Map<string, DayEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const totalIn = events.filter((e) => e.kind === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = events.filter((e) => e.kind === "out").reduce((s, e) => s + e.amount, 0);

  const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array.from({ length: first }, () => 0), ...Array.from({ length: daysIn(year, month) }, (_, i) => i + 1)];

  const shift = (by: number) => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelected(isoDay(d.getUTCFullYear(), d.getUTCMonth(), 1));
  };

  const dayEvents = byDate.get(selected) ?? [];
  const nav = "flex size-11 items-center justify-center rounded-full active:bg-muted";

  return (
    <main className={`${PAGE} pb-[calc(6rem+env(safe-area-inset-bottom))]`}>
      <TopBar back={<BackLink href="/" label="Home" />} />
      <PageTitle title="Calendar">When money is expected to arrive and leave. Tap a day to see it or add your own.</PageTitle>

      <section className="rounded-2xl bg-card p-3 shadow-[0_1px_3px_rgba(15,42,31,0.06)]" aria-label={monthName.format(new Date(Date.UTC(year, month, 1)))}>
        <div className="flex items-center justify-between">
          <button type="button" className={nav} onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h2 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{monthName.format(new Date(Date.UTC(year, month, 1)))}</h2>
          <button type="button" className={nav} onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 text-center text-[12px] font-medium text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const iso = isoDay(year, month, d);
            const evs = byDate.get(iso) ?? [];
            const hasIn = evs.some((e) => e.kind === "in");
            const hasOut = evs.some((e) => e.kind === "out");
            const isSel = iso === selected;
            const isToday = iso === asOf;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                aria-pressed={isSel}
                aria-label={`${dayName.format(parse(iso))}${evs.length ? `, ${evs.length} ${evs.length === 1 ? "event" : "events"}` : ""}`}
                className={`mx-auto flex h-14 w-full max-w-12 flex-col items-center justify-start gap-0.5 rounded-xl pt-1.5 text-[15px] ${
                  isSel ? "bg-primary text-primary-foreground" : isToday ? "bg-accent font-semibold ring-1 ring-primary/40" : "active:bg-muted"
                }`}
              >
                <span className="num">{d}</span>
                <span className="flex h-[18px] items-center gap-0.5">
                  {hasIn && <MoneyBadge kind="in" size="sm" className={isSel ? "bg-white text-primary" : ""} />}
                  {hasOut && <MoneyBadge kind="out" size="sm" className={isSel ? "bg-white text-warn" : ""} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t px-1 pt-3 text-[14px]">
          <span className="text-muted-foreground">This month</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <MoneyBadge kind="in" size="sm" />
              <SignedAmount kind="in" value={totalIn} />
            </span>
            <span className="flex items-center gap-1.5">
              <MoneyBadge kind="out" size="sm" />
              <SignedAmount kind="out" value={totalOut} />
            </span>
          </span>
        </div>
      </section>

      <Group title={dayName.format(parse(selected))}>
        {dayEvents.length ? (
          dayEvents.map((e) => (
            <Row
              key={e.id + e.date}
              icon={<MoneyBadge kind={e.kind} />}
              title={e.label}
              subtitle={
                e.source === "you" ? (
                  <span className="flex items-center gap-1">
                    {custom.find((c) => c.id === e.id)?.monthly && <Repeat className="size-3" aria-hidden />}
                    Added by you
                  </span>
                ) : (
                  e.detail ?? "Usual date, from your last 12 months"
                )
              }
              value={<SignedAmount kind={e.kind} value={e.amount} />}
            />
          ))
        ) : (
          <p className="px-4 py-4 text-[14px] text-muted-foreground">Nothing expected on this day.</p>
        )}
        {dayEvents.some((e) => e.source === "you") && (
          <div className="border-t px-4 py-2">
            {dayEvents
              .filter((e) => e.source === "you")
              .map((e) => (
                <button key={e.id} type="button" onClick={() => removeCustomEvent(e.id)} className="flex min-h-11 items-center gap-2 text-[14px] text-muted-foreground active:text-foreground">
                  <Trash2 className="size-4" aria-hidden />
                  Remove “{e.label}”
                </button>
              ))}
          </div>
        )}
      </Group>

      <StickyAction onClick={() => setAdding(true)}>
        <span className="flex items-center gap-2">
          <Plus className="size-5" aria-hidden />
          Add a date
        </span>
      </StickyAction>

      {adding && <AddSheet date={selected} onClose={() => setAdding(false)} />}
    </main>
  );
}

function AddSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const [kind, setKind] = useState<"in" | "out">("out");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);
  const [when, setWhen] = useState(date);
  const [monthly, setMonthly] = useState(false);
  const valid = label.trim().length > 0 && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(when);
  const seg = (k: "in" | "out") =>
    `flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted"}`;

  return (
    <Sheet
      title="Add a date"
      onClose={onClose}
      doneLabel="Add to calendar"
      doneDisabled={!valid}
      onDone={() => {
        addCustomEvent({ id: `c-${Date.now()}`, kind, label: label.trim(), amount, date: when, monthly });
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="group" aria-label="Money in or out">
          <button type="button" className={seg("out")} aria-pressed={kind === "out"} onClick={() => setKind("out")}>
            <MoneyBadge kind="out" size="sm" className="bg-white" />
            Money out
          </button>
          <button type="button" className={seg("in")} aria-pressed={kind === "in"} onClick={() => setKind("in")}>
            <MoneyBadge kind="in" size="sm" className="bg-white" />
            Money in
          </button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">What is it</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === "out" ? "Insurance, gym, holiday…" : "Bonus, tax refund…"}
            autoComplete="off"
            enterKeyHint="next"
            className="h-11 rounded-xl bg-muted px-3 outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <div className="flex gap-3">
          <NumberField label="Amount" value={amount} onChange={setAmount} suffix="€" />
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[13px] text-muted-foreground">Date</span>
            <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 rounded-xl bg-muted px-3 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
        <button type="button" role="switch" aria-checked={monthly} onClick={() => setMonthly((m) => !m)} className="flex min-h-11 items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-[15px] font-medium">Repeats every month</span>
            <span className="block text-[13px] text-muted-foreground">On the {ordinal(Number(when.slice(8, 10)) || 1)} each month from then on</span>
          </span>
          <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 ${monthly ? "bg-primary" : "bg-border"}`} aria-hidden>
            <span className={`size-6 rounded-full bg-white shadow transition-transform ${monthly ? "translate-x-5" : ""}`} />
          </span>
        </button>
      </div>
    </Sheet>
  );
}
