import { Suspense } from "react";
import { Screen } from "@/components/solvo/screen";
import { learnContext } from "@/lib/learn-context";
import { getSource, pageMode } from "@/lib/source";
import { CoachClient } from "./coach-client";

export const metadata = { title: "Ask Solvo" };

export default function CoachPage() {
  return (
    <Screen>
      <Suspense fallback={<main className="flex min-h-dvh flex-1 flex-col" />}>
        <Coach />
      </Suspense>
    </Screen>
  );
}

async function Coach() {
  const mode = await pageMode();
  const { customer } = getSource(mode);
  // Only the few numbers the learning packs show reach the browser, never transactions.
  return <CoachClient learn={learnContext(customer, mode)} />;
}
