import { Suspense } from "react";
import { PAGE } from "@/components/solvo/ui";
import { inferProfile } from "@/lib/profile";
import { inferSchedule } from "@/lib/schedule";
import { getSource, pageMode } from "@/lib/source";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Your plan · Solvo" };

// Runs on the server: the transactions never reach the phone, only the profile, the usual dates and a few
// monthly numbers.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className={PAGE} />}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const { customer: c, local, mode } = getSource(await pageMode());
  const profile = inferProfile(c);
  const schedule = inferSchedule(c);
  const base = {
    // Same inputs as the home page's safe-to-spend, so the plan and the headline number agree.
    incomeMonthly: Math.round(c.summary.salaryYear / 12),
    fixedRegularMonthly: Math.round(c.summary.basketYear[1] / 12),
    irregularMonthly: Math.round(c.summary.basketYear[2] / 12),
    everydayMonthly: Math.round(c.summary.basketYear[3] / 12),
    cashBalance: profile.cashBalance === null ? null : Math.round(profile.cashBalance),
    investsMonthlyToday: Math.round(profile.investsMonthly),
  };
  return <OnboardingClient profile={profile} base={base} schedule={schedule} local={local} askConnect={mode === "new"} />;
}
