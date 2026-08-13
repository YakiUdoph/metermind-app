/**
 * MeterMind Execution Domain — Plan Executor (Orchestrator)
 *
 * Top-level entry point for service execution:
 *
 *   ProcurementPlan (from Milestone #2 planner)
 *     → Group services by executionOrder
 *     → For each group, for each service:
 *         1. Resolve adapter from registry
 *         2. Budget guard (provider.price <= allocatedBudget)
 *         3. Execute via adapter (async — supports live network adapters)
 *         4. Forward payload as priorContext to next group
 *     → Assemble ExecutionResult (audit object)
 *
 * Critical rules enforced here:
 *   - The executor does NOT re-rank or re-select providers.
 *   - The executor does NOT re-plan. It takes the plan as authoritative.
 *   - On any failure, completed stages are preserved in serviceExecutions.
 *   - Partial success is never labelled as SUCCESS.
 *   - finalResult is only set when all stages complete successfully.
 *   - overallExecutionMode is "live" only when ALL stages used live adapters.
 *   - liveMarketData is populated from the last successful market_data stage.
 */

import type {
  ExecutionResult,
  ServiceExecutionResult,
  ServiceExecutionRequest,
  LiveMarketDataPayload,
} from "./types";
import type {
  ProcurementPlan,
  ServiceRequirement,
  ServiceProcurementResult,
  ServiceCategory,
} from "@/domain/planning/types";
import { AdapterRegistry, createDefaultRegistry } from "./registry";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ServicePair {
  requirement: ServiceRequirement;
  procurementResult: ServiceProcurementResult;
}

/**
 * Groups service pairs by executionOrder, returns them sorted ascending.
 * Services in the same group are "parallelizable" per the planner metadata;
 * for M3/M4 we execute them sequentially within the group for correctness.
 */
function groupByExecutionOrder(
  requirements: readonly ServiceRequirement[],
  results: readonly ServiceProcurementResult[],
): ServicePair[][] {
  const pairs: ServicePair[] = requirements.map((req, i) => ({
    requirement: req,
    procurementResult: results[i]!,
  }));

  const groupMap = new Map<number, ServicePair[]>();
  for (const pair of pairs) {
    const order = pair.requirement.executionOrder;
    if (!groupMap.has(order)) groupMap.set(order, []);
    groupMap.get(order)!.push(pair);
  }

  return [...groupMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group);
}

function buildFailedResult(
  plan: ProcurementPlan,
  completedExecutions: ServiceExecutionResult[],
  startedAt: number,
  status: ExecutionResult["status"],
  failedService: ServiceCategory | undefined,
  errorMessage: string,
): ExecutionResult {
  const completedAt = Date.now();
  const overallExecutionMode =
    completedExecutions.length > 0 &&
    completedExecutions.every((e) => e.executionMode === "live")
      ? "live" as const
      : "demo" as const;

  return {
    task: plan.originalTask,
    plan,
    serviceExecutions: completedExecutions,
    status,
    overallExecutionMode,
    startedAt,
    completedAt,
    totalMeasuredLatencyMs: completedExecutions.reduce((s, e) => s + e.measuredLatencyMs, 0),
    totalDeclaredCost: Number(
      completedExecutions.reduce((s, e) => s + (e.declaredCost ?? 0), 0).toFixed(3),
    ),
    totalAllocatedBudget: plan.totalAllocatedBudget,
    finalResult: null,
    errorMessage,
    failedService,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Executes all services in a ProcurementPlan using the registered adapters.
 *
 * @param plan     - A successful ProcurementPlan from planTask().
 * @param registry - Adapter registry (defaults to createDefaultRegistry()).
 * @returns        - A complete ExecutionResult audit object. Never throws.
 *
 * Async: required because live adapters (e.g. CoinGecko) perform real HTTP calls.
 * Demo adapters return Promise.resolve(syncResult) and are not affected.
 */
export async function executePlan(
  plan: ProcurementPlan,
  registry?: AdapterRegistry,
): Promise<ExecutionResult> {
  const reg = registry ?? createDefaultRegistry();
  const startedAt = Date.now();
  const completedExecutions: ServiceExecutionResult[] = [];

  // Validate: plan must have at least one service
  if (plan.serviceRequirements.length === 0 || plan.serviceResults.length === 0) {
    return buildFailedResult(
      plan,
      completedExecutions,
      startedAt,
      "INVALID_EXECUTION_REQUEST",
      undefined,
      "Plan contains no service requirements to execute.",
    );
  }

  // Group services by executionOrder for pipeline execution
  const groups = groupByExecutionOrder(plan.serviceRequirements, plan.serviceResults);

  let priorContext: string | null = null;

  for (const group of groups) {
    // Within each group, execute sequentially (parallelism metadata preserved in results)
    for (const { requirement, procurementResult } of group) {
      const { allocatedBudget, procurementResult: innerProcResult } = procurementResult;
      const { selectedProvider } = innerProcResult;

      // Guard: selectedProvider must be non-null (plan contract)
      if (!selectedProvider) {
        return buildFailedResult(
          plan, completedExecutions, startedAt,
          "INVALID_EXECUTION_REQUEST",
          requirement.service,
          `No selected provider in plan for service "${requirement.service}".`,
        );
      }

      // ── Budget guard ──────────────────────────────────────────────────────
      const hasPrice = selectedProvider.price !== undefined && selectedProvider.price !== null;
      if (hasPrice && selectedProvider.price! > allocatedBudget) {
        const failedExec: ServiceExecutionResult = {
          status: "EXECUTION_BUDGET_EXCEEDED",
          service: requirement.service,
          providerId: selectedProvider.id,
          providerName: selectedProvider.name,
          executionMode: "demo",
          payload: null,
          startedAt: Date.now(),
          completedAt: Date.now(),
          measuredLatencyMs: 0,
          declaredCost: selectedProvider.price,
          allocatedBudget,
          errorMessage:
            `Provider cost $${selectedProvider.price!.toFixed(3)} exceeds ` +
            `allocated budget $${allocatedBudget.toFixed(3)} for service "${requirement.service}".`,
        };
        completedExecutions.push(failedExec);
        return buildFailedResult(
          plan, completedExecutions, startedAt,
          "EXECUTION_BUDGET_EXCEEDED",
          requirement.service,
          failedExec.errorMessage!,
        );
      }

      // ── Adapter resolution ────────────────────────────────────────────────
      const resolved = reg.resolve(selectedProvider.id, requirement.service);

      if (!resolved.ok) {
        const failedExec: ServiceExecutionResult = {
          status: resolved.status,
          service: requirement.service,
          providerId: selectedProvider.id,
          providerName: selectedProvider.name,
          executionMode: "demo",
          payload: null,
          startedAt: Date.now(),
          completedAt: Date.now(),
          measuredLatencyMs: 0,
          declaredCost: selectedProvider.price,
          allocatedBudget,
          errorMessage:
            `Adapter resolution failed for provider "${selectedProvider.id}" ` +
            `on service "${requirement.service}": ${resolved.status}`,
        };
        completedExecutions.push(failedExec);
        return buildFailedResult(
          plan, completedExecutions, startedAt,
          resolved.status,
          requirement.service,
          failedExec.errorMessage!,
        );
      }

      // ── Execute (async — supports live network adapters) ──────────────────
      const execRequest: ServiceExecutionRequest = {
        service: requirement.service,
        task: plan.originalTask,
        priorContext,
        allocatedBudget,
        selectedProvider,
      };

      const execResult = await resolved.adapter.execute(execRequest);
      completedExecutions.push(execResult);

      if (execResult.status !== "SUCCESS") {
        return buildFailedResult(
          plan, completedExecutions, startedAt,
          execResult.status,
          requirement.service,
          execResult.errorMessage ??
            `Service "${requirement.service}" execution failed with status: ${execResult.status}`,
        );
      }

      // ── Forward output to next stage ──────────────────────────────────────
      priorContext = execResult.payload;
    }
  }

  // ── All stages succeeded — assemble the audit object ─────────────────────
  const completedAt = Date.now();
  const totalDeclaredCost = Number(
    completedExecutions.reduce((s, e) => s + (e.declaredCost ?? 0), 0).toFixed(3),
  );
  const totalMeasuredLatencyMs = completedExecutions.reduce((s, e) => s + e.measuredLatencyMs, 0);

  // overallExecutionMode is "live" only when every stage used a live adapter
  const overallExecutionMode: "demo" | "live" =
    completedExecutions.every((e) => e.executionMode === "live") ? "live" : "demo";

  // Extract structured market-data payload from the last successful market_data stage
  const liveMarketData: LiveMarketDataPayload | undefined = (() => {
    const marketExec = [...completedExecutions]
      .reverse()
      .find((e) => e.service === "market_data" && e.structuredPayload !== undefined);
    return marketExec?.structuredPayload;
  })();

  return {
    task: plan.originalTask,
    plan,
    serviceExecutions: completedExecutions,
    status: "SUCCESS",
    overallExecutionMode,
    startedAt,
    completedAt,
    totalMeasuredLatencyMs,
    totalDeclaredCost,
    totalAllocatedBudget: plan.totalAllocatedBudget,
    finalResult: priorContext,
    errorMessage: undefined,
    failedService: undefined,
    liveMarketData,
  };
}
