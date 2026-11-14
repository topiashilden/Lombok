"use client";

import { useSyncExternalStore } from "react";

// Contract switches the user has approved in this browser. The demo has no backend, so they live in
// localStorage: approve a switch in Bills and the safe-to-spend on Home goes up too. "Reset demo" clears them.

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

const KEY = "solvo.switches.v1";
const EMPTY: Switches = {};
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: Switches = EMPTY;

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function snapshot(): Switches {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? (JSON.parse(raw) as Switches) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(next: Switches) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode etc.: the switch still shows on this page, it just won't persist.
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

export function useSwitches(): Switches {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function approveSwitch(rec: SwitchRecord) {
  write({ ...snapshot(), [rec.bill]: rec });
}

export function resetSwitches() {
  write({});
}

export const WEEKS_PER_YEAR = 52;

// How much more the user can spend each week thanks to approved switches.
export function weeklyBoost(s: Switches) {
  return Object.values(s).reduce((sum, r) => sum + Math.max(0, r?.yearlySaving ?? 0), 0) / WEEKS_PER_YEAR;
}
