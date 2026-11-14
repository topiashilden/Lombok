import { Suspense } from "react";
import { Screen } from "@/components/solvo/screen";
import { PAGE } from "@/components/solvo/ui";
import { INVOICES } from "@/data/einvoices/CUST01787";
import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import { safeToSpend } from "@/lib/coach";
import { getSource, pageMode } from "@/lib/source";
import type { PaidBill } from "./bill-history";
import { BillsClient } from "./bills-client";

export const metadata = { title: "Your bills · Solvo" };

export default function BillsPage() {
  return (
    <Screen>
      <Suspense fallback={<main className={PAGE} />}>
        <Bills />
      </Suspense>
    </Screen>
  );
}

async function Bills() {
  const { customer: c, mode } = getSource(await pageMode());
  // The synthetic e-invoices (and the dentist bill) belong to Aino's demo story. The new customer has none yet.
  const invoices = mode === "aino" ? INVOICES : [];
  const s = safeToSpend(c);
  // Rent and utility payments in the last 12 months. A payment that matches an e-invoice Solvo has read gets the
  // supplier's name; the others have none, because utility payments in the data carry no merchant.
  const from = `${c.summary.last12Months[0]}-01`;
  const history: PaidBill[] = c.transactions
    .filter((t) => (t.type === "housing_payment" || t.type === "utilities_payment") && t.date >= from && t.amount < 0)
    .map((t) => {
      const inv = invoices.find((i) => i.payment.date === t.date && i.payment.amount === t.amount);
      return {
        date: t.date,
        kind: t.type === "housing_payment" ? "rent" : "utility",
        amount: -t.amount,
        supplier: inv ? SAVED_READINGS[inv.id]?.supplier : undefined,
      };
    });
  return (
    <BillsClient
      asOf={c.asOf}
      invoices={invoices.map(({ id, payment }) => ({ id, payment }))}
      weeklyBudget={s.weeklyBudget}
      remaining={s.remaining}
      history={history}
      dentalBill={mode === "aino"}
    />
  );
}
