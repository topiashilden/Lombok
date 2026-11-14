import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { INVOICES } from "@/data/einvoices/CUST01787";
import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import { safeToSpend } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import type { PaidBill } from "./bill-history";
import { BillsClient } from "./bills-client";

export const metadata = { title: "Your bills · Solvo" };

export default async function BillsPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const s = safeToSpend(MAIN_CUSTOMER);
  // Rent and utility payments in the last 12 months. A payment that matches an e-invoice Solvo has read gets the
  // supplier's name; the others have none, because utility payments in the data carry no merchant.
  const from = `${MAIN_CUSTOMER.summary.last12Months[0]}-01`;
  const history: PaidBill[] = MAIN_CUSTOMER.transactions
    .filter((t) => (t.type === "housing_payment" || t.type === "utilities_payment") && t.date >= from && t.amount < 0)
    .map((t) => {
      const inv = INVOICES.find((i) => i.payment.date === t.date && i.payment.amount === t.amount);
      return {
        date: t.date,
        kind: t.type === "housing_payment" ? "rent" : "utility",
        amount: -t.amount,
        supplier: inv ? SAVED_READINGS[inv.id]?.supplier : undefined,
      };
    });
  return (
    <Screen>
      <BillsClient
        asOf={MAIN_CUSTOMER.asOf}
        invoices={INVOICES.map(({ id, payment }) => ({ id, payment }))}
        weeklyBudget={s.weeklyBudget}
        remaining={s.remaining}
        history={history}
      />
    </Screen>
  );
}
