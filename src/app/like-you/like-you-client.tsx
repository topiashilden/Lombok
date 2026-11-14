"use client";

import Link from "next/link";
import { useState } from "react";
import { Car, Receipt, ShoppingBag, Utensils } from "lucide-react";
import {
  BackLink,
  Chip,
  Group,
  IconTile,
  PAGE,
  PageTitle,
  Row,
  Slab,
  TopBar,
  eur,
  primaryButton,
  secondaryButton,
} from "@/components/solvo/ui";

type Match = {
  id: string;
  age: number;
  postal: string;
  samePostal: boolean;
  period: { from: string; to: string };
  salaryYear: number;
  utilitiesYear: number;
  utilityPayments: number;
  restaurantsYear: number;
  taxiYear: number;
  topLeak: string;
  topLeakYear: number;
  weeklyBudget: number;
  usualWeekly: number;
  estimatedSaving: number;
  estimatedSavingPerWeek: number;
};

const input =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-[16px] outline-none focus:border-primary";

/** Peer-review hook: a visitor types their age and postal code and sees a real customer like them. */
export function LikeYouClient() {
  const [age, setAge] = useState("");
  const [postal, setPostal] = useState("");
  const [state, setState] = useState<{
    busy: boolean;
    error?: string;
    match?: Match;
  }>({ busy: false });

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch(
        `/api/lookalike?age=${encodeURIComponent(age)}&postal=${encodeURIComponent(postal)}`,
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No match found.");
      setState({ busy: false, match: d });
    } catch (err) {
      setState({
        busy: false,
        error: err instanceof Error ? err.message : "No match found.",
      });
    }
  }

  const top = <TopBar back={<BackLink href="/" label="Home" />} />;
  const m = state.match;

  if (m) {
    const budget = Math.max(0, m.weeklyBudget);
    const over = m.usualWeekly - budget;
    return (
      <main className={PAGE}>
        {top}
        <PageTitle title="A customer like you">
          {m.age} years old, postal code {m.postal}
          {m.samePostal ? ", same as yours" : ", the closest match"}. One of
          5,100 customers in S-Pankki&apos;s dataset.
        </PageTitle>

        <Slab>
          <p className="text-[15px] text-white/70">
            Solvo could likely cut their bills by
          </p>
          <p className="num mt-1 font-display text-[56px] leading-none font-semibold tracking-[-0.035em]">
            {eur.format(m.estimatedSaving)}
            <span className="text-[22px] font-medium text-white/60"> /yr</span>
          </p>
          <p className="mt-4 border-t border-white/10 pt-3 text-[13px] leading-snug text-white/65">
            That&apos;s {eur.format(m.estimatedSavingPerWeek)} more to spend
            every week. Estimate: they paid {eur.format(m.utilitiesYear)} in
            bills last year. Switching electricity and phone cut our demo
            customer&apos;s bills by 27 %.
          </p>
        </Slab>

        <Group title="What the bank sees" aside="last 12 months">
          <Row
            icon={
              <IconTile tone="warn">
                <Receipt />
              </IconTile>
            }
            title="Bills with no supplier name"
            subtitle={`${m.utilityPayments} payments the bank can't identify`}
            value={eur.format(m.utilitiesYear)}
          />
          <Row
            icon={
              <IconTile tone="grey">
                <ShoppingBag />
              </IconTile>
            }
            title={`Biggest everyday spend: ${m.topLeak}`}
            value={eur.format(m.topLeakYear)}
          />
          <Row
            icon={
              <IconTile tone="grey">
                <Utensils />
              </IconTile>
            }
            title="Restaurants"
            value={eur.format(m.restaurantsYear)}
          />
          <Row
            icon={
              <IconTile tone="grey">
                <Car />
              </IconTile>
            }
            title="Taxis"
            value={eur.format(m.taxiYear)}
          />
        </Group>

        <Group
          title="Safe to spend each week"
          footer={
            m.weeklyBudget < 0
              ? "Their bills and savings goal already take all of their salary. Cheaper bills are where Solvo starts."
              : over > 0
                ? `They usually spend ${eur.format(over)} a week more than that. Solvo would show them where.`
                : "They usually stay within it."
          }
        >
          <Row
            title="Weekly budget"
            subtitle="After bills, irregular costs and a €200/month savings goal"
            value={eur.format(budget)}
          />
          <Row
            title="What they usually spend"
            value={eur.format(m.usualWeekly)}
          />
        </Group>

        <Link href="/bills" className={`${primaryButton} mt-7`}>
          See how Solvo cuts the bills
        </Link>
        <button
          type="button"
          onClick={() => setState({ busy: false })}
          className={`${secondaryButton} mt-2`}
        >
          Try another age
        </button>
        <p className="mt-6 flex flex-wrap items-center gap-2 px-1 text-[12px] leading-snug text-muted-foreground">
          <Chip>{m.id}</Chip> Synthetic Junction 2026 data. Nothing you type is
          stored.
        </p>
      </main>
    );
  }

  return (
    <main className={PAGE}>
      {top}
      <PageTitle title="Find a customer like you">
        Tell us your age and postal code. Solvo picks the closest of 5,100
        S-Pankki customers and shows what it would find for them.
      </PageTitle>
      <form
        onSubmit={find}
        className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-[0_1px_3px_rgba(15,42,31,0.06)]"
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-foreground">
          Age
          <input
            className={input}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            required
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
            placeholder="34"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-muted-foreground">
          Postal code
          <input
            className={input}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            value={postal}
            onChange={(e) => setPostal(e.target.value.replace(/\D/g, ""))}
            placeholder="02150"
          />
        </label>
        <button
          type="submit"
          disabled={state.busy || !age}
          className={primaryButton}
        >
          {state.busy ? "Finding…" : "Find my match"}
        </button>
        {state.error && <p className="text-[13px] text-warn">{state.error}</p>}
      </form>
      <p className="mt-3 px-1 text-[12px] leading-snug text-muted-foreground">
        The dataset covers the Helsinki region. Nothing you type is stored.
      </p>
    </main>
  );
}
