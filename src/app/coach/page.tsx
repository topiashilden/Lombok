import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { CoachClient } from "./coach-client";

export const metadata = { title: "Ask Solvo" };

export default async function CoachPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  return (
    <Screen>
      <CoachClient />
    </Screen>
  );
}
