import { safeToSpend } from "@/lib/coach";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { SaveClient } from "./save-client";

export const metadata = { title: "Save it · Solvo" };

export default function SavePage() {
  return <SaveClient remaining={safeToSpend(MAIN_CUSTOMER).remaining} />;
}
