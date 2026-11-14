import { Screen } from "@/components/solvo/screen";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH, safeToSpend } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { SaveClient } from "./save-client";

export const metadata = { title: "Invest · Solvo" };

export default function SavePage() {
  const c = MAIN_CUSTOMER;
  const last = c.transactions[c.transactions.length - 1];
  // Fund deposits and withdrawals in the data (Aino has none: she doesn't invest yet).
  const fundTx = c.transactions.filter((t) => t.category === "Invest Deposit" || t.category === "Invest Withdraw");
  const inFunds = -fundTx.reduce((sum, t) => sum + t.amount, 0);
  return (
    <Screen>
      <SaveClient
        remaining={safeToSpend(c).remaining}
        asOf={c.asOf}
        balance={last?.balance ?? 0}
        inFunds={Math.max(0, inFunds)}
        fundDeposits={fundTx.filter((t) => t.amount < 0).length}
        savingsGoal={DEFAULT_SAVINGS_GOAL_PER_MONTH}
      />
    </Screen>
  );
}
