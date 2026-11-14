import Link from "next/link";
import { ArrowRight, MessageCircle, ReceiptText, Users } from "lucide-react";
import { LiveWeeklyEuro, ResetDemoButton, SwitchBoostNote } from "@/components/live-budget";
import { OverdueBillCard } from "@/components/overdue-bill";
import { Chip, Group, IconTile, Logo, PAGE, Row, Slab, eur, primaryButton } from "@/components/solvo/ui";
import { safeToSpend, topCategories, unknownBills } from "@/lib/coach";
import { BASKET_LABELS, type Basket } from "@/lib/demo";
import { getSource } from "@/lib/source";

const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const BASKET_COLOR: Record<Basket, string> = { 1: "bg-chart-1", 2: "bg-chart-2", 3: "bg-chart-4" };

export default function Home() {
  const { customer: c, local } = getSource();
  const s = safeToSpend(c);
  const bills = unknownBills(c);
  const baskets = [1, 2, 3] as Basket[];
  const yearTotal = baskets.reduce((sum, b) => sum + c.summary.basketYear[b], 0);
  const over = s.remaining < 0;
  const usedShare = Math.min(1, Math.max(0, s.spentThisWeek / s.weeklyBudget));
  const today = Math.min(6, Math.max(0, 7 - s.daysLeft));

  return (
    <main className={PAGE}>
      {local && (
        <p className="mb-2 rounded-xl bg-[#5a1a12] px-3 py-2 text-center text-[12px] font-medium text-white">
          My Nordea data, local only. Do not share or record this screen.
        </p>
      )}
      <header className="flex h-11 items-center justify-between">
        <Logo />
        <span className="text-[13px] text-muted-foreground">{fmtDate(c.asOf)}</span>
      </header>

      {/* The one number */}
      <Slab className="mt-4">
        <p className="text-[15px] text-white/70">Safe to spend this week</p>
        <p
          className={`num animate-rise mt-1 font-display text-[64px] leading-none font-semibold tracking-[-0.035em] ${over ? "text-[#ffb4a3]" : ""}`}
        >
          <LiveWeeklyEuro base={s.remaining} signed />
        </p>
        <p className="mt-2 text-[15px] text-white/70">
          of your <LiveWeeklyEuro base={s.weeklyBudget} /> weekly budget, {s.daysLeft} {s.daysLeft === 1 ? "day" : "days"} left
        </p>

        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/12">
            <div
              className={`animate-fill h-full rounded-full ${over ? "bg-[#ff8a70]" : "bg-mint"}`}
              style={{ width: `${usedShare * 100}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium">
            {DAYS.map((d, i) => (
              <span
                key={i}
                className={
                  i === today
                    ? "mx-auto flex size-5 items-center justify-center rounded-full bg-white text-slab"
                    : i < today
                      ? "leading-5 text-white/55"
                      : "leading-5 text-white/30"
                }
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] text-white/60">
          {eur.format(s.spentThisWeek)} spent since {fmtDate(s.weekStart)}
        </p>
        <SwitchBoostNote className="mt-2 text-[13px] font-semibold text-mint" />
      </Slab>

      <OverdueBillCard asOf={c.asOf} />

      {/* The bank's blind spot, and Solvo's hook */}
      <section className="mt-4 rounded-[24px] bg-card p-5 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
        <div className="flex items-start gap-3">
          <IconTile tone="warn">
            <ReceiptText />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[19px] leading-tight font-semibold tracking-[-0.01em]">
              <span className="num">{eur.format(bills.perYear)}</span> a year goes to bills your bank can&apos;t name
            </p>
            <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
              {Math.round(bills.withoutMerchant * 100)}% of these {Math.round(bills.paymentsPerMonth)} monthly payments
              have no merchant or contract attached. Solvo reads the e-invoices to find out what you pay for, and
              whether you&apos;re overpaying.
            </p>
          </div>
        </div>
        <Link href="/bills" className={`${primaryButton} mt-4`}>
          See what Solvo found
          <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
      </section>

      {/* Coach chat entry */}
      <section className="mt-4">
        <Link
          href="/coach"
          className="flex h-14 items-center gap-3 rounded-2xl bg-card px-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)] active:bg-muted"
        >
          <IconTile>
            <MessageCircle />
          </IconTile>
          <span className="flex-1 text-[15px] text-muted-foreground">Ask Solvo about your money</span>
        </Link>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {["How much did I spend on taxis?", "Can I afford an €80 dinner this week?", "Where could I save the most?"].map(
            (q) => (
              <Link
                key={q}
                href={`/coach?q=${encodeURIComponent(q)}`}
                className="flex h-9 shrink-0 items-center rounded-full border border-border bg-card/60 px-3.5 text-[13px] font-medium whitespace-nowrap text-foreground/80 active:bg-muted"
              >
                {q}
              </Link>
            ),
          )}
        </div>
      </section>

      {/* Peer-review hook */}
      <Link
        href="/like-you"
        className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_1px_3px_rgba(15,42,31,0.06)] active:bg-muted"
      >
        <IconTile>
          <Users />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium">Find a customer like you</span>
          <span className="block text-[13px] text-muted-foreground">Matched by age and postal code from 5,100 customers</span>
        </span>
        <ArrowRight className="size-[18px] text-muted-foreground" aria-hidden />
      </Link>

      {/* How the number is built */}
      <Group
        title="How your budget is built"
        aside="per month"
        footer={
          <>
            You usually spend {eur.format(s.usualWeeklyEveryday)} a week on everyday things.
            {s.usualWeeklyEveryday > s.weeklyBudget
              ? ` That's ${eur.format(s.usualWeeklyEveryday - s.weeklyBudget)} more than your budget allows.`
              : " That fits your budget."}
          </>
        }
      >
        <dl className="num px-4 py-1 text-[15px]">
          <div className="flex justify-between py-2.5">
            <dt>Salary</dt>
            <dd className="font-medium">{eur.format(s.incomePerMonth)}</dd>
          </div>
          {[
            ["Fixed and regular bills", s.fixedRegularPerMonth],
            ["Set aside for irregular costs", s.irregularSetAsidePerMonth],
            ["Savings goal (you set this)", s.savingsGoalPerMonth],
          ].map(([label, v]) => (
            <div key={label} className="flex justify-between py-2.5 text-muted-foreground">
              <dt>{label}</dt>
              <dd>−{eur.format(v as number)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t py-3 font-semibold">
            <dt>Everyday budget</dt>
            <dd>{eur.format(s.everydayBudgetPerMonth)}</dd>
          </div>
        </dl>
      </Group>

      {/* Three baskets */}
      <Group title="Your three baskets" aside="last 12 months">
        <div className="px-4 pt-4 pb-1">
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {baskets.map((b) => (
              <div
                key={b}
                className={BASKET_COLOR[b]}
                style={{ width: `${(c.summary.basketYear[b] / yearTotal) * 100}%` }}
              />
            ))}
          </div>
        </div>
        {baskets.map((b) => {
          const perYear = c.summary.basketYear[b];
          return (
            <Row
              key={b}
              icon={<span className={`size-2.5 shrink-0 rounded-full ${BASKET_COLOR[b]}`} aria-hidden />}
              title={BASKET_LABELS[b].title}
              subtitle={topCategories(c, b)
                .map((t) => t.category)
                .join(", ")}
              value={`${eur.format(perYear / 12)}/mo`}
              valueSub={`${Math.round((perYear / yearTotal) * 100)}%`}
            />
          );
        })}
      </Group>

      <footer className="mt-8 flex flex-col items-start gap-2 px-1 text-[12px] leading-snug text-muted-foreground">
        <Chip>{c.age > 0 ? `Demo customer ${c.id}, age ${c.age}, ${c.postalCode}` : `Customer ${c.id}`}</Chip>
        <p>
          S-Pankki&apos;s synthetic Junction 2026 dataset. The savings goal is an assumption.{" "}
          <ResetDemoButton className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4" />
        </p>
      </footer>
    </main>
  );
}
