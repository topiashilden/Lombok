import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { currentLinked, sandboxEnabled } from "@/lib/linked-bank";
import { liveStatus } from "@/lib/live-nordea";
import { getEffective } from "@/lib/source-banks";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile · Solvo" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  const c = MAIN_CUSTOMER;
  const { banks, view, local } = await getEffective();
  const { bank } = await searchParams;
  const linked = await currentLinked();
  return (
    <Screen>
      <ProfileClient
        name="Aino Esimerkki"
        id={c.id}
        age={c.age}
        postalCode={c.postalCode}
        savingsGoal={DEFAULT_SAVINGS_GOAL_PER_MONTH}
        banks={banks}
        view={view}
        showBanks={!local}
        live={liveStatus()}
        linkedBank={{ enabled: sandboxEnabled(), linked: linked && { bank: linked.bank, validUntil: linked.validUntil }, notice: bank ?? null }}
      />
    </Screen>
  );
}
