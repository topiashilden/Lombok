import { INVOICES } from "@/data/einvoices/CUST01787";
import { safeToSpend } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { BillsClient } from "./bills-client";

export const metadata = { title: "Your bills · Solvo" };

export default function BillsPage() {
  const s = safeToSpend(MAIN_CUSTOMER);
  return (
    <BillsClient
      asOf={MAIN_CUSTOMER.asOf}
      invoices={INVOICES.map(({ id, payment }) => ({ id, payment }))}
      weeklyBudget={s.weeklyBudget}
      remaining={s.remaining}
    />
  );
}
