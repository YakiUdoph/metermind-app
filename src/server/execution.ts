/**
 * MeterMind Server — Execution Bridge (Milestone #4)
 *
 * Server-side wrapper around the execution domain.
 * This is the ONLY place where:
 *   - Environment variables (API keys) are read
 *   - Live adapters are registered into the registry
 *   - Network calls may originate
 *
 * Security contract:
 *   - COINGECKO_API_KEY is read here; it NEVER flows into client bundles.
 *   - The key is NEVER included in any returned ExecutionResult payload.
 *   - If no key is configured, CoinGeckoAdapter returns LIVE_PROVIDER_NOT_CONFIGURED.
 *     The executor surfaces this as a typed failure — no silent fallback to demo.
 *
 * Async: executePlan() is now async (Milestone #4) to support real HTTP adapters.
 */

import { executePlan } from "@/domain/execution/executor";
import { createDefaultRegistry } from "@/domain/execution/registry";
import { createCoinGeckoAdapter, COINGECKO_PROVIDER_ID } from "@/server/providers/coingecko";
import { BitfinexAdapter } from "@/server/providers/bitfinex";
import type { ProcurementPlan } from "@/domain/planning/types";
import type { ExecutionResult } from "@/domain/execution/types";

// ---------------------------------------------------------------------------
// Server-side registry factory
// ---------------------------------------------------------------------------

/**
 * Creates the server execution registry.
 *
 * Priority for market_data:
 *   1. CoinGeckoAdapter (LIVE) — if COINGECKO_API_KEY is set, this overrides
 *      any demo adapter registered for "coingecko" provider id.
 *   2. DemoProviderAdapter — used for all other providers (dataflow, searchx, etc.)
 *      that may also support market_data in demo mode.
 *
 * The registry resolves adapters by provider id. CoinGecko is only selected by
 * the executor if the procurement plan chose provider id "coingecko".
 * Demo providers (dataflow, searchx, etc.) remain unaffected.
 */
function createServerRegistry() {
  const registry = createDefaultRegistry();

  // Register CoinGecko live adapter (reads COINGECKO_API_KEY from environment)
  const coinGeckoAdapter = createCoinGeckoAdapter();
  registry.register(coinGeckoAdapter);

  // Register Bitfinex live adapter (public, unauthenticated)
  const bitfinexAdapter = new BitfinexAdapter();
  registry.register(bitfinexAdapter);

  return registry;
}

// ---------------------------------------------------------------------------
// Public server function
// ---------------------------------------------------------------------------

/**
 * Execute a ProcurementPlan and return the full execution audit.
 *
 * Async since Milestone #4 (live HTTP adapters require async execution).
 * The caller (route handler / server action) must await this.
 *
 * If COINGECKO_API_KEY is not set:
 *   - Plans selecting provider "coingecko" will receive LIVE_PROVIDER_NOT_CONFIGURED.
 *   - All other providers (demo adapters) execute normally.
 *   - The UI should surface this failure and offer explicit demo fallback.
 */
export async function executeTaskPlan(plan: ProcurementPlan): Promise<ExecutionResult> {
  const registry = createServerRegistry();
  return executePlan(plan, registry);
}

/**
 * Whether the CoinGecko live adapter is configured (key present in environment).
 * Used by the UI to show the correct badge before executing.
 */
export function isCoinGeckoConfigured(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.env["COINGECKO_API_KEY"] === "string" &&
    process.env["COINGECKO_API_KEY"].trim().length > 0
  );
}

/**
 * Provider ID constant re-exported for use in UI layer.
 * Avoids importing the full adapter into client bundles.
 */
export { COINGECKO_PROVIDER_ID };
