import { NextResponse } from "next/server";
import { getSource } from "@/lib/source";

// What actually happened on one day, for the calendar's day view. Only the asked-for day leaves the server, so the
// phone never holds the whole transaction history.
export type DayRow = { title: string; subtitle: string | null; amount: number };
export type DayResult = { date: string; spent: number; received: number; rows: DayRow[] };

// Synthetic merchant ids look like "M123" and say nothing to a person; real names (real bank data) are worth showing.
const looksLikeId = (m: string) => /\d/.test(m) && !/\s/.test(m);

export function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Use ?date=YYYY-MM-DD" }, { status: 400 });

  const { customer: c } = getSource();
  const rows: DayRow[] = c.transactions
    .filter((t) => t.date === date && t.category !== "Transfer")
    .map((t) => {
      const named = t.merchant && t.merchant !== "Person" && !looksLikeId(t.merchant);
      return {
        title: named ? (t.merchant as string) : t.merchant === "Person" ? "Person to person" : t.category,
        subtitle: named || t.merchant === "Person" ? t.category : null,
        amount: Math.round(t.amount * 100) / 100,
      };
    })
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 40);

  const spent = rows.filter((r) => r.amount < 0).reduce((s, r) => s - r.amount, 0);
  const received = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const result: DayResult = { date, spent: Math.round(spent), received: Math.round(received), rows };
  return NextResponse.json(result);
}
