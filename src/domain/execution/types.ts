/**
 * MeterMind Execution Domain — Type Definitions
 *
 * Pure TypeScript. No React, no TanStack, no browser APIs, no external services.
 *
 * This module defines the typed contract for the service execution layer:
 *   ProviderAdapter — the interface every adapter (demo or live) must implement
 *   ServiceExecutionRequest / ServiceExecutionResult — adapter I/O
 *   ExecutionResult — the full audit object returned by executePlan()
 *
 * Architectural invariant:
 *   Planner  → decides WHAT is needed
 *   Scoring  → decides WHO provides it      (Milestone #1, untouched)
 *   Execution→ performs the JOB using the provider already selected
 *
 * The execution layer NEVER re-ranks providers and NEVER re-plans.
 */

import type { ServiceCategory } from "@/domain/planning/types";
import type { EvaluatedProvider } from "@/domain/procurement/types";
import type { ProcurementPlan } from "@/domain/planning/types";
import type { LiveObservation } from "@/domain/procurement/live-evaluation";

// ---------------------------------------------------------------------------
// Execution Mode
// ---------------------------------------------------------------------------

/**
 * Whether an adapter is running against real external infrastructure ("live")
 * or a deterministic local simulation ("demo").
 *
 * CRITICAL: Demo results must ALWAYS carry executionMode: "demo".
 * A judge must never be misled into believing demo output came from a real API.
 */
export type ExecutionMode = "demo" | "live";

// ---------------------------------------------------------------------------
// Execution Status
// ---------------------------------------------------------------------------

/** All possible outcomes from a single service execution attempt. */
export type ExecutionStatusResult =
  | "SUCCESS"
  | "PROVIDER_ADAPTER_NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "EXECUTION_FAILED"
  | "EXECUTION_TIMEOUT"
  | "SERVICE_NOT_SUPPORTED"
  | "EXECUTION_BUDGET_EXCEEDED"
  | "INVALID_EXECUTION_REQUEST"
  // ── Live-provider typed failures (Milestone #4) ───────────────────────────
  /** No API key configured for the live provider. */
  | "LIVE_PROVIDER_NOT_CONFIGURED"
  /** 401 / bad API key returned by the live provider. */
  | "LIVE_PROVIDER_AUTH_FAILED"
  /** 429 rate limit returned by the live provider. */
  | "LIVE_PROVIDER_RATE_LIMITED"
  /** 5xx or network-level error from the live provider. */
  | "LIVE_PROVIDER_UNAVAILABLE"
  /** Live provider returned a response that could not be parsed/validated. */
  | "LIVE_PROVIDER_BAD_RESPONSE"
  /** Discrepancy between live price feeds exceeds safety threshold. */
  | "QUOTE_DISAGREEMENT";

// ---------------------------------------------------------------------------
// Structured live market-data payload (Milestone #4)
// ---------------------------------------------------------------------------

/** Per-asset price entry returned by a live market-data adapter. */
export interface LiveAssetPrice {
  readonly assetId: string;        // CoinGecko asset id, e.g. "bitcoin"
  readonly symbol: string;         // e.g. "BTC"
  readonly name: string;           // e.g. "Bitcoin"
  readonly currency: string;       // e.g. "usd"
  readonly price: number;          // e.g. 67000.0
  readonly marketCap: number | null;
  readonly volume24h: number | null;
  readonly priceChangePercent24h: number | null;
}

/**
 * Structured payload for market_data service executions.
 * Both demo and live adapters populate this structure.
 * Demo adapters use placeholder prices; live adapters use real CoinGecko data.
 */
export interface LiveMarketDataPayload {
  readonly assets: readonly LiveAssetPrice[];
  readonly fetchedAt: string;   // ISO 8601 timestamp of data retrieval
  readonly dataSource: string;  // e.g. "CoinGecko Demo API" or "[DEMO] fixture"
  readonly currency: string;
}



// ---------------------------------------------------------------------------
// Adapter I/O
// ---------------------------------------------------------------------------

/** Input provided to a ProviderAdapter for a single service execution. */
export interface ServiceExecutionRequest {
  /** The service category to execute. */
  readonly service: ServiceCategory;
  /** The original natural-language task description. */
  readonly task: string;
  /**
   * Output from the immediately preceding stage (if any).
   * Enables chaining: web_search → content_extraction → summarization.
   * null for the first stage or for independent services.
   */
  readonly priorContext: string | null;
  /** Budget allocated to this specific service by the planner. */
  readonly allocatedBudget: number;
  /** The provider selected by the procurement scoring engine. */
  readonly selectedProvider: EvaluatedProvider;
  /** Maximum allowed wall-clock latency in ms (optional, adapter may honour it). */
  readonly maxLatencyMs?: number | undefined;
}

/** Result of a single service execution attempt. */
export interface ServiceExecutionResult {
  readonly status: ExecutionStatusResult;
  readonly service: ServiceCategory;
  readonly providerId: string;
  readonly providerName: string;
  /**
   * Execution mode — always "demo" for built-in adapters.
   * TypeScript ensures this cannot be changed to "live" accidentally.
   */
  readonly executionMode: ExecutionMode;
  /** Service output payload (text). null on failure. */
  readonly payload: string | null;
  /**
   * Structured market-data payload (Milestone #4).
   * Populated only for market_data executions (demo or live).
   * null for all other service categories.
   */
  readonly structuredPayload?: LiveMarketDataPayload | undefined;
  /** Wall-clock timestamp (ms since epoch) when execution started. */
  readonly startedAt: number;
  /** Wall-clock timestamp when execution completed or failed. */
  readonly completedAt: number;
  /** Actual measured latency = completedAt − startedAt. */
  readonly measuredLatencyMs: number;
  /** Provider's declared price per call (from mock catalog). */
  readonly declaredCost?: number | undefined;
  readonly allocatedBudget: number;
  readonly errorMessage?: string | undefined;
}

// ---------------------------------------------------------------------------
// Provider Adapter Interface
// ---------------------------------------------------------------------------

/**
 * The contract every provider adapter (demo or live) must satisfy.
 *
 * Rules:
 * - The adapter MUST NOT select or re-rank providers. selectedProvider is given.
 * - The adapter MUST set executionMode correctly and honestly.
 * - Demo adapters MUST return executionMode: "demo" always.
 * - Live adapters MUST return executionMode: "live" only when a real API was called.
 * - execute() MUST NOT throw — all failures are returned as typed results.
 * - execute() returns a Promise to support async/network operations (Milestone #4).
 *   Demo adapters may return Promise.resolve(syncResult) for simplicity.
 */
export interface ProviderAdapter {
  /** Must match a provider id in the planningProviders catalog. */
  readonly providerId: string;
  readonly providerName: string;
  /** Which service categories this adapter can handle. */
  readonly supportedCapabilities: readonly ServiceCategory[];
  /** Whether this adapter calls real external infrastructure. */
  readonly executionMode: ExecutionMode;
  /**
   * Execute the given service request.
   * Never throws. All failures are returned as typed ServiceExecutionResult.
   * Returns a Promise to support network I/O in live adapters.
   */
  execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult>;
  /** Returns false if the provider is known to be unavailable right now. */
  isAvailable(): boolean;
}

// ---------------------------------------------------------------------------
// Execution Audit Object
// ---------------------------------------------------------------------------

/**
 * The complete, immutable audit record produced by executePlan().
 *
 * Contains every stage's result, every measurement, and the final task output.
 * This object is the foundation for future persistence/dashboard history.
 *
 * On partial failure:
 * - status != "SUCCESS"
 * - serviceExecutions contains ALL stages that were attempted (including the failed one)
 * - finalResult is null
 * - failedService identifies which service caused the halt
 */
export interface ExecutionResult {
  readonly task: string;
  readonly plan: ProcurementPlan;
  /** All service executions attempted, in pipeline order. */
  readonly serviceExecutions: readonly ServiceExecutionResult[];
  readonly status: ExecutionStatusResult;
  /**
   * "demo" if any stage used a demo adapter.
   * "live" only when ALL stages used live adapters and no demo fallback occurred.
   */
  readonly overallExecutionMode: "live" | "hybrid" | "demo";
  readonly startedAt: number;
  readonly completedAt: number;
  /** Sum of individual stage latencies (not wall-clock total). */
  readonly totalMeasuredLatencyMs: number;
  /** Sum of individual stage declared costs. */
  readonly totalDeclaredCost: number;
  readonly totalAllocatedBudget: number;
  /** Payload from the final successful stage. null if execution failed. */
  readonly finalResult: string | null;
  readonly errorMessage?: string | undefined;
  /** Which service category caused a failure (if applicable). */
  readonly failedService?: ServiceCategory | undefined;
  /**
   * Structured market-data result from the last successful market_data stage.
   * Populated only for tasks that include a market_data service.
   * null when execution failed or no market_data stage ran.
   */
  readonly liveMarketData?: LiveMarketDataPayload | undefined;
  /** In-memory session observations collected during live competition execution. */
  readonly liveObservations?: readonly LiveObservation[] | undefined;
  readonly selectedLiveProvider?: string | undefined;
  readonly liveSelectionExplanation?: string | undefined;
  readonly quoteDifferencePercent?: number | null | undefined;
}
