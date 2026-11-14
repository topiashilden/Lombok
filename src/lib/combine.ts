// One customer made of several banks. Merges Aino's S-Pankki data with the demo Nordea accounts and recomputes the sums the
// rest of the app reads (baskets, income, monthly totals), so Home, the plan, the calendar and the coach all see the full picture.
// Transfers between her own accounts and deposits to Nordnet are not spending, so they stay out of every basket.
import type { DemoCustomer } from "@/lib/demo";
import type { BankId, Platform } from "@/lib/banks";
import { syntheticBanks } from "@/lib/second-bank";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function combinedCustomer(base: DemoCustomer, banks: BankId[]): DemoCustomer {
  if (!banks.includes("nordea")) return base;
  const nordea = syntheticBanks(base.asOf).nordea;
  const transactions = [...base.transactions, ...nordea.transactions].sort((a, b) => a.date.localeCompare(b.date));
  // Insurance and subscriptions (Netflix, Spotify, a gym) are fixed, regular costs: basket 1.
  const basketOf: DemoCustomer["basketOf"] = { ...base.basketOf, Insurance: 1, Subscriptions: 1 };

  const monthly: DemoCustomer["monthly"] = {};
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    monthly[m] ??= {};
    monthly[m][t.category] = round2((monthly[m][t.category] ?? 0) + t.amount);
  }
  const months = base.summary.last12Months;
  const basketYear = { 1: 0, 2: 0, 3: 0 } as DemoCustomer["summary"]["basketYear"];
  const categoryYear: Record<string, number> = {};
  let salaryYear = 0;
  for (const m of months) {
    for (const [cat, sum] of Object.entries(monthly[m] ?? {})) {
      if (basketOf[cat]) {
        basketYear[basketOf[cat]] = round2(basketYear[basketOf[cat]] - sum);
        categoryYear[cat] = round2((categoryYear[cat] ?? 0) - sum);
      }
      if (cat === "Salary" || cat === "Side income") salaryYear = round2(salaryYear + sum);
    }
  }
  return {
    ...base,
    accounts: [...base.accounts, ...nordea.accounts.map((a) => a.id)],
    basketOf,
    summary: { ...base.summary, basketYear, categoryYear, salaryYear },
    monthly,
    transactions,
  };
}

/** What the connected banks add, in numbers a card or the coach can state. Based on the last 12 complete months. */
export function bankFacts(base: DemoCustomer, banks: BankId[]) {
  const sb = syntheticBanks(base.asOf);
  const months = new Set(base.summary.last12Months);
  const rows = sb.nordea.transactions.filter((t) => months.has(t.date.slice(0, 7)));
  const per = (pred: (t: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((s, t) => s + t.amount, 0) / 12;
  const lastBalance = base.transactions[base.transactions.length - 1]?.balance ?? 0;
  const bills = ["Insurance", "Subscriptions"]
    .map((cat) => ({ cat, monthly: -per((t) => t.category === cat), names: [...new Set(rows.filter((t) => t.category === cat).map((t) => t.merchant))].join(", ") }))
    .filter((b) => b.monthly > 0);
  return {
    spankki: { cash: Math.round(lastBalance) },
    nordea: banks.includes("nordea")
      ? {
          everyday: Math.round(sb.nordea.accounts[0].balance),
          savings: Math.round(sb.nordea.accounts[1].balance),
          sideIncomeMonthly: Math.round(per((t) => t.category === "Side income")),
          billsMonthly: Math.round(bills.reduce((s, b) => s + b.monthly, 0)),
          bills: bills.map((b) => ({ label: b.cat, monthly: Math.round(b.monthly), names: b.names })),
          movedBetweenAccountsMonthly: Math.round(-per((t) => t.category === "Transfer" && t.amount < 0) - per((t) => t.category === "Invest Deposit")),
        }
      : null,
    nordnet: banks.includes("nordnet") ? sb.nordnet : null,
  };
}

/** A paragraph for the coach when other banks are connected: what they add and that the numbers already include them. */
export function banksNoteFor(base: DemoCustomer, banks: BankId[], platform: Platform = "Nordnet", bankName = "Nordea"): string {
  const f = bankFacts(base, banks);
  const parts: string[] = [];
  if (f.nordea) {
    const bills = f.nordea.bills.map((b) => `${b.label} ${f.nordea ? "€" + b.monthly : ""}/month (${b.names})`).join("; ");
    parts.push(
      `${bankName} (demo data): everyday account €${f.nordea.everyday}, savings account €${f.nordea.savings}; side income €${f.nordea.sideIncomeMonthly}/month that S-Pankki cannot see; bills paid from ${bankName}: ${bills}; about €${f.nordea.movedBetweenAccountsMonthly}/month moves between her own accounts and to her investing platform (${platform}), which is saving, not spending.`,
    );
  }
  if (f.nordnet) parts.push(`Separate investing platform, ${platform} (demo data): invested €${f.nordnet.invested}, worth €${f.nordnet.value}, €${f.nordnet.monthlyDeposit}/month deposits.`);
  return `\n\nOther banks the customer connected: ${parts.join(" ")} The safe-to-spend, budgets and spending figures above ALREADY include these banks. When it helps, say that an answer covers all her banks, and mention what S-Pankki alone would not show.`;
}
