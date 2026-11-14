"use client";

import Link from "next/link";
import { AlarmClock, Bell, Check, Phone } from "lucide-react";
import { IconTile, eur, primaryButton } from "@/components/solvo/ui";
import { ESCALATION, UNPAID } from "@/data/reminders";
import { useBillActions } from "@/lib/switches";

const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const STEP_ICON = { notification: Bell, reminder: AlarmClock, call: Phone } as const;

/** Home card for the unpaid e-invoice: the escalation so far, and Solvo's call. */
export function OverdueBillCard({ asOf }: { asOf: string }) {
  const done = useBillActions()[UNPAID.id];

  if (done?.action === "paid") {
    return (
      <section className="mt-4 flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
        <IconTile>
          <Check />
        </IconTile>
        <p className="text-[14px] leading-snug">
          <span className="font-semibold">
            Paid {UNPAID.supplier}, {eur.format(UNPAID.amount)}.
          </span>{" "}
          <span className="text-muted-foreground">From your set-aside for irregular costs, so your safe-to-spend didn&apos;t change.</span>
        </p>
      </section>
    );
  }

  const daysLate = Math.round((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${UNPAID.dueDate}T00:00:00Z`)) / 86_400_000);

  return (
    <section className="mt-4 rounded-[24px] bg-card p-5 shadow-[0_1px_3px_rgba(15,42,31,0.06)] ring-1 ring-warn/25">
      <div className="flex items-start gap-3">
        <IconTile tone="warn">
          <Phone />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold">
              {done?.action === "snoozed" ? "Reminder set for Monday" : `Unpaid bill, ${daysLate} days late`}
            </p>
            <p className="num text-[15px] font-semibold">{eur.format(UNPAID.amount)}</p>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {UNPAID.supplier}, due {fmtDate(UNPAID.dueDate)}
          </p>
        </div>
      </div>

      <ol className="mt-4 flex flex-col gap-2 border-l-2 border-warn/25 pl-4 text-[13px]">
        {ESCALATION.map((s) => {
          const Icon = STEP_ICON[s.channel];
          const isToday = s.date === asOf;
          return (
            <li key={s.date} className={`flex items-center gap-2 ${isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span>
                {fmtDate(s.date)}: {s.title}
                {isToday ? " (today)" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <Link href="/call" transitionTypes={["nav-forward"]} className={`${primaryButton} mt-4`}>
        <Phone className="size-[18px]" aria-hidden />
        Play the demo call
      </Link>
      <p className="mt-2 px-1 text-center text-[12px] leading-snug text-muted-foreground">
        Demo only. In the real service Solvo would simply ring your phone.
      </p>
    </section>
  );
}
