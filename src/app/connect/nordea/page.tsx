import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { liveEnabled, liveStatus } from "@/lib/live-nordea";
import { ConnectClient } from "./connect-client";

export const metadata = { title: "Connect Nordea · Solvo" };

// LOCAL ONLY (SOLVO_LIVE=1). Where /callback lands after Nordea ID: downloads the transactions with a visible progress state.
export default async function ConnectNordeaPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  if (!liveEnabled()) notFound();
  const { error } = await searchParams;
  return (
    <Screen>
      <ConnectClient error={error ?? null} hasSession={liveStatus().accounts > 0} />
    </Screen>
  );
}
