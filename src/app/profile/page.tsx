import { Suspense } from "react";
import { Screen } from "@/components/solvo/screen";
import { PAGE } from "@/components/solvo/ui";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";
import { getSource, pageMode } from "@/lib/source";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile · Solvo" };

export default function ProfilePage() {
  return (
    <Screen>
      <Suspense fallback={<main className={PAGE} />}>
        <Profile />
      </Suspense>
    </Screen>
  );
}

async function Profile() {
  const { customer: c } = getSource(await pageMode());
  return (
    <ProfileClient
      name="Aino Esimerkki"
      id={c.id}
      age={c.age}
      postalCode={c.postalCode}
      savingsGoal={DEFAULT_SAVINGS_GOAL_PER_MONTH}
    />
  );
}
