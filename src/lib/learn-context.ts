// The person's own numbers for the learning packs. Runs on the server; only these few numbers reach the browser.
import "server-only";
import { SAVED_READINGS } from "@/data/einvoices/saved-readings";
import { portfolio } from "@/data/portfolio";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";
import type { DemoCustomer } from "@/lib/demo";
import type { DemoMode } from "@/lib/demo-mode";
import { fundById } from "@/lib/funds";
import type { LearnContext } from "@/lib/learn";
import { SAVED_ELECTRICITY_DB, offerYearly, shortlistFor } from "@/lib/market";

// A new customer has no electricity e-invoice read yet, so the pack starts from a small flat.
const TYPICAL_FLAT_KWH = 2000;

export function learnContext(c: DemoCustomer, mode: DemoMode): LearnContext {
  const r = mode === "aino" ? SAVED_READINGS.electricity : null;
  const kwh = r?.annualConsumptionKwh ?? TYPICAL_FLAT_KWH;
  const db = SAVED_ELECTRICITY_DB;
  const { offers } = shortlistFor(db, kwh);
  const cheapest = (pricing: "fixed" | "spot") =>
    offers
      .filter((o) => o.pricing === pricing)
      .sort((a, b) => offerYearly(a, kwh, db.spotExpectedAvgCents) - offerYearly(b, kwh, db.spotExpectedAvgCents))[0];
  const fixed = cheapest("fixed");
  const spot = cheapest("spot");

  const pf = mode === "aino" ? portfolio() : null;
  const last = c.transactions[c.transactions.length - 1];

  return {
    mode,
    electricity: {
      kwh,
      hasInvoice: !!r,
      current:
        r && r.priceCentsPerKwh != null && r.priceAfterEndCentsPerKwh != null && r.contractEndDate
          ? {
              supplier: r.supplier,
              cents: r.priceCentsPerKwh,
              fee: r.monthlyFee ?? 0,
              afterCents: r.priceAfterEndCentsPerKwh,
              afterFee: r.monthlyFeeAfterEnd ?? r.monthlyFee ?? 0,
              endDate: r.contractEndDate,
            }
          : null,
      fixed: { cents: fixed.centsPerKwh, fee: fixed.monthlyFee, termMonths: fixed.termMonths },
      spot: { margin: spot.centsPerKwh, fee: spot.monthlyFee },
      spotAvg: db.spotExpectedAvgCents,
    },
    funds: {
      hasFunds: !!pf,
      value: Math.round(pf?.value ?? 0),
      monthly: pf ? 100 : 50,
      holdings: (pf?.holdings ?? []).map((h) => {
        const f = fundById(h.fundId);
        return { name: f.name.replace("S-Pankki ", "").replace(" Osake A", "").replace(/ A$/, ""), feePct: f.ongoingFeePct };
      }),
    },
    buffer: {
      rentAndBills: c.summary.basketYear[1] / 12,
      groceries: (c.summary.categoryYear.Groceries ?? 0) / 12,
      balance: Math.max(0, last?.balance ?? 0),
      savingsGoal: DEFAULT_SAVINGS_GOAL_PER_MONTH,
    },
  };
}
