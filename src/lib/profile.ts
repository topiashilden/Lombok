// Guesses who the customer is from their money, so onboarding can start with "here is what we think"
// and let the person correct it. It only reads transactions; the person always has the last word.
//
// Signals used (all from the last 12 complete months):
//  - Salary: how many months it arrived, how big and how steady it is.
//  - A study grant (the bank code "Opintotuki" on real Nordea data). The synthetic S-Pankki data has no such
//    signal: every synthetic customer has regular salary, so they all come out as "worker".
//  - Money moved to investing.
//  - The balance on the account.
// Each status carries the evidence sentences that justify it, shown to the person.
import type { DemoCustomer } from "@/lib/demo";

export type Status = "worker" | "part-time" | "student" | "between-jobs" | "retired";

export const STATUS_LABEL: Record<Status, string> = {
  worker: "Working full time",
  "part-time": "Working part time or irregular hours",
  student: "Studying",
  "between-jobs": "Between jobs",
  retired: "Retired",
};

export type Profile = {
  status: Status;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  incomeMonthly: number; // salary and study grant, averaged over the last 12 months
  salaryMonthsOf12: number;
  benefitPayments: number;
  investsMonthly: number; // money moved to investing per month, 0 if none
  cashBalance: number | null; // total of the latest known balance per account
};

// Below this a monthly salary looks like part-time or low-hours work (net, EUR).
const PART_TIME_BELOW = 1400;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (n: number, step = 10) => Math.round(n / step) * step;
const eur = (n: number) => `€${Math.round(n).toLocaleString("fi-FI")}`;

export function inferProfile(c: DemoCustomer): Profile {
  const months = c.summary.last12Months;
  const inWindow = new Set(months);

  const salaryByMonth: Record<string, number> = {};
  const grantByMonth: Record<string, number> = {};
  let invested = 0;
  for (const t of c.transactions) {
    const m = t.date.slice(0, 7);
    if (!inWindow.has(m)) continue;
    if (t.category === "Salary" && t.amount > 0) {
      const isGrant = /opintotuki/i.test(t.type) || /kansaneläke|\bkela\b/i.test(t.merchant ?? "");
      (isGrant ? grantByMonth : salaryByMonth)[m] = ((isGrant ? grantByMonth : salaryByMonth)[m] ?? 0) + t.amount;
    }
    if (t.category === "Invest Deposit") invested -= t.amount; // deposits are negative on the account
  }

  const salaryMonths = months.filter((m) => salaryByMonth[m] > 0);
  const grantMonths = months.filter((m) => grantByMonth[m] > 0);
  const salaryMedian = median(salaryMonths.map((m) => salaryByMonth[m]));
  const grantMedian = median(grantMonths.map((m) => grantByMonth[m]));
  const last3 = months.slice(-3);
  const gapRecent = last3.filter((m) => !(salaryByMonth[m] > 0)).length;

  // Latest balance per account, as a rough "money you have today".
  const lastBalance: Record<string, number> = {};
  for (const t of c.transactions) if (t.balance !== 0 || t.type !== "pending") lastBalance[t.account] = t.balance;
  const balances = Object.values(lastBalance);
  const cashBalance = balances.length ? Math.max(0, balances.reduce((s, b) => s + b, 0)) : null;

  const incomeMonthly = Object.values(salaryByMonth).reduce((s, v) => s + v, 0) / 12 + Object.values(grantByMonth).reduce((s, v) => s + v, 0) / 12;
  const base = {
    incomeMonthly,
    salaryMonthsOf12: salaryMonths.length,
    benefitPayments: grantMonths.length,
    investsMonthly: Math.max(0, invested / 12),
    cashBalance,
  };

  const evidence: string[] = [];
  const salaryLine = salaryMonths.length
    ? `Salary arrived in ${salaryMonths.length} of the last 12 months, about ${eur(round(salaryMedian))} a month.`
    : "No salary in the last 12 months.";

  // 1. A study grant is the clearest signal of a student, with or without work on the side.
  if (grantMonths.length >= 3) {
    evidence.push(`A study grant (Kela) was paid in ${grantMonths.length} of the last 12 months, about ${eur(round(grantMedian))} a month.`);
    if (salaryMonths.length) evidence.push(`${salaryLine} That looks like work next to your studies.`);
    return { ...base, status: "student", confidence: "high", evidence };
  }

  // 2. Salary stopped recently.
  if (salaryMonths.length && gapRecent >= 2) {
    evidence.push(salaryLine, `No salary in ${gapRecent} of the last 3 months.`);
    return { ...base, status: "between-jobs", confidence: gapRecent === 3 ? "high" : "medium", evidence };
  }

  // 3. Never any salary: retired or unknown. Age is not always known (real bank data has none), so be modest.
  if (!salaryMonths.length) {
    evidence.push(salaryLine);
    if (c.age >= 63) return { ...base, status: "retired", confidence: "medium", evidence: [...evidence, `You are ${c.age}.`] };
    return { ...base, status: "between-jobs", confidence: "low", evidence };
  }

  // 4. Low or patchy salary: part time.
  const patchy = salaryMonths.length < 10;
  if (salaryMedian < PART_TIME_BELOW || patchy) {
    evidence.push(salaryLine);
    evidence.push(
      patchy && salaryMedian >= PART_TIME_BELOW
        ? "It doesn't arrive every month, which looks like irregular hours."
        : "That is below a typical full-time pay, which looks like part-time or low-hours work.",
    );
    return { ...base, status: "part-time", confidence: "medium", evidence };
  }

  // 5. Steady, normal-sized salary.
  evidence.push(salaryLine);
  if (c.age >= 63) evidence.push(`You are ${c.age} and still receive a salary.`);
  return { ...base, status: "worker", confidence: salaryMonths.length >= 11 ? "high" : "medium", evidence };
}
