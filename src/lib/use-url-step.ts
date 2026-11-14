"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A screen inside a page (an opened bill, an onboarding step) that the browser's back works for.
 *
 * Without this, opening a bill was only React state, so the iPhone's swipe back (and the browser back button) left
 * the whole page and usually landed on Home. Here each step gets its own history entry with a `?name=value` URL,
 * so swiping back returns to the previous step, and the in-app Back button does the same thing.
 */
export function useUrlStep(name: string, onChange?: (value: string | null, back: boolean) => void) {
  const [value, setValue] = useState<string | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });

  const apply = useCallback(
    (v: string | null, back: boolean) => {
      if (changeRef.current) changeRef.current(v, back);
      else setValue(v);
    },
    [],
  );

  useEffect(() => {
    const read = () => new URLSearchParams(window.location.search).get(name);
    // A reload or shared link keeps the step.
    const initial = read();
    if (initial !== null) apply(initial, false);
    const onPop = () => apply(read(), true);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [name, apply]);

  const urlFor = (v: string | null) => {
    const url = new URL(window.location.href);
    if (v === null) url.searchParams.delete(name);
    else url.searchParams.set(name, v);
    return url.pathname + url.search + url.hash;
  };

  /** Go forward to a step: adds a history entry. */
  const push = (v: string) => {
    // Marks the entry as one this page added, so the in-app Back knows it can use the browser's back.
    window.history.pushState({ ...window.history.state, solvoStep: name }, "", urlFor(v));
    apply(v, false);
  };

  /** Go back one step: uses the browser's back when this page added the entry, so swipe and button agree. */
  const back = (fallback: string | null) => {
    if (window.history.state?.solvoStep === name) {
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", urlFor(fallback));
    apply(fallback, true);
  };

  /** Change the step without a new history entry (e.g. restarting a flow). */
  const replace = (v: string | null) => {
    window.history.replaceState(window.history.state, "", urlFor(v));
    apply(v, false);
  };

  return { value, push, back, replace };
}
