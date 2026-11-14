import type { MarketDb, TelecomDb } from "./market";

// Events the market agent streams to the app (see src/lib/market-agent.ts). Safe for client components.
export type AgentStep = "search" | "read" | "check" | "segment";
export type AgentEvent =
  | { type: "step"; step: AgentStep; status: "running" | "done" | "failed"; detail: string }
  | { type: "result"; db: AgentDb; live: boolean; error?: string };

export type AgentDb = MarketDb | TelecomDb;
export type AgentName = AgentDb["agent"];
