"use client";

import { useState } from "react";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { Chip, Group, eur } from "@/components/solvo/ui";
import { UNPAID } from "@/data/reminders";
import { useBillActions } from "@/lib/switches";

export type PaidBill = {
  date: string; // YYYY-MM-DD
  kind: "rent" | "utility";
  amount: number; // positive EUR
  supplier?: string; // known when Solvo has read the e-invoice for this payment
};

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const fmtDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));

type Entry = {
  key: string;
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  open?: boolean;
  badge?: string;
};

/** Every bill paid in the last 12 months (rent and utilities from the data), plus the dental e-invoice. */
export function BillHistory({ bills, asOf }: { bills: PaidBill[]; asOf: string }) {
  const [all, setAll] = useState(false);
  const dental = useBillActions()[UNPAID.id];

  const entries: Entry[] = bills.map((b, i) => ({
    key: `${b.date}-${i}`,
    date: b.date,
    title: b.kind === "rent" ? "Rent" : (b.supplier ?? "Utility bill"),
    subtitle:
      b.kind === "rent"
        ? `Paid ${fmtDay(b.date)}`
        : b.supplier
          ? `Paid ${fmtDay(b.date)}, read from the e-invoice`
          : `Paid ${fmtDay(b.date)}, no supplier name in the payment`,
    amount: b.amount,
    badge: b.supplier ? "E-invoice" : undefined,
  }));
  entries.push(
    dental?.action === "paid"
      ? {
          key: "dental",
          date: asOf,
          title: UNPAID.supplier,
          subtitle: `Paid ${fmtDay(asOf)} in Solvo`,
          amount: UNPAID.amount,
          badge: "E-invoice",
        }
      : {
          key: "dental",
          date: UNPAID.dueDate,
          title: UNPAID.supplier,
          subtitle: `${UNPAID.what}. Due ${fmtDay(UNPAID.dueDate)}`,
          amount: UNPAID.amount,
          open: true,
        },
  );
  entries.sort((a, b) => (a.open === b.open ? b.date.localeCompare(a.date) : a.open ? -1 : 1));

  const months = new Map<string, Entry[]>();
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), e]);
  }
  const list = [...months.entries()];
  const shown = all ? list : list.slice(0, 3);

  return (
    <section className="mt-9">
      <h2 className="px-1 font-display text-[22px] font-semibold tracking-[-0.015em]">Bill history</h2>
      <p className="mt-1 px-1 text-[15px] leading-snug text-muted-foreground">
        Every bill paid from your account in the last 12 months.
      </p>
      {shown.map(([month, rows]) => (
        <Group
          key={month}
          className="mt-4"
          title={monthFmt.format(new Date(`${month}-01T00:00:00Z`))}
          aside={<span className="num">{eur.format(rows.reduce((s, r) => s + (r.open ? 0 : r.amount), 0))}</span>}
        >
          {rows.map((r) => (
            <div key={r.key} className="flex min-h-14 items-center gap-3 px-4 py-3 [&+&]:border-t">
              <MoneyBadge kind="out" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px] leading-snug font-medium">
                  <span className="truncate">{r.title}</span>
                  {r.open && <Chip tone="warn">Unpaid</Chip>}
                  {r.badge && !r.open && <Chip tone="green">{r.badge}</Chip>}
                </div>
                <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.subtitle}</div>
              </div>
              <SignedAmount kind="out" value={r.amount} className="text-[15px]" />
            </div>
          ))}
        </Group>
      ))}
      {list.length > 3 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-primary"
        >
          {all ? "Show less" : `Show all ${list.length} months`}
        </button>
      )}
    </section>
  );
}
