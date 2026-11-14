"use client";

import Link from "next/link";
import { ESCALATION, UNPAID } from "@/data/reminders";
import { useBillActions } from "@/lib/switches";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const ICON = { notification: "🔔", reminder: "⏰", call: "📞" } as const;

/** Home card for the unpaid e-invoice: the escalation so far, and the call. */
export function OverdueBillCard({ asOf }: { asOf: string }) {
  const done = useBillActions()[UNPAID.id];

  if (done?.action === "paid") {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-medium">Paid: {UNPAID.supplier}, {eur.format(UNPAID.amount)}.</span>{" "}
        <span className="text-muted-foreground">From your set-aside for irregular costs, so your safe-to-spend didn&apos;t change.</span>
      </div>
    );
  }

  const daysLate = Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${UNPAID.dueDate}T00:00:00Z`)) / 86_400_000);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-red-900">
          {done?.action === "snoozed" ? "Reminder set for Monday" : `Unpaid bill, ${daysLate} days late`}
        </p>
        <p className="text-sm font-semibold tabular-nums text-red-900">{eur.format(UNPAID.amount)}</p>
      </div>
      <p className="-mt-2 text-sm text-red-950">
        {UNPAID.supplier}, due {fmtDate(UNPAID.dueDate)}
      </p>
      <ol className="flex flex-col gap-1 text-xs text-red-900/80">
        {ESCALATION.map((s) => (
          <li key={s.date} className="flex gap-2">
            <span aria-hidden>{ICON[s.channel]}</span>
            <span>
              {fmtDate(s.date)}: {s.title}
              {s.date === asOf ? " (today)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Link
          href="/call"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-emerald-800 text-sm font-medium text-white"
        >
          📞 Solvo is calling
        </Link>
        <Link
          href="/call?skip=1"
          className="flex h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-900"
        >
          Pay now
        </Link>
      </div>
    </div>
  );
}
