// The schedule as the app uses it: payday and bills, with the bills named from e-invoices where there are any.
import "server-only";
import { namedBillsFor } from "@/lib/bill-names";
import type { DemoCustomer } from "@/lib/demo";
import { inferSchedule } from "@/lib/schedule";

export const scheduleFor = (c: DemoCustomer) => inferSchedule(c, namedBillsFor(c.id));
