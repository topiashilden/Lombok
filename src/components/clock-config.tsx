"use client";

import { configureDemoClock } from "@/lib/demo-clock";

/**
 * Tells the browser's copy of the demo clock whether the shift is on. It has to run before the screens below it format a date,
 * so it renders first and does its work during render (it is idempotent). The server does the same in the layout.
 */
export function ClockConfig({ end }: { end: string | null }) {
  configureDemoClock(end);
  return null;
}
