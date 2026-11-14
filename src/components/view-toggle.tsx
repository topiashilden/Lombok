"use client";

import { useRouter } from "next/navigation";
import { writeBanksCookie, type BankId, type View } from "@/lib/banks";

/** Switch between S-Pankki alone and every connected bank. The whole app follows (Home, plan, calendar, coach). */
export function ViewToggle({ banks, view }: { banks: BankId[]; view: View }) {
  const router = useRouter();
  const pick = (v: View) => {
    writeBanksCookie(banks, v);
    router.refresh();
  };
  const btn = (v: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => pick(v)}
      className={`h-11 flex-1 rounded-xl px-3 text-[14px] font-semibold ${view === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-2" role="group" aria-label="Which banks to include">
      {btn("all", "All banks")}
      {btn("spankki", "S-Pankki only")}
    </div>
  );
}
