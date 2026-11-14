// The customer as the person has chosen to see them: S-Pankki alone, or merged with the banks they connected (cookies, set from
// Profile). Real bank data (local Nordea mode) is never merged with the demo banks.
import "server-only";
import { cookies } from "next/headers";
import { BANKS_COOKIE, VIEW_COOKIE, parseBanks, type BankId, type View } from "@/lib/banks";
import { combinedCustomer } from "@/lib/combine";
import type { DemoCustomer } from "@/lib/demo";
import { MAIN_CUSTOMER } from "@/lib/demo";
import { getSource } from "@/lib/source";

export async function getEffective(): Promise<{ base: DemoCustomer; customer: DemoCustomer; local: boolean; banks: BankId[]; view: View }> {
  const { customer: base, local } = getSource();
  const jar = await cookies();
  const banks = local ? [] : parseBanks(jar.get(BANKS_COOKIE)?.value);
  const view: View = jar.get(VIEW_COOKIE)?.value === "spankki" ? "spankki" : "all";
  return { base, customer: banks.length && view === "all" ? combinedCustomer(base, banks) : base, local, banks, view };
}

/** Like getEffective, but always the synthetic demo customer, never real bank data. For anything that talks to an outside model. */
export async function getDemoEffective(): Promise<{ base: DemoCustomer; customer: DemoCustomer; banks: BankId[]; view: View }> {
  const jar = await cookies();
  const banks = parseBanks(jar.get(BANKS_COOKIE)?.value);
  const view: View = jar.get(VIEW_COOKIE)?.value === "spankki" ? "spankki" : "all";
  return { base: MAIN_CUSTOMER, customer: banks.length && view === "all" ? combinedCustomer(MAIN_CUSTOMER, banks) : MAIN_CUSTOMER, banks, view };
}
