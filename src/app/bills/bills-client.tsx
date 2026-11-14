"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, Check, Cable, FileText, PencilLine, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import {
  BackButton,
  BackLink,
  Chip,
  Group,
  IconTile,
  PAGE,
  PageTitle,
  Slab,
  TopBar,
  eur,
  eur2,
  primaryButton,
  secondaryButton,
} from "@/components/solvo/ui";
import type { Reading } from "@/lib/einvoice";
import { compare, OFFERS_UPDATED, type ContractTerms } from "@/lib/offers";
import { approveSwitch, useSwitches, weeklyBoost, type BillKey, type SwitchRecord } from "@/lib/switches";
import { TelecomDetail } from "./telecom-detail";

type InvoiceMeta = { id: string; payment: { date: string; amount: number } };
type Loaded = { reading: Reading; source: "gemini" | "saved"; model?: string; ms: number; cached?: boolean };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "–");

const KIND_LABEL: Record<Reading["kind"], string> = {
  electricity_energy: "Electricity",
  electricity_transmission: "Electricity transmission",
  telecom: "Phone and internet",
  other: "Other bill",
};

const KIND_ICON: Record<Reading["kind"], typeof Zap> = {
  electricity_energy: Zap,
  electricity_transmission: Cable,
  telecom: Smartphone,
  other: FileText,
};

function termsFrom(r: Reading): ContractTerms {
  return {
    annualKwh: r.annualConsumptionKwh ?? (r.consumptionKwh ?? 0) * 12,
    centsPerKwh: r.priceCentsPerKwh ?? 0,
    monthlyFee: r.monthlyFee ?? 0,
    centsAfterEnd: r.priceAfterEndCentsPerKwh,
    monthlyFeeAfterEnd: r.monthlyFeeAfterEnd,
  };
}

export function BillsClient(props: {
  asOf: string;
  invoices: InvoiceMeta[];
  weeklyBudget: number;
  remaining: number;
}) {
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [open, setOpen] = useState<string | null>(null);
  const switches = useSwitches();

  useEffect(() => {
    for (const inv of props.invoices) {
      fetch("/api/read-invoice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: inv.id }) })
        .then((r) => r.json())
        .then((d: Loaded) => setLoaded((prev) => ({ ...prev, [inv.id]: d })))
        .catch(() => {});
    }
  }, [props.invoices]);

  // Opening a contract starts at the top of the page, like a new screen.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [open]);

  const openInvoice = open ? loaded[open] : undefined;
  const actionable = props.invoices.filter((inv) => isActionable(loaded[inv.id], switches));
  const others = props.invoices.filter((inv) => !isActionable(loaded[inv.id], switches));

  return (
    <main className={PAGE}>
      <TopBar back={open ? <BackButton onClick={() => setOpen(null)} label="Bills" /> : <BackLink href="/" label="Home" />} />

      {open && openInvoice?.reading.kind === "telecom" ? (
        <TelecomDetail
          reading={openInvoice.reading}
          badge={<SourceBadge l={openInvoice} />}
          weeklyBudget={props.weeklyBudget}
          remaining={props.remaining}
          asOf={props.asOf}
        />
      ) : open && openInvoice ? (
        <ElectricityDetail
          loaded={openInvoice}
          weeklyBudget={props.weeklyBudget}
          remaining={props.remaining}
          asOf={props.asOf}
        />
      ) : (
        <>
          <PageTitle title="Your bills">
            Solvo read the e-invoices that reached your bank this month. Nothing to photograph or upload.
          </PageTitle>

          {actionable.map((inv) => (
            <FeaturedInvoice key={inv.id} meta={inv} loaded={loaded[inv.id]!} onOpen={() => setOpen(inv.id)} />
          ))}

          <Group title={actionable.length ? "Other bills" : "This month"} className={actionable.length ? "mt-7" : "mt-0"}>
            {others.map((inv) => (
              <InvoiceRow key={inv.id} meta={inv} loaded={loaded[inv.id]} switched={switchedFor(loaded[inv.id], switches)} />
            ))}
          </Group>
        </>
      )}
    </main>
  );
}

const BILL_KEY: Partial<Record<Reading["kind"], BillKey>> = { electricity_energy: "electricity", telecom: "telecom" };

function switchedFor(l: Loaded | undefined, switches: ReturnType<typeof useSwitches>) {
  const key = l ? BILL_KEY[l.reading.kind] : undefined;
  return key ? switches[key] : undefined;
}

/** A bill Solvo can act on: electricity or phone and internet, switchable, not switched yet. */
function isActionable(l: Loaded | undefined, switches: ReturnType<typeof useSwitches>) {
  return (
    !!l &&
    (l.reading.kind === "electricity_energy" || l.reading.kind === "telecom") &&
    l.reading.switchable &&
    !switchedFor(l, switches)
  );
}

function SourceBadge({ l }: { l: Loaded }) {
  return l.source === "gemini" ? (
    <Chip tone="green">
      <Sparkles className="size-3" aria-hidden />
      Read by Gemini{l.cached || !l.ms ? "" : ` in ${(l.ms / 1000).toFixed(1)} s`}
    </Chip>
  ) : (
    <Chip>Saved reading, AI offline</Chip>
  );
}

/** The bill Solvo can do something about: shown first, with the saving up front. */
function FeaturedInvoice({ meta, loaded, onOpen }: { meta: InvoiceMeta; loaded: Loaded; onOpen: () => void }) {
  const r = loaded.reading;
  const isElectricity = r.kind === "electricity_energy";
  const saving = isElectricity ? compare(termsFrom(r)).recommended.saving : 0;
  const Icon = KIND_ICON[r.kind];
  return (
    <section className="rounded-[24px] bg-card p-5 shadow-[0_1px_3px_rgba(15,42,31,0.06)] ring-1 ring-warn/25">
      <div className="flex items-start gap-3">
        <IconTile tone="warn">
          <Icon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold">{r.supplier}</p>
            <p className="num text-[15px] font-semibold">{eur2.format(r.monthlyCost)}/mo</p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {KIND_LABEL[r.kind]}, {r.product}
          </p>
        </div>
      </div>

      {saving > 0 && (
        <p className="mt-4 font-display text-[22px] leading-tight font-semibold tracking-[-0.015em]">
          You could save <span className="num text-primary">{eur.format(saving)}</span> a year
        </p>
      )}
      <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{r.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SourceBadge l={loaded} />
        <Chip>
          Paid {eur2.format(-meta.payment.amount)} on {fmtDate(meta.payment.date)}
        </Chip>
      </div>

      <button type="button" className={`${primaryButton} mt-4`} onClick={onOpen}>
        {isElectricity ? "Compare electricity offers" : "Compare phone and internet offers"}
        <ArrowRight className="size-[18px]" aria-hidden />
      </button>
    </section>
  );
}

function InvoiceRow({ meta, loaded, switched }: { meta: InvoiceMeta; loaded?: Loaded; switched?: SwitchRecord }) {
  if (!loaded) {
    return (
      <div className="flex items-start gap-3 px-4 py-4 [&+&]:border-t" aria-busy>
        <span className="shimmer size-9 shrink-0 rounded-xl" />
        <div className="flex-1">
          <p className="text-[15px] font-medium text-muted-foreground">Reading e-invoice…</p>
          <p className="num mt-0.5 text-[13px] text-muted-foreground">
            Payment {eur2.format(-meta.payment.amount)} on {fmtDate(meta.payment.date)}
          </p>
          <div className="shimmer mt-2.5 h-2.5 w-3/4 rounded-full" />
        </div>
      </div>
    );
  }
  const r = loaded.reading;
  const Icon = KIND_ICON[r.kind];
  return (
    <div className="flex items-start gap-3 px-4 py-4 [&+&]:border-t">
      <IconTile tone="grey">
        <Icon />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-medium">{r.supplier}</p>
          <p className="num shrink-0 text-[15px] font-medium">{eur2.format(r.monthlyCost)}/mo</p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {KIND_LABEL[r.kind]}, {r.product}
        </p>
        <p className="mt-2 text-[14px] leading-snug">{r.summary}</p>
        {r.kind === "electricity_transmission" && (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            Transmission can&apos;t be switched, but cutting your kWh lowers this bill too.
          </p>
        )}
        {switched && (
          <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] leading-snug text-accent-foreground">
            <Check className="mt-px size-4 shrink-0" strokeWidth={2.75} aria-hidden />
            <span>
              {switched.toProduct === "price match"
                ? `Price-match request sent to ${switched.toSupplier}`
                : `Switching to ${switched.toSupplier} ${switched.toProduct}`}
              {switched.startDate ? ` from ${fmtDate(switched.startDate)}` : ""}. You save about{" "}
              {eur.format(switched.yearlySaving)} a year.
            </span>
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <SourceBadge l={loaded} />
        </div>
      </div>
    </div>
  );
}

function NumberField(props: { label: string; value: number | null; unit: string; step?: string; onChange: (v: number | null) => void }) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 [&+&]:border-t">
      <span className="text-[15px]">{props.label}</span>
      <span className="flex items-center gap-1.5 rounded-lg bg-muted/70 pr-2.5 focus-within:bg-accent focus-within:ring-2 focus-within:ring-primary/30">
        <input
          type="number"
          inputMode="decimal"
          step={props.step ?? "any"}
          value={props.value ?? ""}
          onChange={(e) => props.onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="num field-inline h-9 w-[5.5rem] bg-transparent pl-2.5 text-right font-medium outline-none"
        />
        <span className="w-10 text-[12px] text-muted-foreground">{props.unit}</span>
      </span>
    </label>
  );
}

/** Counts from one amount to another once, so the user sees the safe-to-spend number move. */
function CountUp({ from, to }: { from: number; to: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 450;
    const duration = reduced ? 1 : 1100;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setV(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <>{eur.format(v)}</>;
}

function ElectricityDetail(props: { loaded: Loaded; weeklyBudget: number; remaining: number; asOf: string }) {
  const r = props.loaded.reading;
  const [terms, setTerms] = useState<ContractTerms>(() => termsFrom(r));
  const set = (k: keyof ContractTerms) => (v: number | null) =>
    setTerms((t) => ({ ...t, [k]: v ?? (k === "centsAfterEnd" || k === "monthlyFeeAfterEnd" ? null : 0) }));

  const cmp = useMemo(() => compare(terms), [terms]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = cmp.offers.find((o) => o.id === chosenId) ?? cmp.recommended;
  const [stage, setStage] = useState<"compare" | "confirm" | "done">("compare");
  const perWeek = chosen.saving / 52;
  const boost = weeklyBoost(useSwitches()); // all approved switches, including this one once approved
  const startDate = r.contractEndDate ? nextDay(r.contractEndDate) : null;

  useEffect(() => {
    if (stage === "done") window.scrollTo({ top: 0 });
  }, [stage]);

  if (stage === "done") {
    return (
      <div className="flex flex-col">
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="animate-pop flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_30px_-10px_rgba(19,98,63,0.8)]">
            <Check className="size-8" strokeWidth={2.75} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">Switch requested</h1>
          <p className="mt-2 max-w-[30ch] text-[15px] leading-snug text-muted-foreground">
            {chosen.supplier} {chosen.product} starts {fmtDate(startDate)}. {chosen.supplier} cancels your {r.supplier}{" "}
            contract for you, so there&apos;s nothing else to do.
          </p>
        </div>

        <Slab className="mt-7">
          <p className="text-[15px] text-white/70">Safe to spend this week</p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">
            <CountUp from={props.remaining + boost - Math.max(0, perWeek)} to={props.remaining + boost} />
          </p>
          <p className="mt-3 inline-flex h-7 items-center rounded-full bg-mint/15 px-2.5 text-[13px] font-semibold text-mint">
            +{eur.format(perWeek)} every week
          </p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            Your weekly budget grows from {eur.format(props.weeklyBudget)} to {eur.format(props.weeklyBudget + boost)},
            because a fixed cost just got smaller. That&apos;s {eur.format(chosen.saving)} a year.
          </p>
        </Slab>

        {chosen.termMonths && startDate && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
            <IconTile>
              <Bell />
            </IconTile>
            <p className="text-[14px] leading-snug">
              Solvo will remind you a month before this contract ends, so it never rolls over to a worse price again.
            </p>
          </div>
        )}

        <Link href="/" className={`${secondaryButton} mt-6`}>
          Back to home
        </Link>
      </div>
    );
  }

  const maxYearly = Math.max(cmp.doNothing, chosen.yearly, 1);

  return (
    <div className="flex flex-col pb-24">
      <PageTitle title="Your electricity">
        {r.supplier}, {r.product}. Contract ends {fmtDate(r.contractEndDate)}.
      </PageTitle>

      <Slab>
        <p className="text-[15px] text-white/70">Switching saves you</p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">
          {eur.format(Math.max(0, chosen.saving))}
          <span className="ml-1.5 font-sans text-[18px] font-medium tracking-normal text-white/70">a year</span>
        </p>

        {/* Before and after, as two bars on the same scale */}
        <div className="num mt-5 flex flex-col gap-2.5 text-[13px]">
          <div>
            <div className="mb-1 flex justify-between text-white/65">
              <span>Do nothing, rolls over {fmtDate(startDate)}</span>
              <span>{eur.format(cmp.doNothing)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#ff9f87]" style={{ width: `${(cmp.doNothing / maxYearly) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-medium text-white">
              <span>{chosen.supplier} {chosen.product}</span>
              <span>{eur.format(chosen.yearly)}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-mint transition-[width] duration-500"
                style={{ width: `${(chosen.yearly / maxYearly) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
          That&apos;s +{eur.format(Math.max(0, perWeek))} to your safe-to-spend every week.
        </p>
      </Slab>

      <Group
        title="From your e-invoice"
        aside={<SourceBadge l={props.loaded} />}
        footer={
          <span className="inline-flex items-center gap-1">
            <PencilLine className="size-3.5" aria-hidden />
            Check these. Tap any number to correct it.
          </span>
        }
      >
        <NumberField label="Yearly use" value={terms.annualKwh} unit="kWh" step="100" onChange={set("annualKwh")} />
        <NumberField label="Price now" value={terms.centsPerKwh} unit="c/kWh" onChange={set("centsPerKwh")} />
        <NumberField label="Base fee now" value={terms.monthlyFee} unit="€/mo" onChange={set("monthlyFee")} />
        <NumberField label={`Price after ${fmtDate(r.contractEndDate)}`} value={terms.centsAfterEnd} unit="c/kWh" onChange={set("centsAfterEnd")} />
        <NumberField label="Base fee after" value={terms.monthlyFeeAfterEnd} unit="€/mo" onChange={set("monthlyFeeAfterEnd")} />
      </Group>

      <Group
        title="Your options for a year"
        aside={`${terms.annualKwh.toLocaleString("fi-FI")} kWh`}
        footer={`Demo offer table, updated ${fmtDate(OFFERS_UPDATED)}. Providers are fictional. Today's price would cost ${eur.format(cmp.current)} a year.`}
      >
        <div role="radiogroup" aria-label="Electricity offers">
          {cmp.offers.map((o) => {
            const isChosen = o.id === chosen.id;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={isChosen}
                onClick={() => setChosenId(o.id)}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors [&+&]:border-t ${isChosen ? "bg-accent/60" : "active:bg-muted"}`}
              >
                <span
                  className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${isChosen ? "border-primary bg-primary text-white" : "border-input"}`}
                  aria-hidden
                >
                  {isChosen && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold">
                      {o.supplier} {o.product}
                    </span>
                    <span className="num shrink-0 text-[15px] font-semibold">{eur.format(o.yearly)}</span>
                  </span>
                  <span className="num mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    {o.pricing === "spot" ? "Spot, about " : ""}
                    {o.centsPerKwh.toFixed(2)} c/kWh + {o.monthlyFee.toFixed(2)} €/mo
                    {o.termMonths ? `, fixed ${o.termMonths} months` : ""}
                    {o.note ? `. ${o.note}` : ""}
                  </span>
                  {o.id === cmp.recommended.id && (
                    <span className="mt-1.5 inline-flex">
                      <Chip tone="green">
                        <Sparkles className="size-3" aria-hidden />
                        Coach&apos;s pick: a fixed price is easier to budget
                      </Chip>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {/* The action stays in reach above the home bar. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pt-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" className={primaryButton} onClick={() => setStage("confirm")}>
          Switch to {chosen.supplier}
        </button>
      </div>

      {stage === "confirm" && (
        <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-[430px] flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slab/40 backdrop-blur-[2px] animate-in fade-in"
            onClick={() => setStage("compare")}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-title"
            className="relative animate-in slide-in-from-bottom rounded-t-[28px] bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl duration-300"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
            <div className="flex items-center gap-3">
              <IconTile>
                <ShieldCheck />
              </IconTile>
              <h2 id="approve-title" className="font-display text-[22px] font-semibold tracking-[-0.015em]">
                You approve this switch
              </h2>
            </div>
            <ul className="mt-4 flex flex-col gap-3 text-[15px] leading-snug">
              {[
                `New contract: ${chosen.supplier} ${chosen.product}, from ${fmtDate(startDate)}.`,
                `${chosen.supplier} cancels your ${r.supplier} contract for you.`,
                "No switching fees. You can cancel within 14 days.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.75} aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className={primaryButton}
                onClick={() => {
                  approveSwitch({
                    bill: "electricity",
                    fromSupplier: r.supplier,
                    toSupplier: chosen.supplier,
                    toProduct: chosen.product,
                    yearlySaving: Math.max(0, chosen.saving),
                    startDate,
                    approvedAt: new Date().toISOString(),
                  });
                  setStage("done");
                }}
              >
                Approve switch
              </button>
              <button type="button" className={secondaryButton} onClick={() => setStage("compare")}>
                Not now
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
