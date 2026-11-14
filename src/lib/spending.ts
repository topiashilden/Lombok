import type { DemoCustomer, Tx } from "@/lib/demo";

// Exact spending queries over the demo customer's real S-Pankki transactions.
// The coach chat calls these as tools, so every number it says is computed here, not guessed by the model.

// Merchant category codes (MCC) that appear in the dataset, in plain words.
export const MERCHANT_TYPES: Record<string, string> = {
  "4111": "Public transport",
  "4121": "Taxis",
  "4511": "Flights",
  "4722": "Travel agencies",
  "5200": "Home supply stores",
  "5251": "Hardware stores",
  "5411": "Supermarkets",
  "5422": "Butchers",
  "5451": "Dairy shops",
  "5499": "Food shops and kiosks",
  "5541": "Fuel stations",
  "5542": "Fuel (automated pumps)",
  "5651": "Clothing",
  "5691": "Clothing",
  "5712": "Furniture",
  "5732": "Electronics",
  "5734": "Software",
  "5812": "Restaurants",
  "5813": "Bars and nightlife",
  "5814": "Fast food and cafes",
  "5912": "Pharmacies",
  "5941": "Sports shops",
  "5942": "Bookshops",
  "5945": "Toys and hobbies",
  "5999": "Other shops",
  "7011": "Hotels",
  "7512": "Car rental",
  "7523": "Parking",
  "7832": "Cinema",
  "7922": "Tickets and events",
  "7991": "Attractions",
  "7996": "Amusement parks",
  "7999": "Recreation",
  "8011": "Doctors",
  "8021": "Dentists",
  "8099": "Health services",
};

export const MERCHANT_TYPE_NAMES = [...new Set(Object.values(MERCHANT_TYPES))].sort();

export const merchantTypeOf = (t: Tx) => (t.mcc ? (MERCHANT_TYPES[t.mcc] ?? "Other") : null);

export type SpendingQuery = {
  category?: string; // e.g. "Restaurants"
  merchantType?: string; // e.g. "Taxis"
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
  groupBy?: "month" | "category" | "merchantType" | "none";
};

export type SpendingResult = {
  filter: string; // what was asked, in words
  from: string;
  to: string;
  total: number; // EUR spent (positive)
  count: number;
  averagePerPurchase: number;
  averagePerMonth: number;
  groups: { key: string; total: number; count: number }[];
  largest: { date: string; amount: number; category: string; merchantType: string | null }[];
};

const round = (n: number) => Math.round(n * 100) / 100;

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

// Default window: the last 12 full months up to "today" (asOf).
export function defaultFrom(c: DemoCustomer) {
  return `${c.summary.last12Months[0]}-01`;
}

export function spending(c: DemoCustomer, q: SpendingQuery): SpendingResult {
  const from = q.from || defaultFrom(c);
  const to = q.to && q.to < c.asOf ? q.to : c.asOf;
  const norm = (s?: string) => s?.trim().toLowerCase();
  const cat = norm(q.category);
  const mt = norm(q.merchantType);

  const rows = c.transactions.filter(
    (t) =>
      t.amount < 0 &&
      t.date >= from &&
      t.date <= to &&
      (!cat || t.category.toLowerCase() === cat) &&
      (!mt || merchantTypeOf(t)?.toLowerCase() === mt),
  );

  const total = rows.reduce((s, t) => s - t.amount, 0);
  const groupKey = (t: Tx) =>
    q.groupBy === "month"
      ? t.date.slice(0, 7)
      : q.groupBy === "category"
        ? t.category
        : q.groupBy === "merchantType"
          ? (merchantTypeOf(t) ?? "Unknown (no merchant data)")
          : null;

  const groups = new Map<string, { total: number; count: number }>();
  if (q.groupBy && q.groupBy !== "none") {
    for (const t of rows) {
      const k = groupKey(t)!;
      const g = groups.get(k) ?? { total: 0, count: 0 };
      g.total -= t.amount;
      g.count++;
      groups.set(k, g);
    }
  }

  return {
    filter: [q.category, q.merchantType].filter(Boolean).join(" / ") || "All spending",
    from,
    to,
    total: round(total),
    count: rows.length,
    averagePerPurchase: rows.length ? round(total / rows.length) : 0,
    averagePerMonth: round(total / monthsBetween(from, to)),
    groups: [...groups.entries()]
      .map(([key, g]) => ({ key, total: round(g.total), count: g.count }))
      .sort((a, b) => (q.groupBy === "month" ? a.key.localeCompare(b.key) : b.total - a.total)),
    largest: [...rows]
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 3)
      .map((t) => ({ date: t.date, amount: -t.amount, category: t.category, merchantType: merchantTypeOf(t) })),
  };
}
