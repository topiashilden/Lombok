import { Screen } from "@/components/solvo/screen";
import { CoachClient } from "./coach-client";

export const metadata = { title: "Ask Solvo" };

export default function CoachPage() {
  return (
    <Screen>
      <CoachClient />
    </Screen>
  );
}
