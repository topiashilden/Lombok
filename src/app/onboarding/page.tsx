import { connection } from "next/server";
import { inferProfile } from "@/lib/profile";
import { scheduleFor } from "@/lib/schedule-server";
import { getEffective } from "@/lib/source-banks";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Your plan · Solvo" };

// Runs on the server: the transactions never reach the phone, only the profile, the usual dates and a few
// monthly numbers.
export default async function OnboardingPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const { customer: c, local, banks, view } = await getEffective();
  const profile = inferProfile(c);
  const schedule = scheduleFor(c);
  const base = {
    // Same inputs as the home page's safe-to-spend, so the plan and the headline number agree.
    incomeMonthly: Math.round(c.summary.salaryYear / 12),
    fixedRegularMonthly: Math.round(c.summary.basketYear[1] / 12),
    irregularMonthly: Math.round(c.summary.basketYear[2] / 12),
    everydayMonthly: Math.round(c.summary.basketYear[3] / 12),
    cashBalance: profile.cashBalance === null ? null : Math.round(profile.cashBalance),
    investsMonthlyToday: Math.round(profile.investsMonthly),
  };
  return <OnboardingClient profile={profile} base={base} schedule={schedule} local={local} banks={banks} view={view} />;
}
