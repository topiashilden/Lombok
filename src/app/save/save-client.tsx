"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Chip, Group, PAGE, PageTitle, Slab, TopBar, eur, primaryButton, secondaryButton } from "@/components/solvo/ui";
import { FUNDS, projectSavings } from "@/lib/funds";
import { approveSavingsPlan, monthlyFreed, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";

const YEARS = 10;
const DAY_OF_MONTH = 2; // the day after a typical salary day

export function SaveClient({ remaining }: { remaining: number }) {
  const switches = useSwitches();
  const plan = useSavingsPlan();
  const freed = Math.floor(monthlyFreed(switches));
  const [share, setShare] = useState<number | null>(null); // EUR per month, null = all of it
  const [fundId, setFundId] = useState(FUNDS[0].id);
  const [confirming, setConfirming] = useState(false);

  const monthly = Math.min(freed, share ?? freed);
  const fund = FUNDS.find((f) => f.id === fundId)!;
  const net = fund.illustrativeReturnPct - fund.yearlyFeePct;
  const proj = projectSavings(monthly, YEARS, net);
  const top = <TopBar />;

  if (plan) {
    const pf = FUNDS.find((f) => f.id === plan.fundId) ?? FUNDS[0];
    const p = projectSavings(plan.monthly, YEARS, pf.illustrativeReturnPct - pf.yearlyFeePct);
    return (
      <main className={PAGE}>
        {top}
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex size-16 animate-pop items-center justify-center rounded-full bg-primary text-white">
            <Check className="size-8" strokeWidth={2.75} aria-hidden />
          </span>
          <h1 className="mt-5 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">
            {eur.format(plan.monthly)} a month, saved
          </h1>
          <p className="mt-2 max-w-[32ch] text-[15px] leading-snug text-muted-foreground">
            Into your {plan.fundName.toLowerCase()} on the {plan.dayOfMonth}nd of every month, from money your old bills used to
            take. You won&apos;t miss it: it was never in your weekly budget.
          </p>
        </div>
        <Slab className="mt-7">
          <p className="text-[15px] text-white/70">In {YEARS} years, possibly</p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(p.value)}</p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            {eur.format(p.deposited)} of your own money plus illustrative returns. Funds can also lose value. Safe to spend this
            week: {eur.format(remaining + weeklyBoost(switches, plan))}.
          </p>
        </Slab>
        <Link href="/" className={`${secondaryButton} mt-6`}>
          Back to home
        </Link>
      </main>
    );
  }

  if (freed <= 0) {
    return (
      <main className={PAGE}>
        {top}
        <PageTitle title="Save what your bills free up">
          Switch a contract first. Solvo can then move the money you no longer pay for bills into a fund every month.
        </PageTitle>
        <Link href="/bills" className={primaryButton}>
          See your bills
        </Link>
      </main>
    );
  }

  const choices = [freed, Math.round(freed / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <main className={`${PAGE} pb-[calc(6rem+var(--tabbar-h))]`}>
      {top}
      <PageTitle title="Save what your bills free up">
        Your cheaper contracts free {eur.format(freed)} a month. Spend it, or let it grow in an S-Pankki fund.
      </PageTitle>

      <Slab>
        <p className="text-[15px] text-white/70">
          {eur.format(monthly)} a month for {YEARS} years could become
        </p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(proj.value)}</p>
        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
          {eur.format(proj.deposited)} of your own money, growing at an illustrative {net.toLocaleString("fi-FI")} % a year after
          fees. Funds can also lose value; past returns don&apos;t guarantee future ones.
        </p>
      </Slab>

      <Group title="How much each month?" footer={`The rest, ${eur.format(((freed - monthly) * 12) / 52)} a week, stays in your budget.`}>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex gap-2">
            {choices.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setShare(v)}
                className={`num h-11 flex-1 rounded-xl text-[15px] font-semibold ${monthly === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {v === freed ? "All" : "Half"} · {eur.format(v)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={5}
            max={freed}
            step={1}
            value={monthly}
            onChange={(e) => setShare(Number(e.target.value))}
            className="h-11 w-full accent-primary"
            aria-label="Monthly amount"
          />
        </div>
      </Group>

      <Group title="Which fund?" footer="You choose. Solvo doesn't give investment advice. Fund types are illustrative.">
        {FUNDS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFundId(f.id)}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t"
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${f.id === fundId ? "border-primary bg-primary" : "border-border"}`}
              aria-hidden
            >
              {f.id === fundId && <span className="size-2 rounded-full bg-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{f.name}</span>
              <span className="block text-[13px] text-muted-foreground">
                {f.description}, fee {f.yearlyFeePct.toLocaleString("fi-FI")} % a year
              </span>
            </span>
            <Chip>Risk {f.risk}/7</Chip>
          </button>
        ))}
      </Group>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pt-6 pb-[calc(0.75rem+var(--tabbar-h))]">
        <button type="button" className={primaryButton} onClick={() => setConfirming(true)}>
          Start saving {eur.format(monthly)} a month
        </button>
      </div>

      {confirming && (
        <ApproveSheet
          title="You approve this savings plan"
          points={[
            `${eur.format(monthly)} from your account to the ${fund.name.toLowerCase()} on the ${DAY_OF_MONTH}nd of every month.`,
            "No subscription fee. Pause, change or stop any time.",
            "Demo: fund types are illustrative, not real S-Pankki products.",
          ]}
          confirmLabel="Approve"
          onConfirm={() =>
            approveSavingsPlan({ monthly, fundId: fund.id, fundName: fund.name, dayOfMonth: DAY_OF_MONTH, approvedAt: new Date().toISOString() })
          }
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}
