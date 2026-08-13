/**
 * MeterMind Server — Execution Bridge
 *
 * Thin server-side wrapper around the execution domain.
 *
 * Currently exposes the execution pipeline to server functions.
 * In a future milestone, this file will be extended to:
 *   - Call real external APIs when live adapters are registered
 *   - Apply authentication / API key injection (server-only)
 *   - Handle async execution with streaming
 *   - Persist audit results to a database
 *
 * Network calls and secrets MUST live here, not in src/domain/.
 */

import { executePlan } from "@/domain/execution/executor";
import { createDefaultRegistry } from "@/domain/execution/registry";
import type { ProcurementPlan } from "@/domain/planning/types";
import type { ExecutionResult } from "@/domain/execution/types";

// ---------------------------------------------------------------------------
// Server-side registry (extended later with real adapters)
// ---------------------------------------------------------------------------

/**
 * Creates the server execution registry.
 * Starts with the default demo registry; real adapters will be added here
 * using environment variables / server-side secrets in future milestones.
 */
function createServerRegistry() {
  const registry = createDefaultRegistry();
  // TODO Milestone #4: register real adapters here
  // e.g. registry.register(new RealSearchAdapter(process.env.SEARCH_API_KEY));
  return registry;
}

// ---------------------------------------------------------------------------
// Public server functions
// ---------------------------------------------------------------------------

/**
 * Execute a ProcurementPlan and return the full execution audit.
 *
 * Called from server actions / API routes. The domain-level executePlan()
 * is synchronous; this wrapper is the extension point for async behaviour.
 */
export function executeTaskPlan(plan: ProcurementPlan): ExecutionResult {
  const registry = createServerRegistry();
  return executePlan(plan, registry);
}
