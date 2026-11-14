import type { MarketDb } from "./market";

// Events the market agent streams to the app (see src/lib/market-agent.ts). Safe for client components.
export type AgentStep = "search" | "read" | "check" | "segment";
export type AgentEvent =
  | { type: "step"; step: AgentStep; status: "running" | "done" | "failed"; detail: string }
  | { type: "result"; db: MarketDb; live: boolean; error?: string };
