import { connection } from "next/server";
import { offsetDays, todayIso } from "@/lib/demo-clock";
import { scheduleFor } from "@/lib/schedule-server";
import { getSource } from "@/lib/source";
import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar · Solvo" };

// The server works out the usual dates from the transactions; only the dates and amounts reach the phone.
export default async function CalendarPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const { customer: c } = getSource();
  return <CalendarClient items={scheduleFor(c).items} today={todayIso()} offset={offsetDays()} />;
}
