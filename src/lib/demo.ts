// Server only: the demo JSON holds every transaction (~190 KB per customer). Importing this file
// from a client component fails the build, so the data never reaches the phone. Pass props instead.
import "server-only";
import cust01787 from "@/data/demo/CUST01787.json";
import cust01590 from "@/data/demo/CUST01590.json";

// Built by scripts/build-demo-data.mjs from the S-Pankki dataset.
export type Basket = 1 | 2 | 3;

export type Tx = {
  date: string;
  ts: string;
  account: string;
  category: string;
  amount: number; // signed EUR, debits negative
  balance: number;
  type: string;
  merchant: string | null;
  mcc: string | null;
};

export type DemoCustomer = {
  id: string;
  postalCode: string;
  age: number;
  asOf: string; // the demo treats this date as "today"
  accounts: string[];
  basketOf: Record<string, Basket>;
  summary: {
    last12Months: string[];
    basketYear: Record<Basket, number>;
    categoryYear: Record<string, number>;
    salaryYear: number;
  };
  monthly: Record<string, Record<string, number>>;
  transactions: Tx[];
};

export const DEMO_CUSTOMERS = {
  CUST01787: cust01787 as unknown as DemoCustomer, // main persona: 34, Espoo
  CUST01590: cust01590 as unknown as DemoCustomer,
};

export const MAIN_CUSTOMER = DEMO_CUSTOMERS.CUST01787;

export const BASKET_LABELS: Record<Basket, { title: string; blurb: string }> = {
  1: { title: "Fixed and regular", blurb: "Rent, electricity, phone and internet" },
  2: { title: "Fixed and irregular", blurb: "Health, travel, home and tech" },
  3: { title: "Everyday leakage", blurb: "Food, taxis, entertainment, lifestyle" },
};
