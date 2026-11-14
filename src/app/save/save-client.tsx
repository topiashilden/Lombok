"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Landmark, PiggyBank, Receipt, Target, TrendingUp } from "lucide-react";
import { ApproveSheet } from "@/app/bills/switch-ui";
import { Chip, Group, IconTile, PAGE, PageTitle, Row, Slab, TopBar, eur, primaryButton, secondaryButton } from "@/components/solvo/ui";
import { FUND_TYPES, FUNDS, FUNDS_SOURCE, fundById, projectFund, type FundType } from "@/lib/funds";
import { approveSavingsPlan, cancelSavingsPlan, monthlyFreed, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";

const YEARS = 10;
const DAY_OF_MONTH = 2; // the day after a typical salary day
const pct = (n: number) => `${n.toLocaleString("fi-FI")} %`;
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

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
  const proj = projectFund(monthly, YEARS, fund);
  const next = nextInvestDate(props.asOf);

  const now = (
    <Group title="Right now" aside={`as of ${dateFmt.format(new Date(`${props.asOf}T00:00:00Z`))}`}>
      <Row
        icon={
          <IconTile tone="grey">
            <Landmark />
          </IconTile>
        }
        title="On your account"
        value={eur.format(props.balance)}
      />
      <Row
        icon={
          <IconTile tone={props.inFunds > 0 || plan ? "green" : "grey"}>
            <TrendingUp />
          </IconTile>
        }
        title="In S-Pankki funds"
        subtitle={
          plan
            ? `First investment on ${next}`
            : props.fundDeposits
              ? `${props.fundDeposits} fund deposits in the last 2 years`
              : "No fund savings in the last 2 years"
        }
        value={eur.format(props.inFunds)}
      />
    </Group>
  );

  if (plan) {
    const pf = fundById(plan.fundId);
    const p = projectFund(plan.monthly, YEARS, pf);
    const billsPart = plan.fromBills ?? (plan.fromGoal === undefined ? plan.monthly : 0); // older plans: all from bills
    return (
      <main className={PAGE}>
        <TopBar />
        <PageTitle title="Your investment plan">
          {eur.format(plan.monthly)} into {pf.name} on the {plan.dayOfMonth}nd of every month. You approved it; change or
          stop it any time.
        </PageTitle>
        <Slab>
          <p className="text-[15px] text-white/70">In {YEARS} years, possibly</p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(p.value)}</p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            {eur.format(p.deposited)} of your own money. Fees take about {eur.format(p.fees)} of the growth over {YEARS} years.
            Illustrative only: funds can also lose value.
          </p>
        </Slab>
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
    <main className={`${PAGE} pb-[calc(6rem+var(--tabbar-h))]`}>
      <TopBar />
      <PageTitle title="Invest your savings">
        Put your monthly savings goal to work in an S-Pankki fund, plus what your cheaper bills free up.
      </PageTitle>

      <Slab>
        <p className="text-[15px] text-white/70">
          {eur.format(monthly)} a month for {YEARS} years could become
        </p>
        <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">{eur.format(proj.value)}</p>
        <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
          {eur.format(proj.deposited)} of your own money. Illustrative {pct(fund.illustrativeReturnPct)} a year before fees; fees
          take about {eur.format(proj.fees)} over {YEARS} years. Funds can also lose value.
        </p>
      </Slab>

      {now}

      <Group
        title="How much each month?"
        footer={
          freed > 0 ? (
            fromBills < freed ? (
              `The rest of the bill savings, ${eur.format(((freed - fromBills) * 12) / 52)} a week, stays in your budget.`
            ) : (
              "Your weekly budget stays the same: this money was never in it."
            )
          ) : (
            <>
              Switch a bill to add more.{" "}
              <Link href="/bills" className="font-medium text-primary underline underline-offset-4">
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

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] bg-gradient-to-t from-background via-background/95 to-background/0 px-4 pt-6 pb-[calc(0.75rem+var(--tabbar-h))]">
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
