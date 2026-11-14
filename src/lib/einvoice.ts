// What Solvo extracts from an e-invoice. Filled by Gemini (src/app/api/read-invoice/route.ts),
// with a saved reading as a fallback so the demo never breaks.

export type InvoiceKind = "electricity_energy" | "electricity_transmission" | "telecom" | "other";

export type Reading = {
  kind: InvoiceKind;
  supplier: string;
  product: string;
  total: number; // EUR incl. VAT
  dueDate: string; // YYYY-MM-DD
  periodStart: string | null;
  periodEnd: string | null;
  // electricity
  consumptionKwh: number | null; // in this invoice
  annualConsumptionKwh: number | null;
  priceCentsPerKwh: number | null; // incl. VAT
  monthlyFee: number | null; // EUR incl. VAT
  contractType: "fixed_term" | "open_ended" | "spot" | "unknown";
  contractEndDate: string | null;
  priceAfterEndCentsPerKwh: number | null;
  monthlyFeeAfterEnd: number | null;
  // all kinds
  monthlyCost: number; // EUR, what this costs per month today
  switchable: boolean; // can the customer change supplier?
  summary: string; // one plain-English sentence for the customer
};

// Gemini responseSchema (OpenAPI subset).
const num = { type: "NUMBER", nullable: true };
const str = { type: "STRING", nullable: true };
export const READING_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["electricity_energy", "electricity_transmission", "telecom", "other"] },
    supplier: { type: "STRING" },
    product: { type: "STRING" },
    total: { type: "NUMBER" },
    dueDate: { type: "STRING" },
    periodStart: str,
    periodEnd: str,
    consumptionKwh: num,
    annualConsumptionKwh: num,
    priceCentsPerKwh: num,
    monthlyFee: num,
    contractType: { type: "STRING", enum: ["fixed_term", "open_ended", "spot", "unknown"] },
    contractEndDate: str,
    priceAfterEndCentsPerKwh: num,
    monthlyFeeAfterEnd: num,
    monthlyCost: { type: "NUMBER" },
    switchable: { type: "BOOLEAN" },
    summary: { type: "STRING" },
  },
  required: [
    "kind", "supplier", "product", "total", "dueDate", "periodStart", "periodEnd", "consumptionKwh",
    "annualConsumptionKwh", "priceCentsPerKwh", "monthlyFee", "contractType", "contractEndDate",
    "priceAfterEndCentsPerKwh", "monthlyFeeAfterEnd", "monthlyCost", "switchable", "summary",
  ],
  propertyOrdering: [
    "kind", "supplier", "product", "total", "dueDate", "periodStart", "periodEnd", "consumptionKwh",
    "annualConsumptionKwh", "priceCentsPerKwh", "monthlyFee", "contractType", "contractEndDate",
    "priceAfterEndCentsPerKwh", "monthlyFeeAfterEnd", "monthlyCost", "switchable", "summary",
  ],
};

export const READING_PROMPT = `You read Finnish Finvoice 3.0 e-invoices for a consumer money coach inside a bank app.
Extract the fields of the schema from the XML below. Rules:
- Amounts use a decimal comma in the XML; return normal numbers. Dates as YYYY-MM-DD.
- kind: electricity_energy for electricity sales (sähkönmyynti, energia), electricity_transmission for the grid company (sähkönsiirto), telecom for mobile or broadband, otherwise other.
- priceCentsPerKwh: the energy unit price in euro cents per kWh including VAT (0,160552 EUR/kWh = 16.0552). Null if not electricity energy.
- monthlyFee: the monthly base fee (perusmaksu) in EUR.
- contractType fixed_term if the contract has an end date (määräaikainen), open_ended if valid until further notice (toistaiseksi voimassa), spot if exchange-price.
- priceAfterEndCentsPerKwh and monthlyFeeAfterEnd: what the contract automatically changes to after it ends, if the invoice says so.
- monthlyCost: what this service costs per month today; for a monthly invoice use the invoice total.
- switchable: false for electricity transmission (the local grid is a regulated monopoly), true for electricity energy and telecom.
- summary: one short, friendly English sentence telling the customer what this bill is and anything they should act on (for example a contract ending soon).
Use only what is in the invoice. Use null for anything that is not there.`;
