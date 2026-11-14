import { scheduleFor } from "@/lib/schedule-server";
import { getSource } from "@/lib/source";
import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar · Solvo" };

// The server works out the usual dates from the transactions; only the dates and amounts reach the phone.
export default function CalendarPage() {
  const { customer: c } = getSource();
  return <CalendarClient items={scheduleFor(c).items} asOf={c.asOf} />;
}
