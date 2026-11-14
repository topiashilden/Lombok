"use client";

import { useSyncExternalStore } from "react";
import type { CustomEvent } from "@/lib/schedule";

// Dates the person added themselves: money they expect to arrive or leave. Stored in localStorage like the rest
// of the demo's state; "Reset demo" clears it.

const KEY = "solvo.calendar.v1";
const EMPTY: CustomEvent[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: CustomEvent[] = EMPTY;

function snapshot(): CustomEvent[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {}
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? (JSON.parse(raw) as CustomEvent[]) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(next: CustomEvent[] | null) {
  try {
    if (next && next.length) window.localStorage.setItem(KEY, JSON.stringify(next));
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

export const useCustomEvents = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);
export const addCustomEvent = (e: CustomEvent) => write([...snapshot(), e]);
export const removeCustomEvent = (id: string) => write(snapshot().filter((e) => e.id !== id));
export const resetCalendar = () => write(null);
