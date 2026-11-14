import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { INVOICES } from "@/data/einvoices/CUST01787";
import { safeToSpend } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { BillsClient } from "./bills-client";

export const metadata = { title: "Your bills · Solvo" };

export default async function BillsPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const s = safeToSpend(MAIN_CUSTOMER);
  return (
    <Screen>
      <BillsClient
        asOf={MAIN_CUSTOMER.asOf}
        invoices={INVOICES.map(({ id, payment }) => ({ id, payment }))}
        weeklyBudget={s.weeklyBudget}
        remaining={s.remaining}
      />
    </Screen>
  );
}
