"use client";

import { ViewTransition, type ReactNode } from "react";

// Page transitions. Every page wraps its content in <Screen>.
//   nav-forward  deeper into a flow (Home -> Bills, open a contract): new screen slides in from the right
//   nav-back     back links: the screen slides back out to the right
//   anything else (tab bar, plain links): a quick fade and lift, because tabs are siblings, not depth
// Links pass these with transitionTypes={["nav-forward"]} or {["nav-back"]}.

const enter = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "screen-in" };
const exit = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "screen-out" };

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="none" enter={enter} exit={exit}>
      {children}
    </ViewTransition>
  );
}

/** Swaps between views inside one page (bill list and a contract) with the same motion as a route change. */
export function SubScreen({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ViewTransition key={id} default="none" enter={enter} exit={exit}>
      {children}
    </ViewTransition>
  );
}
