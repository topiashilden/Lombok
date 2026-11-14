import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile · Solvo" };

export default async function ProfilePage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const c = MAIN_CUSTOMER;
  return (
    <Screen>
      <ProfileClient
        name="Aino Esimerkki"
        id={c.id}
        age={c.age}
        postalCode={c.postalCode}
        savingsGoal={DEFAULT_SAVINGS_GOAL_PER_MONTH}
      />
    </Screen>
  );
}
