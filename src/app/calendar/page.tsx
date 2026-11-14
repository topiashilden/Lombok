import { Suspense } from "react";
import { PAGE } from "@/components/solvo/ui";
import { inferSchedule } from "@/lib/schedule";
import { getSource, pageMode } from "@/lib/source";
import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar · Solvo" };

// The server works out the usual dates from the transactions; only the dates and amounts reach the phone.
export default function CalendarPage() {
  return (
    <Suspense fallback={<main className={PAGE} />}>
      <Calendar />
    </Suspense>
  );
}

async function Calendar() {
  const { customer: c } = getSource(await pageMode());
  return <CalendarClient items={inferSchedule(c).items} asOf={c.asOf} />;
}
