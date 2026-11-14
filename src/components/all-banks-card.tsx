import { Landmark, PiggyBank, Repeat, TrendingUp } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import { MoneyBadge, SignedAmount } from "@/components/solvo/money-badge";
import { Group, IconTile, Row, eur } from "@/components/solvo/ui";
import { bankFacts } from "@/lib/combine";
import type { BankId, View } from "@/lib/banks";
import type { DemoCustomer } from "@/lib/demo";
import { portfolio } from "@/data/portfolio";

/**
 * Home, only once another bank is connected: the whole money picture across banks, and what the other bank adds that S-Pankki
 * alone cannot see. DEMO data for the second bank and Nordnet (src/lib/second-bank.ts).
 */
export function AllBanksCard({ base, banks, view }: { base: DemoCustomer; banks: BankId[]; view: View }) {
  if (!banks.length) return null;
  const f = bankFacts(base, banks);
  const funds = Math.round(portfolio().value);
  const cash = f.spankki.cash + (f.nordea ? f.nordea.everyday + f.nordea.savings : 0);
  const invested = funds + (f.nordnet ? Math.round(f.nordnet.value) : 0);
  const subs = f.nordea?.bills.find((b) => b.label === "Subscriptions");
  const insurance = f.nordea?.bills.find((b) => b.label === "Insurance");

  return (
    <Group title="All your banks" className="mt-4" footer="Demo: example data for the connected banks. Transfers between your own accounts are not counted as spending.">
      <div className="p-3">
        <ViewToggle banks={banks} view={view} />
      </div>
      {view === "all" ? (
        <>
          <Row
            icon={<IconTile><Landmark /></IconTile>}
            title="Cash and savings"
            subtitle={`S-Pankki ${eur.format(f.spankki.cash)}${f.nordea ? ` · Nordea ${eur.format(f.nordea.everyday + f.nordea.savings)}` : ""}`}
            value={eur.format(cash)}
          />
          <Row
            icon={<IconTile><TrendingUp /></IconTile>}
            title="Investments"
            subtitle={`S-Pankki funds ${eur.format(funds)}${f.nordnet ? ` · Nordnet ${eur.format(Math.round(f.nordnet.value))}` : ""}`}
            value={eur.format(invested)}
          />
          {f.nordea && f.nordea.sideIncomeMonthly > 0 && (
            <Row icon={<MoneyBadge kind="in" />} title="Side income at Nordea" subtitle="S-Pankki can't see this" value={<SignedAmount kind="in" value={f.nordea.sideIncomeMonthly} />} valueSub="a month" />
          )}
          {subs && (
            <Row icon={<IconTile><Repeat /></IconTile>} title="Subscriptions" subtitle={subs.names} value={<SignedAmount kind="out" value={subs.monthly} />} valueSub="a month" />
          )}
          {insurance && (
            <Row icon={<MoneyBadge kind="out" />} title="Insurance" subtitle={insurance.names} value={<SignedAmount kind="out" value={insurance.monthly} />} valueSub="a month" />
          )}
          {f.nordea && f.nordea.movedBetweenAccountsMonthly > 0 && (
            <Row
              icon={<IconTile tone="grey"><PiggyBank /></IconTile>}
              title="Moved between your accounts"
              subtitle="To savings and to Nordnet. Saving, not spending."
              value={eur.format(f.nordea.movedBetweenAccountsMonthly)}
              valueSub="a month"
            />
          )}
        </>
      ) : (
        <p className="px-4 pb-4 text-[14px] leading-snug text-muted-foreground">Showing S-Pankki only. Switch to All banks to include what your other banks add.</p>
      )}
    </Group>
  );
}
