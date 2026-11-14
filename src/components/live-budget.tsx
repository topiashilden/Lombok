"use client";

import { resetSwitches, useSwitches, weeklyBoost } from "@/lib/switches";

// Small client islands for the server-rendered home page: they add the effect of approved switches
// to the safe-to-spend numbers without moving the page's layout into the client.

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** A weekly amount (remaining or budget) plus what approved switches free up each week. */
export function LiveWeeklyEuro({ base, signed = false }: { base: number; signed?: boolean }) {
  const value = base + weeklyBoost(useSwitches());
  return <>{signed && value < 0 ? `−${eur.format(-value)}` : eur.format(value)}</>;
}

/** One line under the safe-to-spend number once a switch is approved. Renders nothing otherwise. */
export function SwitchBoostNote({ className }: { className?: string }) {
  const switches = useSwitches();
  const boost = weeklyBoost(switches);
  if (boost <= 0) return null;
  const names = Object.values(switches)
    .map((s) => s?.toSupplier)
    .filter(Boolean)
    .join(" and ");
  return (
    <p className={className}>
      +{eur.format(boost)}/week from your switch to {names}. Fixed costs aren&apos;t fixed.
    </p>
  );
}

export function ResetDemoButton({ className }: { className?: string }) {
  const switches = useSwitches();
  if (!Object.keys(switches).length) return null;
  return (
    <button type="button" className={className} onClick={resetSwitches}>
      Reset demo
    </button>
  );
}
