import "server-only";
import { Landmark, Repeat } from "lucide-react";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { Group, IconTile, Row, eur } from "@/components/solvo/ui";
import { plainFormat } from "@/lib/demo-clock";
import { currentLinked, linkedSummary, type LinkedSummary } from "@/lib/linked-bank";

const day = plainFormat({ day: "numeric", month: "short" });

/**
 * Home, only after the visitor has connected a bank on Profile. Read from Enable Banking per request: balances and a year of
 * transactions, shown as cash, the last 30 days, recurring payments and the latest payments. In the demo it is Enable Banking's
 * sandbox, so the bank is a test bank and the figures are example data. Its own card, not merged into the S-Pankki budget, because a
 * test bank's dates and amounts say nothing about Aino's month.
 */
export async function LinkedBankCard() {
  const linked = await currentLinked();
  if (!linked) return null;
  let s: LinkedSummary | null = null;
  try {
    s = await linkedSummary(linked);
  } catch {
    // Shown below as a short notice, never as an error page.
  }
  return (
    <Group title={linked.bank} className="mt-4" footer="Read live from Enable Banking. Demo: a test bank with example data. Not part of your S-Pankki budget.">
      {!s ? (
        <Row icon={<IconTile tone="warn"><Landmark /></IconTile>} title="Couldn't read this bank right now" subtitle="Try Sync now on Profile." />
      ) : (
        <>
          <Row
            icon={<IconTile><Landmark /></IconTile>}
            title="Balance"
            subtitle={`${s.accounts.length} account${s.accounts.length === 1 ? "" : "s"}, ${s.transactions.toLocaleString("en-GB")} transactions`}
            value={eur.format(s.cash)}
          />
          <Row icon={<MoneyBadge kind="in" />} title="In, last 30 days" value={<SignedAmount kind="in" value={Math.round(s.last30.in)} />} />
          <Row icon={<MoneyBadge kind="out" />} title="Out, last 30 days" value={<SignedAmount kind="out" value={Math.round(s.last30.out)} />} />
          {s.recurring.map((r) => (
            <Row key={r.title} icon={<IconTile><Repeat /></IconTile>} title={r.title} subtitle="Same amount every month" value={<SignedAmount kind="out" value={Math.round(r.amount)} />} valueSub="a month" />
          ))}
          {s.recent.map((t, i) => (
            <Row
              key={`${t.date}-${i}`}
              title={t.title}
              subtitle={day(t.date)}
              value={t.amount < 0 ? <SignedAmount kind="out" value={Math.round(-t.amount)} /> : <SignedAmount kind="in" value={Math.round(t.amount)} />}
            />
          ))}
        </>
      )}
    </Group>
  );
}
