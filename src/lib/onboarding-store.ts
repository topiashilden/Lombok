"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SAVINGS_GOAL_PER_MONTH } from "@/lib/coach";
import { WEEKS_PER_MONTH } from "@/lib/plan";
import type { Item } from "@/lib/schedule";

// The plan the person approved in onboarding. Like the switches, it lives in localStorage because the demo
// has no backend. "Reset demo" clears it.

export type OnboardingState = {
  completedAt?: string;
  skipped?: boolean;
  status?: string;
  spendWeekly?: number;
  spendMonthly?: number;
  savingsMonthly?: number;
  bufferMonthly?: number;
  investMonthly?: number;
  investCeiling?: number;
  goals?: { label: string; monthly: number }[];
  paydayDay?: number; // day of month the person confirmed
  billsSafeMonthly?: number; // kept aside for fixed bills at payday
  monthlyAdjust?: number; // EUR a month the person's income and bill corrections add to the home page's base numbers
  irregularMonthly?: number; // kept aside for irregular costs
  items?: Item[]; // income and bills as the person confirmed them; the calendar uses these
  savedFunds?: string[]; // fund ids the person marked as interesting
};

const KEY = "solvo.onboarding.v1";
const EMPTY: OnboardingState = {};
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: OnboardingState = EMPTY;

function snapshot(): OnboardingState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {}
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? (JSON.parse(raw) as OnboardingState) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(next: OnboardingState | null) {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode etc.: nothing persists, but the page keeps working.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reads localStorage directly. Use it in effects: the hook returns the empty server snapshot while hydrating. */
export const readOnboarding = snapshot;
export const useOnboarding = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);

export function saveOnboarding(s: Omit<OnboardingState, "completedAt" | "skipped">) {
  write({ ...s, completedAt: new Date().toISOString() });
}
export const skipOnboarding = () => write({ skipped: true });
export const resetOnboarding = () => write(null);

/**
 * How much the weekly budget moves once the person's own plan replaces the default €200 a month savings goal that
 * the home page's numbers are built on. Positive when the plan sets aside less than the default.
 */
export function onboardingWeeklyDelta(s: OnboardingState): number {
  if (!s.completedAt) return 0;
  const planned = (s.savingsMonthly ?? 0) + (s.investMonthly ?? 0);
  return (DEFAULT_SAVINGS_GOAL_PER_MONTH - planned + (s.monthlyAdjust ?? 0)) / WEEKS_PER_MONTH;
}
