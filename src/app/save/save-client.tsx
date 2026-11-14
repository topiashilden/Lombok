"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FUNDS, projectSavings } from "@/lib/funds";
import { approveSavingsPlan, monthlyFreed, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
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

  const header = (
    <header className="flex items-center justify-between">
      <Link href="/" className="text-sm text-muted-foreground">
        ← Home
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/solvo-logo.png" alt="Solvo" className="h-5 w-auto" />
    </header>
  );

  if (plan) {
    const pf = FUNDS.find((f) => f.id === plan.fundId) ?? FUNDS[0];
    const p = projectSavings(plan.monthly, YEARS, pf.illustrativeReturnPct - pf.yearlyFeePct);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        {header}
        <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
          <CardHeader>
            <CardDescription className="text-emerald-200">Monthly savings plan started</CardDescription>
            <CardTitle className="text-4xl font-semibold tracking-tight">{eur.format(plan.monthly)}/month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-emerald-100">
            <p>
              Into your {plan.fundName.toLowerCase()} on the {plan.dayOfMonth}nd of every month, from money your old bills used
              to take. You don&apos;t notice it leaving, because it was never in your weekly budget.
            </p>
            <p>
              In {YEARS} years that&apos;s {eur.format(p.deposited)} saved, possibly about {eur.format(p.value)} with returns.
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Safe to spend this week</CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight">
              {eur.format(remaining + weeklyBoost(switches, plan))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            You can pause or change the plan any time. Reset demo on the home page clears it.
          </CardContent>
        </Card>
        <Link href="/" className="text-center text-sm text-muted-foreground underline underline-offset-4">
          Back to home
        </Link>
      </main>
    );
  }

  if (freed <= 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        {header}
        <h1 className="text-2xl font-semibold tracking-tight">Save what your bills free up</h1>
        <p className="text-sm text-muted-foreground">
          Switch a contract first. Solvo can then move the money you no longer pay for bills into a fund every month.
        </p>
        <Link
          href="/bills"
          className="flex h-11 items-center justify-center rounded-lg bg-emerald-800 font-medium text-white hover:bg-emerald-900"
        >
          See your bills
        </Link>
      </main>
    );
  }

  const choices = [freed, Math.round(freed / 2)].filter((v, i, a) => v > 0 && a.indexOf(v) === i);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      {header}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Save what your bills free up</h1>
        <p className="text-sm text-muted-foreground">
          Your cheaper contracts free {eur.format(freed)} a month. Spend it, or let it grow in an S-Pankki fund.
        </p>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>How much each month?</CardTitle>
          <CardDescription>The rest stays in your weekly budget.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            {choices.map((v) => (
              <button
                key={v}
                onClick={() => setShare(v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${monthly === v ? "border-emerald-700 bg-emerald-50" : ""}`}
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
            className="w-full accent-emerald-800"
            aria-label="Monthly amount"
          />
          <p className="text-sm text-muted-foreground">
            {eur.format(monthly)} a month to the fund, {eur.format(((freed - monthly) * 12) / 52)} a week more to spend.
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Which fund?</CardTitle>
          <CardDescription>You choose. Solvo doesn&apos;t give investment advice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {FUNDS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFundId(f.id)}
              className={`flex flex-col gap-0.5 rounded-lg border p-2 text-left text-sm ${f.id === fundId ? "border-emerald-700 bg-emerald-50" : ""}`}
            >
              <span className="flex justify-between font-medium">
                <span>{f.name}</span>
                <span className="text-xs text-muted-foreground">Risk {f.risk}/7</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {f.description} · fee {f.yearlyFeePct.toLocaleString("fi-FI")} % a year
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
        <CardHeader>
          <CardDescription className="text-emerald-200">In {YEARS} years</CardDescription>
          <CardTitle className="text-4xl font-semibold tracking-tight">{eur.format(proj.value)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-emerald-200">
          {eur.format(proj.deposited)} of your own money, growing at an illustrative {net.toLocaleString("fi-FI")} % a year after
          fees. Funds can also lose value; past returns don&apos;t guarantee future ones.
        </CardContent>
      </Card>

      {!confirming ? (
        <Button className="h-11 bg-emerald-800 text-base text-white hover:bg-emerald-900" onClick={() => setConfirming(true)}>
          Start saving {eur.format(monthly)} a month
        </Button>
      ) : (
        <Card size="sm" className="ring-emerald-700">
          <CardHeader>
            <CardTitle>You approve this savings plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>
                {eur.format(monthly)} from your account to the {fund.name.toLowerCase()} on the {DAY_OF_MONTH}nd of every month.
              </li>
              <li>No subscription fee. Pause, change or stop any time.</li>
              <li>Demo: fund types are illustrative, not real S-Pankki products.</li>
            </ul>
            <div className="flex gap-2">
              <Button
                className="h-10 flex-1 bg-emerald-800 text-white hover:bg-emerald-900"
                onClick={() =>
                  approveSavingsPlan({
                    monthly,
                    fundId: fund.id,
                    fundName: fund.name,
                    dayOfMonth: DAY_OF_MONTH,
                    approvedAt: new Date().toISOString(),
                  })
                }
              >
                Approve
              </Button>
              <Button variant="outline" className="h-10" onClick={() => setConfirming(false)}>
                Not now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
