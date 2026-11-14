"use client";

// Shared pieces of the compare, approve and done screens, used by every bill type (electricity, phone).
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Check, PencilLine, ShieldCheck, Sparkles } from "lucide-react";
import { Chip, Group, IconTile, Slab, eur, primaryButton, secondaryButton } from "@/components/solvo/ui";

/** The saving, with "do nothing" and the chosen offer as two bars on one scale. */
export function SavingSlab(props: {
  label: string;
  saving: number;
  before: { label: string; yearly: number };
  after: { label: string; yearly: number };
  footnote: ReactNode;
}) {
  const max = Math.max(props.before.yearly, props.after.yearly, 1);
  return (
    <Slab>
      <p className="text-[15px] text-white/70">{props.label}</p>
      <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">
        {eur.format(Math.max(0, props.saving))}
        <span className="ml-1.5 font-sans text-[18px] font-medium tracking-normal text-white/70">a year</span>
      </p>
      <div className="num mt-5 flex flex-col gap-2.5 text-[13px]">
        <div>
          <div className="mb-1 flex justify-between gap-3 text-white/65">
            <span>{props.before.label}</span>
            <span>{eur.format(props.before.yearly)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#ff9f87]" style={{ width: `${(props.before.yearly / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-3 font-medium text-white">
            <span>{props.after.label}</span>
            <span>{eur.format(props.after.yearly)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-mint transition-[width] duration-500"
              style={{ width: `${(props.after.yearly / max) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">{props.footnote}</p>
    </Slab>
  );
}

/** Group of fields the AI read from the e-invoice. Every one is editable. */
export function ReadFields({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  return (
    <Group
      title="From your e-invoice"
      aside={badge}
      footer={
        <span className="inline-flex items-center gap-1">
          <PencilLine className="size-3.5" aria-hidden />
          Check these. Tap any number to correct it.
        </span>
      }
    >
      {children}
    </Group>
  );
}

export function EditField(props: {
  label: string;
  value: number | null;
  unit: string;
  step?: string;
  min?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-3 px-4 [&+&]:border-t">
      <span className="text-[15px]">{props.label}</span>
      <span className="flex items-center gap-1.5 rounded-lg bg-muted/70 pr-2.5 focus-within:bg-accent focus-within:ring-2 focus-within:ring-primary/30">
        <input
          type="number"
          inputMode="decimal"
          step={props.step ?? "any"}
          min={props.min}
          value={props.value ?? ""}
          onChange={(e) => props.onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="num field-inline h-9 w-[5.5rem] bg-transparent pl-2.5 text-right font-medium outline-none"
        />
        <span className="w-10 text-[12px] text-muted-foreground">{props.unit}</span>
      </span>
    </label>
  );
}

export function OfferOption(props: {
  chosen: boolean;
  title: ReactNode;
  yearly: number;
  detail: ReactNode;
  pick?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.chosen}
      onClick={props.onSelect}
      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors [&+&]:border-t ${props.chosen ? "bg-accent/60" : "active:bg-muted"}`}
    >
      <span
        className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${props.chosen ? "border-primary bg-primary text-white" : "border-input"}`}
        aria-hidden
      >
        {props.chosen && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">{props.title}</span>
          <span className="num shrink-0 text-[15px] font-semibold">{eur.format(props.yearly)}</span>
        </span>
        <span className="num mt-0.5 block text-[13px] leading-snug text-muted-foreground">{props.detail}</span>
        {props.pick && (
          <span className="mt-1.5 inline-flex">
            <Chip tone="green">
              <Sparkles className="size-3" aria-hidden />
              {props.pick}
            </Chip>
          </span>
        )}
      </span>
    </button>
  );
}

/** The main action, pinned above the home bar. Pages using it need bottom padding (pb-24). */
export function StickyAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pt-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <button type="button" className={primaryButton} onClick={onClick}>
        {children}
      </button>
    </div>
  );
}

/** Bottom sheet where the user approves. Solvo never switches without this tap. */
export function ApproveSheet(props: {
  title: string;
  points: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 mx-auto flex w-full max-w-[430px] flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 animate-in bg-slab/40 backdrop-blur-[2px] fade-in"
        onClick={props.onCancel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-title"
        className="relative animate-in rounded-t-[28px] bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl duration-300 slide-in-from-bottom"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="flex items-center gap-3">
          <IconTile>
            <ShieldCheck />
          </IconTile>
          <h2 id="approve-title" className="font-display text-[22px] font-semibold tracking-[-0.015em]">
            {props.title}
          </h2>
        </div>
        <ul className="mt-4 flex flex-col gap-3 text-[15px] leading-snug">
          {props.points.map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.75} aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className={primaryButton} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
          <button type="button" className={secondaryButton} onClick={props.onCancel}>
            Not now
          </button>
        </div>
      </section>
    </div>
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
      setV(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <>{eur.format(v)}</>;
}

/** After approval: a check, what happens next, and the safe-to-spend number rising. */
export function DoneView(props: {
  title: string;
  body: ReactNode;
  remainingBefore: number;
  remainingAfter: number;
  perWeek: number;
  footnote: ReactNode;
  reminder?: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="flex flex-col">
      <div className="mt-6 flex flex-col items-center text-center">
        <span className="flex size-16 animate-pop items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_30px_-10px_rgba(19,98,63,0.8)]">
          <Check className="size-8" strokeWidth={2.75} aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">{props.title}</h1>
        <p className="mt-2 max-w-[32ch] text-[15px] leading-snug text-muted-foreground">{props.body}</p>
      </div>

      <Slab className="mt-7">
        <p className="text-[15px] text-white/70">Safe to spend this week</p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">
          <CountUp from={props.remainingBefore} to={props.remainingAfter} />
        </p>
        <p className="mt-3 inline-flex h-7 items-center rounded-full bg-mint/15 px-2.5 text-[13px] font-semibold text-mint">
          +{eur.format(props.perWeek)} every week
        </p>
        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">{props.footnote}</p>
      </Slab>

      {props.reminder && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
          <IconTile>
            <Bell />
          </IconTile>
          <p className="text-[14px] leading-snug">{props.reminder}</p>
        </div>
      )}

      <Link href="/" className={`${secondaryButton} mt-6`}>
        Back to home
      </Link>
    </div>
  );
}
