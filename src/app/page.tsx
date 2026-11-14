import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeToSpend, topCategories, unknownBills } from "@/lib/coach";
import { BASKET_LABELS, MAIN_CUSTOMER, type Basket } from "@/lib/demo";

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

export default function Home() {
  const c = MAIN_CUSTOMER;
  const s = safeToSpend(c);
  const bills = unknownBills(c);
  const baskets = [1, 2, 3] as Basket[];
  const yearTotal = baskets.reduce((sum, b) => sum + c.summary.basketYear[b], 0);
  const over = s.remaining < 0;
  const usedShare = Math.min(1, Math.max(0, s.spentThisWeek / s.weeklyBudget));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/solvo-logo.png" alt="Solvo" className="h-7 w-auto" />
          <p className="mt-1 text-sm text-muted-foreground">Fixed costs aren&apos;t fixed.</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          Age {c.age} · {c.postalCode}
          <br />
          Today {fmtDate(c.asOf)}
        </p>
      </header>

      {/* The one number */}
      <Card className="bg-emerald-950 text-emerald-50 ring-emerald-900">
        <CardHeader>
          <CardDescription className="text-emerald-200">Safe to spend this week</CardDescription>
          <CardTitle className={`text-5xl font-semibold tracking-tight ${over ? "text-red-300" : ""}`}>
            {over ? `−${eur.format(-s.remaining)}` : eur.format(s.remaining)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-900">
            <div
              className={`h-full rounded-full ${over ? "bg-red-400" : "bg-emerald-400"}`}
              style={{ width: `${usedShare * 100}%` }}
            />
          </div>
          <p className="text-sm text-emerald-200">
            {eur.format(s.spentThisWeek)} spent since {fmtDate(s.weekStart)} of your {eur.format(s.weeklyBudget)} weekly
            budget · {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left
          </p>
        </CardContent>
      </Card>

      {/* Coach chat entry */}
      <div className="flex flex-col gap-2">
        <Link
          href="/coach"
          className="flex h-11 items-center justify-between rounded-xl border bg-card px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          <span>Ask Solvo about your money…</span>
          <span className="font-medium text-emerald-800">Ask</span>
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {["How much did I spend on taxis?", "Can I afford an €80 dinner this week?"].map((q) => (
            <Link
              key={q}
              href={`/coach?q=${encodeURIComponent(q)}`}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {q}
            </Link>
          ))}
        </div>
      </div>

      {/* How the number is built */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>How we got there</CardTitle>
          <CardDescription>Per month, from your last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
            <dt>Salary</dt>
            <dd className="text-right tabular-nums">{eur.format(s.incomePerMonth)}</dd>
            <dt className="text-muted-foreground">− Fixed and regular bills</dt>
            <dd className="text-right tabular-nums text-muted-foreground">−{eur.format(s.fixedRegularPerMonth)}</dd>
            <dt className="text-muted-foreground">− Set aside for irregular costs</dt>
            <dd className="text-right tabular-nums text-muted-foreground">−{eur.format(s.irregularSetAsidePerMonth)}</dd>
            <dt className="text-muted-foreground">− Savings goal (you set this)</dt>
            <dd className="text-right tabular-nums text-muted-foreground">−{eur.format(s.savingsGoalPerMonth)}</dd>
            <dt className="border-t pt-1.5 font-medium">Everyday budget</dt>
            <dd className="border-t pt-1.5 text-right font-medium tabular-nums">{eur.format(s.everydayBudgetPerMonth)}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            You usually spend {eur.format(s.usualWeeklyEveryday)} a week on everyday things.
            {s.usualWeeklyEveryday > s.weeklyBudget
              ? ` That's ${eur.format(s.usualWeeklyEveryday - s.weeklyBudget)} more than your budget allows.`
              : " That fits your budget."}
          </p>
        </CardContent>
      </Card>

      {/* The bank's blind spot, and Solvo's hook */}
      <Card size="sm" className="ring-amber-300 bg-amber-50">
        <CardHeader>
          <CardDescription className="text-amber-800">Your bills</CardDescription>
          <CardTitle>
            {eur.format(bills.perYear)} a year, ~{Math.round(bills.paymentsPerMonth)} bills a month
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-950">
          Your bank sees the amounts, but {Math.round(bills.withoutMerchant * 100)}% of these payments have no merchant
          or contract attached. Fixed costs aren&apos;t fixed: Solvo reads your e-invoices to find out what you&apos;re
          paying for, and whether you&apos;re overpaying.
          <Link
            href="/bills"
            className="mt-3 flex h-10 items-center justify-center rounded-lg bg-emerald-800 font-medium text-white hover:bg-emerald-900"
          >
            See what Solvo found
          </Link>
        </CardContent>
      </Card>

      {/* Three baskets */}
      <h2 className="mt-2 text-sm font-medium text-muted-foreground">Your three baskets, last 12 months</h2>
      {baskets.map((b) => {
        const perYear = c.summary.basketYear[b];
        return (
          <Card key={b} size="sm">
            <CardHeader>
              <CardDescription>Basket {b}</CardDescription>
              <CardTitle className="flex items-baseline justify-between">
                <span>{BASKET_LABELS[b].title}</span>
                <span className="tabular-nums">{eur.format(perYear / 12)}/mo</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(perYear / yearTotal) * 100}%` }} />
              </div>
              <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                {topCategories(c, b).map((t) => (
                  <li key={t.category} className="flex justify-between">
                    <span>{t.category}</span>
                    <span className="tabular-nums">{eur.format(t.perYear)}/yr</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <footer className="mt-2 text-xs text-muted-foreground">
        Demo with S-Pankki&apos;s synthetic Junction 2026 dataset, customer {c.id}. The savings goal is an assumption.
      </footer>
    </main>
  );
}
