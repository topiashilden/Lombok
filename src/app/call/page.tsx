import { Screen } from "@/components/solvo/screen";
import { CallClient } from "./call-client";

export const metadata = { title: "Solvo is calling" };

export default function CallPage() {
  return (
    <Screen>
      <CallClient />
    </Screen>
  );
}
