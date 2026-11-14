// When money usually moves: payday, rent, utility bills. Worked out from the last 12 complete months of
// transactions, shown as an assumption the person can correct, and used for the calendar and the payday plan.
// Pure, no imports except a type, so the server computes it and the browser only formats it.
import type { DemoCustomer } from "@/lib/demo";

export type Item = {
  id: string;
  label: string;
  kind: "in" | "out";
  day: number; // typical day of month, 1 to 31
  amount: number; // EUR, always positive
  source: "detected" | "you";
  detail?: string;
};

export type Schedule = {
  payday: { day: number; amount: number } | null;
  items: Item[]; // income and recurring bills, payday first
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const dayOf = (iso: string) => Number(iso.slice(8, 10));
const monthOf = (iso: string) => iso.slice(0, 7);

export function ordinal(n: number) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

const isGrant = (type: string, merchant: string | null) => /opintotuki/i.test(type) || /kansaneläke|\bkela\b/i.test(merchant ?? "");

export function inferSchedule(c: DemoCustomer): Schedule {
  const window = new Set(c.summary.last12Months);
  const rows = c.transactions.filter((t) => window.has(monthOf(t.date)));
  const items: Item[] = [];

  // Income: salary and a study grant, each with its own typical day.
  const salary = rows.filter((t) => t.category === "Salary" && t.amount > 0 && !isGrant(t.type, t.merchant));
  const grant = rows.filter((t) => t.category === "Salary" && t.amount > 0 && isGrant(t.type, t.merchant));
  const monthlySums = (rs: typeof rows) => {
    const by: Record<string, number> = {};
    for (const t of rs) by[monthOf(t.date)] = (by[monthOf(t.date)] ?? 0) + t.amount;
    return Object.values(by);
  };
  let payday: Schedule["payday"] = null;
  if (salary.length >= 3) {
    payday = { day: Math.round(median(salary.map((t) => dayOf(t.date)))), amount: Math.round(median(monthlySums(salary))) };
    items.push({ id: "salary", label: "Salary", kind: "in", day: payday.day, amount: payday.amount, source: "detected" });
  }
  if (grant.length >= 3) {
    items.push({
      id: "grant",
      label: "Study grant (Kela)",
      kind: "in",
      day: Math.round(median(grant.map((t) => dayOf(t.date)))),
      amount: Math.round(median(monthlySums(grant))),
      source: "detected",
    });
  }

  // Rent and housing: one monthly total on its usual day.
  const housing = rows.filter((t) => t.category === "Housing" && t.amount < 0);
  if (housing.length >= 3) {
    items.push({
      id: "rent",
      label: "Rent",
      kind: "out",
      day: Math.round(median(housing.map((t) => dayOf(t.date)))),
      amount: Math.round(median(monthlySums(housing).map((v) => -v))),
      source: "detected",
    });
  }

  // Utility bills. With merchant names (real bank data) each company is its own item. Without them (the synthetic
  // bank data) bills are grouped by their order in the month: first bill, second bill, and so on.
  const utilities = rows.filter((t) => t.category === "Utilities" && t.amount < 0);
  const named = utilities.filter((t) => t.merchant);
  if (named.length >= utilities.length / 2 && named.length) {
    const byMerchant: Record<string, typeof rows> = {};
    for (const t of named) (byMerchant[t.merchant as string] ??= []).push(t);
    Object.entries(byMerchant)
      .filter(([, rs]) => new Set(rs.map((t) => monthOf(t.date))).size >= 4)
      .forEach(([m, rs], i) => {
        items.push({ id: `util-${i}`, label: m, kind: "out", day: Math.round(median(rs.map((t) => dayOf(t.date)))), amount: Math.round(median(rs.map((t) => -t.amount))), source: "detected" });
      });
  } else if (utilities.length) {
    const byMonth: Record<string, number[]> = {};
    const amountsByMonth: Record<string, number[]> = {};
    for (const t of [...utilities].sort((a, b) => a.date.localeCompare(b.date))) {
      (byMonth[monthOf(t.date)] ??= []).push(dayOf(t.date));
      (amountsByMonth[monthOf(t.date)] ??= []).push(-t.amount);
    }
    const months = Object.keys(byMonth);
    for (let k = 0; k < 3; k++) {
      const days = months.filter((m) => byMonth[m][k] !== undefined).map((m) => byMonth[m][k]);
      if (days.length < months.length / 2) continue;
      const amounts = months.filter((m) => amountsByMonth[m][k] !== undefined).map((m) => amountsByMonth[m][k]);
      items.push({
        id: `util-${k}`,
        label: "Utility bill",
        kind: "out",
        day: Math.round(median(days)),
        amount: Math.round(median(amounts)),
        source: "detected",
        detail: "Bank data doesn't name the company. Solvo reads the e-invoice to find out.",
      });
    }
  }

  items.sort((a, b) => (a.kind === b.kind ? a.day - b.day : a.kind === "in" ? -1 : 1));
  return { payday, items };
}

// ---- Calendar helpers, shared by the server and the browser ----

export type CustomEvent = {
  id: string;
  kind: "in" | "out";
  label: string;
  amount: number;
  date: string; // YYYY-MM-DD, the first time it happens
  monthly: boolean; // repeats on the same day every month after that
};

export type DayEvent = { id: string; date: string; label: string; kind: "in" | "out"; amount: number; source: "detected" | "you"; detail?: string };

export const daysIn = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
export const isoDay = (year: number, month0: number, day: number) =>
  `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Every expected or added event in one month, sorted by date. A day past the end of the month falls on its last day. */
export function eventsForMonth(items: Item[], custom: CustomEvent[], year: number, month0: number): DayEvent[] {
  const out: DayEvent[] = [];
  const last = daysIn(year, month0);
  for (const it of items) {
    out.push({ id: it.id, date: isoDay(year, month0, Math.min(it.day, last)), label: it.label, kind: it.kind, amount: it.amount, source: it.source, detail: it.detail });
  }
  const here = isoDay(year, month0, 1).slice(0, 7);
  for (const e of custom) {
    const start = e.date.slice(0, 7);
    const day = Number(e.date.slice(8, 10));
    const applies = e.monthly ? here >= start : here === start;
    if (applies) out.push({ id: e.id, date: isoDay(year, month0, Math.min(day, last)), label: e.label, kind: e.kind, amount: e.amount, source: "you" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1));
}
