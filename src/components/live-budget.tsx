"use client";

import Link from "next/link";
import { resetDemo, useSavingsPlan, useSwitches, weeklyBoost } from "@/lib/switches";

// Small client islands for the server-rendered home page: they add the effect of approved switches
// to the safe-to-spend numbers without moving the page's layout into the client.

const eur = new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** A weekly amount (remaining or budget) plus what approved switches free up each week. */
export function LiveWeeklyEuro({ base, signed = false }: { base: number; signed?: boolean }) {
  const value = base + weeklyBoost(useSwitches(), useSavingsPlan());
  return <>{signed && value < 0 ? `−${eur.format(-value)}` : eur.format(value)}</>;
}

/** One line under the safe-to-spend number once a switch is approved. Renders nothing otherwise. */
export function SwitchBoostNote({ className }: { className?: string }) {
  const switches = useSwitches();
  const plan = useSavingsPlan();
  if (!Object.keys(switches).length) return null;
  const boost = weeklyBoost(switches, plan);
  const spendBoost = boost >= 0.5; // below 50 cents rounds to €0, so don't mention it
  const names = Object.values(switches)
    .map((s) => s?.toSupplier)
    .filter(Boolean)
    .join(", ");
  return (
    <p className={className}>
      Cheaper bills ({names}): {spendBoost ? `+${eur.format(boost)}/week to spend` : ""}
      {spendBoost && plan ? " and " : ""}
      {plan ? `${eur.format(plan.monthly)}/month into your fund` : ""}.{" "}
      {!plan && (
        <Link href="/save" className="underline underline-offset-4">
          Save it instead
        </Link>
      )}
    </p>
  );
}

export function ResetDemoButton({ className }: { className?: string }) {
  const switches = useSwitches();
  const plan = useSavingsPlan();
  if (!Object.keys(switches).length && !plan) return null;
  return (
    <button type="button" className={className} onClick={resetDemo}>
      Reset demo
    </button>
  );
}
