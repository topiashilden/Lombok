// Names the demo customer's bills from their e-invoices, so the calendar and the plan say "Electricity bill" and the company
// instead of a bare "Utility bill". The bank's own payment rows carry no name; the e-invoices do. In production the
// e-invoices come from the bank's e-invoice stream. Only the demo customer has them.
import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import type { InvoiceKind } from "@/lib/einvoice";
import type { NamedBill } from "@/lib/schedule";

const LABEL: Record<InvoiceKind, string> = {
  electricity_energy: "Electricity bill",
  electricity_transmission: "Grid fee",
  telecom: "Phone and internet",
  other: "Bill",
};

export function namedBillsFor(customerId: string): NamedBill[] {
  if (customerId !== "CUST01787") return [];
  return Object.values(SAVED_READINGS)
    .map((r) => ({ label: LABEL[r.kind], supplier: r.supplier, day: Number(r.dueDate.slice(8, 10)), amount: Math.round(r.total) }))
    .sort((a, b) => a.day - b.day);
}
