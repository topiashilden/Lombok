import { connection } from "next/server";
import { Screen } from "@/components/solvo/screen";
import { CallClient } from "./call-client";

export const metadata = { title: "Solvo is calling" };

export default async function CallPage() {
  // Render per request: these pages show dates, and the demo clock reads the real date. See src/lib/demo-clock.ts.
  await connection();
  return (
    <Screen>
      <CallClient />
    </Screen>
  );
}
