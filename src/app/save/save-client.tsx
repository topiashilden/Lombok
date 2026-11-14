"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Landmark, PiggyBank, Receipt, Target, TrendingUp } from "lucide-react";
import { PortfolioChart } from "@/components/portfolio-chart";
import { PORTFOLIO_MONTHS, portfolio } from "@/data/portfolio";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Chip, Group, IconTile, PAGE, PageTitle, Row, Slab, TopBar, eur, primaryButton, secondaryButton } from "@/components/solvo/ui";
import { FUND_TYPES, FUNDS, FUNDS_SOURCE, fundById, projectFund, type FundType } from "@/lib/funds";
import { approveSavingsPlan, cancelSavingsPlan, monthlyFreed, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";

const YEARS = 10;
const DAY_OF_MONTH = 2; // the day after a typical salary day
const pct = (n: number) => `${n.toLocaleString("fi-FI")} %`;
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const PF = portfolio();
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${eur.format(Math.abs(n))}`;
const signedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} %`;

/** The 10-year projection for a monthly amount, on a light card (the Slab is the portfolio). */
function Projection({ monthly, fundId }: { monthly: number; fundId: string }) {
  const f = fundById(fundId);
  const p = projectFund(monthly, YEARS, f);
  return (
    <section className="mt-4 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]">
      <p className="text-[13px] text-muted-foreground">
        {eur.format(monthly)} a month for {YEARS} years could become
      </p>
      <p className="num mt-1 font-display text-[34px] leading-none font-semibold tracking-[-0.03em]">{eur.format(p.value)}</p>
      <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
        {eur.format(p.deposited)} of your own money. Illustrative {pct(f.illustrativeReturnPct)} a year before fees; fees take
        about {eur.format(p.fees)} over {YEARS} years. Funds can also lose value.
      </p>
    </section>
  );
}

function nextInvestDate(asOf: string) {
  const d = new Date(`${asOf}T00:00:00Z`);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + (d.getUTCDate() >= DAY_OF_MONTH ? 1 : 0), DAY_OF_MONTH));
  return dateFmt.format(next);
}

type Props = {
  remaining: number;
  asOf: string;
  balance: number;
  inFunds: number;
  fundDeposits: number;
  savingsGoal: number;
};

export function SaveClient(props: Props) {
  const switches = useSwitches();
  const plan = useSavingsPlan();
  const freed = Math.floor(monthlyFreed(switches));
  const [billShare, setBillShare] = useState<"all" | "half" | "none">("all");
  const [fundId, setFundId] = useState(FUNDS[0].id);
  const [fundType, setFundType] = useState<FundType>("Equity");
  const typeInfo = FUND_TYPES.find((t) => t.type === fundType)!;
  const [confirming, setConfirming] = useState(false);

  const fromBills = billShare === "all" ? freed : billShare === "half" ? Math.round(freed / 2) : 0;
  const monthly = props.savingsGoal + fromBills;
  const fund = fundById(fundId);
  const next = nextInvestDate(props.asOf);

  const now = (
    <>
      <Slab>
        <p className="text-[15px] text-white/70">Your funds are worth</p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(PF.value)}</p>
        <p className="mt-2 text-[15px] text-white/80">
          <span className="num font-semibold text-mint">
            {signed(PF.gain)} ({signedPct(PF.gainPct)})
          </span>{" "}
          on the {eur.format(PF.invested)} you put in
        </p>
        <PortfolioChart months={PORTFOLIO_MONTHS} values={PF.total} invested={PF.invested} />
        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
          Last 12 months {signedPct(PF.yearChangePct)}.{" "}
          {plan ? `Your monthly plan starts on ${next}.` : "You haven't added to your funds since 2023."}
        </p>
      </Slab>
      <Group title="Your funds" aside="value · last 12 months">
        {PF.holdings.map((h) => {
          const f = fundById(h.fundId);
          return (
            <Row
              key={h.fundId}
              icon={
                <IconTile>
                  <TrendingUp />
                </IconTile>
              }
              title={f.name.replace("S-Pankki ", "")}
              subtitle={`Since ${h.since}, you put in ${eur.format(h.invested)}`}
              value={eur.format(h.value)}
              valueSub={signedPct(h.yearChangePct)}
            />
          );
        })}
        <Row
          icon={
            <IconTile tone="grey">
              <Landmark />
            </IconTile>
          }
          title="On your account"
          subtitle={`Cash, ${dateFmt.format(new Date(`${props.asOf}T00:00:00Z`))}`}
          value={eur.format(props.balance)}
        />
      </Group>
    </>
  );

  if (plan) {
    const pf = fundById(plan.fundId);
    const billsPart = plan.fromBills ?? (plan.fromGoal === undefined ? plan.monthly : 0); // older plans: all from bills
    return (
      <main className={PAGE}>
        <TopBar />
        <PageTitle title="Your investments">
          Plus {eur.format(plan.monthly)} a month into {pf.name.replace("S-Pankki ", "")}, on the {plan.dayOfMonth}nd. Change
          or stop it any time.
        </PageTitle>
        {now}
        <Group title="Each month">
          {(plan.fromGoal ?? 0) > 0 && (
            <Row
              icon={
                <IconTile>
                  <Target />
                </IconTile>
              }
              title="Your savings goal"
              subtitle="Already outside your weekly budget"
              value={eur.format(plan.fromGoal ?? 0)}
            />
          )}
          {billsPart > 0 && (
            <Row
              icon={
                <IconTile>
                  <Receipt />
                </IconTile>
              }
              title="From cheaper bills"
              subtitle="Money your old contracts used to take"
              value={eur.format(billsPart)}
            />
          )}
          <Row
            icon={
              <IconTile>
                <CalendarDays />
              </IconTile>
            }
            title="Next investment"
            subtitle={`Ongoing fee ${pct(pf.ongoingFeePct)} a year`}
            value={next}
          />
        </Group>
        <Projection monthly={plan.monthly} fundId={plan.fundId} />
        <p className="mt-4 px-1 text-[13px] leading-snug text-muted-foreground">
          Safe to spend this week: {eur.format(props.remaining + weeklyBoost(switches, plan))}.
        </p>
        <button type="button" onClick={cancelSavingsPlan} className={`${secondaryButton} mt-6`}>
          Change plan
        </button>
      </main>
    );
  }

  return (
    <main className={PAGE}>
      <TopBar />
      <PageTitle title="Your investments">
        How your S-Pankki funds are doing, and a monthly plan to keep them growing.
      </PageTitle>

      {now}

      <h2 className="mt-9 px-1 font-display text-[22px] font-semibold tracking-[-0.015em]">Start investing again</h2>
      <p className="mt-1 px-1 text-[15px] leading-snug text-muted-foreground">
        Your monthly savings goal, plus what your cheaper bills free up.
      </p>

      <Group
        title="How much each month?"
        footer={
          freed > 0 ? (
            fromBills < freed ? (
              `The rest of the bill savings, ${eur.format(((freed - fromBills) * 12) / 52)} a week, stays in your budget.`
            ) : (
              `Your cheaper bills had added ${eur.format((freed * 12) / 52)} a week to your budget. That now goes to your fund instead.`
            )
          ) : (
            <>
              Switch a bill to add more.{" "}
              <Link href="/bills" className="-my-3 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                See your bills
              </Link>
            </>
          )
        }
      >
        <Row
          icon={
            <IconTile>
              <Target />
            </IconTile>
          }
          title="Your savings goal"
          subtitle="Already outside your weekly budget"
          value={eur.format(props.savingsGoal)}
        />
        {freed > 0 && (
          <div className="border-t px-4 py-3">
            <div className="flex items-center gap-3">
              <IconTile>
                <Receipt />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">From cheaper bills</p>
                <p className="text-[13px] text-muted-foreground">{eur.format(freed)} a month freed up</p>
              </div>
              <p className="num text-[15px] font-medium">{eur.format(fromBills)}</p>
            </div>
            <div className="mt-3 flex gap-2">
              {(["all", "half", "none"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBillShare(k)}
                  className={`h-11 flex-1 rounded-xl text-[15px] font-semibold ${billShare === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {k === "all" ? "All" : k === "half" ? "Half" : "None"}
                </button>
              ))}
            </div>
          </div>
        )}
      </Group>

      <div className="mt-7 flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">Which fund?</h2>
        {fund.type !== fundType && (
          <span className="truncate text-[13px] text-muted-foreground">Chosen: {fund.name.replace("S-Pankki ", "")}</span>
        )}
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Fund type">
        {FUND_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            role="tab"
            aria-selected={fundType === t.type}
            onClick={() => setFundType(t.type)}
            className={`flex h-11 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap ${fundType === t.type ? "bg-primary text-primary-foreground" : "bg-card text-foreground/80 shadow-[0_1px_3px_rgba(15,42,31,0.06)]"}`}
          >
            {t.label} · {FUNDS.filter((f) => f.type === t.type).length}
          </button>
        ))}
      </div>
      <Group
        className="mt-3"
        footer={`${typeInfo.note ? `${typeInfo.note} ` : ""}You choose: Solvo doesn't give investment advice. ${FUNDS_SOURCE}`}
      >
        {FUNDS.filter((f) => f.type === fundType).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFundId(f.id)}
            aria-pressed={f.id === fundId}
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t"
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${f.id === fundId ? "border-primary bg-primary" : "border-border"}`}
              aria-hidden
            >
              {f.id === fundId && <span className="size-2 rounded-full bg-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-snug font-medium">{f.name}</span>
              <span className="block text-[13px] leading-snug text-muted-foreground">
                {f.description}. Fee {pct(f.ongoingFeePct)} a year
                {f.subscriptionFeePct ? `, ${pct(f.subscriptionFeePct)} per purchase` : ""}
              </span>
            </span>
            {f.subscriptionFeePct >= 1 && <Chip tone="warn">Special</Chip>}
          </button>
        ))}
      </Group>

      <Projection monthly={monthly} fundId={fund.id} />

      <div className="mt-4">
        <button type="button" className={primaryButton} onClick={() => setConfirming(true)}>
          <PiggyBank className="size-[18px]" aria-hidden />
          Start investing {eur.format(monthly)} a month
        </button>
      </div>

      {confirming && (
        <ApproveSheet
          title="You approve this investment plan"
          points={[
            `${eur.format(monthly)} from your account to ${fund.name} on the ${DAY_OF_MONTH}nd of every month, first on ${next}.`,
            `Fund fee ${pct(fund.ongoingFeePct)} a year${fund.subscriptionFeePct ? ` and ${pct(fund.subscriptionFeePct)} per purchase` : ""}. Pause, change or stop any time.`,
            "Demo: no real fund order is placed.",
          ]}
          confirmLabel="Approve"
          onConfirm={() =>
            approveSavingsPlan({
              monthly,
              fromGoal: props.savingsGoal,
              fromBills,
              fundId: fund.id,
              fundName: fund.name,
              dayOfMonth: DAY_OF_MONTH,
              approvedAt: new Date().toISOString(),
            })
          }
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}
