"use client";

import { useSyncExternalStore } from "react";

// What the user has approved in this browser: contract switches and a monthly fund savings plan.
// The demo has no backend, so both live in localStorage: approve a switch in Bills and the
// safe-to-spend on Home goes up too. "Reset demo" clears everything.

export type BillKey = "electricity" | "telecom";

export type SwitchRecord = {
  bill: BillKey;
  fromSupplier: string;
  toSupplier: string;
  toProduct: string;
  yearlySaving: number; // EUR, vs. doing nothing
  startDate: string | null; // YYYY-MM-DD
  approvedAt: string; // ISO timestamp
};

export type Switches = Partial<Record<BillKey, SwitchRecord>>;

export type SavingsPlan = {
  monthly: number; // EUR moved to the fund each month, in total
  fromGoal?: number; // part of it that is the savings goal, already outside the weekly budget
  fromBills?: number; // part of it that cheaper bills free up (older plans: all of monthly)
  fundId: string;
  fundName: string;
  dayOfMonth: number;
  approvedAt: string;
};

function createStore<T extends object>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cacheRaw: string | null = null;
  let cache = empty;

  const snapshot = (): T => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {}
    if (raw !== cacheRaw) {
      cacheRaw = raw;
      try {
        cache = raw ? (JSON.parse(raw) as T) : empty;
      } catch {
        cache = empty;
      }
    }
    return cache;
  };

  const set = (next: T | null) => {
    try {
      if (next) window.localStorage.setItem(key, JSON.stringify(next));
      else window.localStorage.removeItem(key);
    } catch {
      // Private mode etc.: nothing persists, but the page keeps working.
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === key && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const use = () => useSyncExternalStore(subscribe, snapshot, () => empty);
  return { snapshot, set, use };
}

const NO_SWITCHES: Switches = {};
const NO_PLAN = {} as Partial<SavingsPlan>;
const switchStore = createStore<Switches>("solvo.switches.v1", NO_SWITCHES);
// Unpaid bills the user has dealt with: paid, or asked to be reminded later.
export type BillAction = { action: "paid" | "snoozed"; at: string };
const NO_ACTIONS: Record<string, BillAction> = {};
const billStore = createStore<Record<string, BillAction>>("solvo.bill-actions.v1", NO_ACTIONS);
const planStore = createStore<Partial<SavingsPlan>>("solvo.savings-plan.v1", NO_PLAN);

// E-invoice readings by invoice id, so Gemini reads each invoice once per device, not on every visit to Bills.
const readingStore = createStore<Record<string, unknown>>("solvo.readings.v1", {});
export const readCachedReadings = readingStore.snapshot;
export const useCachedReadings = readingStore.use;
export function cacheReading(id: string, value: unknown) {
  readingStore.set({ ...readingStore.snapshot(), [id]: value });
}
export function clearCachedReadings() {
  readingStore.set(null);
}

export const useSwitches = switchStore.use;

export function useSavingsPlan(): SavingsPlan | null {
  const p = planStore.use();
  return p.monthly ? (p as SavingsPlan) : null;
}

export const useBillActions = billStore.use;

export function setBillAction(billId: string, action: BillAction["action"]) {
  billStore.set({
    ...billStore.snapshot(),
    [billId]: { action, at: new Date().toISOString() },
  });
}

export function approveSwitch(rec: SwitchRecord) {
  switchStore.set({ ...switchStore.snapshot(), [rec.bill]: rec });
}

export function approveSavingsPlan(plan: SavingsPlan) {
  planStore.set(plan);
}

export function cancelSavingsPlan() {
  planStore.set(null);
}

export function resetDemo() {
  switchStore.set(null);
  planStore.set(null);
  billStore.set(null);
}

export const WEEKS_PER_YEAR = 52;

/** Money freed by approved switches, per month. */
export function monthlyFreed(s: Switches) {
  return Object.values(s).reduce((sum, r) => sum + Math.max(0, r?.yearlySaving ?? 0), 0) / 12;
}

/** How much more the user can spend each week: freed money minus what goes to the fund. */
export function weeklyBoost(s: Switches, plan: SavingsPlan | null = null) {
  const toSpend = Math.max(0, monthlyFreed(s) - (plan ? (plan.fromBills ?? plan.monthly) : 0));
  return (toSpend * 12) / WEEKS_PER_YEAR;
}
