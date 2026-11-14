"use client";

import { useSyncExternalStore } from "react";
import type { PackId } from "@/lib/learn";

// Which learning packs this person has finished, in this browser. Cleared by Reset demo.
export type LearnProgress = { done: Partial<Record<PackId, { at: string; quizRight: boolean }>> };

const KEY = "solvo.learn.v1";
const EMPTY: LearnProgress = { done: {} };
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache = EMPTY;

function snapshot(): LearnProgress {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {}
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cache = raw ? (JSON.parse(raw) as LearnProgress) : EMPTY;
      if (!cache.done) cache = EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function write(next: LearnProgress | null) {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export const useLearnProgress = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);

export function finishPack(id: PackId, quizRight: boolean) {
  const cur = snapshot();
  if (cur.done[id]) return; // keep the first finish date
  write({ done: { ...cur.done, [id]: { at: new Date().toISOString(), quizRight } } });
}

export function resetLearn() {
  write(null);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Days in a row, ending today, on which the person finished at least one pack. */
export function learnStreak(p: LearnProgress, now = new Date()) {
  const days = new Set(Object.values(p.done).map((d) => dayKey(new Date(d!.at))));
  let streak = 0;
  const d = new Date(now);
  while (days.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
