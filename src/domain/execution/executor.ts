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
import { evaluateLiveObservations } from "@/domain/procurement/live-evaluation";
import type { LiveObservation } from "@/domain/procurement/live-evaluation";

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
  const hasLive = completedExecutions.some((e) => e.executionMode === "live");
  const hasDemo = completedExecutions.some((e) => e.executionMode === "demo");
  const overallExecutionMode: "live" | "hybrid" | "demo" =
    completedExecutions.length === 0
      ? "demo"
      : hasLive && hasDemo
      ? "hybrid"
      : hasLive
      ? "live"
      : "demo";

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
  let liveObservations: LiveObservation[] = [];
  let selectedLiveProvider: string | undefined;
  let liveSelectionExplanation: string | undefined;
  let quoteDifferencePercent: number | null = null;
  let hasQuoteDisagreement = false;

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

      const isLiveMarketData =
        requirement.service === "market_data" &&
        selectedProvider.mode === "live";

      let execResult: ServiceExecutionResult;

      if (isLiveMarketData) {
        // Resolve all live adapters for market_data
        const liveAdapters = reg.getAdaptersForService("market_data")
          .filter((a) => a.executionMode === "live");

        if (liveAdapters.length >= 2) {
          // Run parallel probes
          const observationsPromise = liveAdapters.map(async (adapter) => {
            const startObs = Date.now();
            let providerEntry = selectedProvider;
            if (adapter.providerId === "coingecko") {
              providerEntry = { ...selectedProvider, id: "coingecko", name: "CoinGecko" };
            } else if (adapter.providerId === "bitfinex") {
              providerEntry = { ...selectedProvider, id: "bitfinex", name: "Bitfinex" };
            }

            const req: ServiceExecutionRequest = {
              service: requirement.service,
              task: plan.originalTask,
              priorContext,
              allocatedBudget,
              selectedProvider: providerEntry,
            };

            let res: ServiceExecutionResult;
            try {
              res = await adapter.execute(req);
            } catch (err: any) {
              res = {
                status: "LIVE_PROVIDER_UNAVAILABLE",
                service: requirement.service,
                providerId: adapter.providerId,
                providerName: adapter.providerName,
                executionMode: "live",
                payload: null,
                startedAt: startObs,
                completedAt: Date.now(),
                measuredLatencyMs: Date.now() - startObs,
                allocatedBudget,
                errorMessage: err.message,
              };
            }

            const completedObs = Date.now();
            
            // Validate completeness of asset prices
            let dataValid = false;
            let freshness: string | null = null;
            if (res.status === "SUCCESS" && res.structuredPayload) {
              const assets = res.structuredPayload.assets;
              const hasBtc = assets.some((a) => (a.assetId === "bitcoin" || a.symbol === "BTC") && a.price > 0);
              const hasEth = assets.some((a) => (a.assetId === "ethereum" || a.symbol === "ETH") && a.price > 0);
              dataValid = hasBtc && hasEth;
              freshness = res.structuredPayload.fetchedAt;
            }

            const obs: LiveObservation = {
              providerId: adapter.providerId,
              providerName: adapter.providerName,
              capability: "market_data",
              startedAt: startObs,
              completedAt: completedObs,
              latencyMs: res.measuredLatencyMs,
              success: res.status === "SUCCESS",
              httpStatus: res.status === "SUCCESS" ? 200 : 500,
              dataValid,
              freshness,
              errorCode: res.status !== "SUCCESS" ? res.status : null,
              payload: res.payload,
              structuredPayload: res.structuredPayload,
            };

            return { res, obs };
          });

          const results = await Promise.all(observationsPromise);
          liveObservations = results.map((r) => r.obs);

          const priority = procurementResult.procurementResult.request.priority;
          const constraints = procurementResult.procurementResult.request.constraints;

          const evalResult = evaluateLiveObservations(liveObservations, priority, constraints);
          
          quoteDifferencePercent = evalResult.quoteDifferencePercent;
          hasQuoteDisagreement = evalResult.hasQuoteDisagreement;
          liveSelectionExplanation = evalResult.explanation;

          if (hasQuoteDisagreement) {
            const failedExec: ServiceExecutionResult = {
              status: "QUOTE_DISAGREEMENT",
              service: requirement.service,
              providerId: "competition",
              providerName: "Multi-Provider Competition",
              executionMode: "live",
              payload: null,
              startedAt: Date.now(),
              completedAt: Date.now(),
              measuredLatencyMs: 0,
              allocatedBudget,
              errorMessage: evalResult.explanation,
            };
            completedExecutions.push(failedExec);
            const failedResult = buildFailedResult(
              plan, completedExecutions, startedAt,
              "QUOTE_DISAGREEMENT",
              requirement.service,
              failedExec.errorMessage!,
            );
            return {
              ...failedResult,
              liveObservations,
              quoteDifferencePercent,
              liveSelectionExplanation,
            };
          }

          if (evalResult.winner) {
            const winningObs = evalResult.winner;
            selectedLiveProvider = winningObs.providerId;
            const winningResult = results.find((r) => r.obs.providerId === winningObs.providerId)!;
            execResult = winningResult.res;
          } else {
            execResult = results[0]?.res ?? {
              status: "LIVE_PROVIDER_UNAVAILABLE",
              service: requirement.service,
              providerId: "competition",
              providerName: "Multi-Provider Competition",
              executionMode: "live",
              payload: null,
              startedAt: Date.now(),
              completedAt: Date.now(),
              measuredLatencyMs: 0,
              allocatedBudget,
              errorMessage: "All live providers failed or were excluded.",
            };
          }
        } else {
          // Fallback to single live adapter
          const startObs = Date.now();
          execResult = await resolved.adapter.execute(execRequest);
          let dataValid = false;
          let freshness: string | null = null;
          if (execResult.status === "SUCCESS" && execResult.structuredPayload) {
            const assets = execResult.structuredPayload.assets;
            const hasBtc = assets.some((a) => (a.assetId === "bitcoin" || a.symbol === "BTC") && a.price > 0);
            const hasEth = assets.some((a) => (a.assetId === "ethereum" || a.symbol === "ETH") && a.price > 0);
            dataValid = hasBtc && hasEth;
            freshness = execResult.structuredPayload.fetchedAt;
          }
          const obs: LiveObservation = {
            providerId: resolved.adapter.providerId,
            providerName: resolved.adapter.providerName,
            capability: "market_data",
            startedAt: startObs,
            completedAt: Date.now(),
            latencyMs: execResult.measuredLatencyMs,
            success: execResult.status === "SUCCESS",
            httpStatus: execResult.status === "SUCCESS" ? 200 : 500,
            dataValid,
            freshness,
            errorCode: execResult.status !== "SUCCESS" ? execResult.status : null,
            payload: execResult.payload,
            structuredPayload: execResult.structuredPayload,
          };
          liveObservations = [obs];
          selectedLiveProvider = resolved.adapter.providerId;
          liveSelectionExplanation = `${resolved.adapter.providerName} executed as the only configured live provider.`;
        }
      } else {
        execResult = await resolved.adapter.execute(execRequest);
      }

      completedExecutions.push(execResult);

      if (execResult.status !== "SUCCESS") {
        const failedResult = buildFailedResult(
          plan, completedExecutions, startedAt,
          execResult.status,
          requirement.service,
          execResult.errorMessage ??
            `Service "${requirement.service}" execution failed with status: ${execResult.status}`,
        );
        return {
          ...failedResult,
          liveObservations: liveObservations.length > 0 ? liveObservations : undefined,
          selectedLiveProvider,
          liveSelectionExplanation,
          quoteDifferencePercent,
        };
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

  const hasLive = completedExecutions.some((e) => e.executionMode === "live");
  const hasDemo = completedExecutions.some((e) => e.executionMode === "demo");
  const overallExecutionMode: "live" | "hybrid" | "demo" =
    hasLive && hasDemo ? "hybrid" : hasLive ? "live" : "demo";

  // Extract structured market-data payload from the last successful market_data stage
  const liveMarketData: LiveMarketDataPayload | undefined = (() => {
    const marketExec = [...completedExecutions]
      .reverse()
      .find((e) => e.service === "market_data" && e.structuredPayload !== undefined);
    return marketExec?.structuredPayload;
  })();

  const finalResult = composeFinalResult(
    plan,
    completedExecutions,
    liveObservations,
    liveSelectionExplanation,
    quoteDifferencePercent,
    selectedLiveProvider
  );

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
    finalResult,
    errorMessage: undefined,
    failedService: undefined,
    liveMarketData,
    liveObservations: liveObservations.length > 0 ? liveObservations : undefined,
    selectedLiveProvider,
    liveSelectionExplanation,
    quoteDifferencePercent,
  };
}

function composeFinalResult(
  plan: ProcurementPlan,
  completedExecutions: ServiceExecutionResult[],
  liveObservations?: readonly LiveObservation[],
  liveSelectionExplanation?: string,
  quoteDifferencePercent?: number | null,
  selectedLiveProvider?: string
): string | null {
  if (completedExecutions.length === 0) return null;

  const intentCategory = plan.intent.category;

  if (intentCategory === "market_comparison") {
    const marketExec = completedExecutions.find((e) => e.service === "market_data");
    if (marketExec && marketExec.status === "SUCCESS") {
      const isLive = marketExec.executionMode === "live";
      const payload = marketExec.structuredPayload;
      
      let btcPriceStr = "N/A";
      let ethPriceStr = "N/A";
      
      if (payload && payload.assets) {
        const btcAsset = payload.assets.find((a) => a.assetId === "bitcoin" || a.symbol === "BTC");
        const ethAsset = payload.assets.find((a) => a.assetId === "ethereum" || a.symbol === "ETH");
        if (btcAsset) btcPriceStr = `$${btcAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (ethAsset) ethPriceStr = `$${ethAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      const timestamp = payload?.fetchedAt || new Date(marketExec.completedAt).toISOString();
      const providerName = marketExec.providerName;

      let resultText = "";
      if (isLive) {
        resultText += "=== PRIMARY LIVE MARKET DATA RESULT ===\n";
      } else {
        resultText += "=== PRIMARY DEMO MARKET DATA RESULT ===\n";
      }
      
      resultText += `Bitcoin Price: ${btcPriceStr}\n`;
      resultText += `Ethereum Price: ${ethPriceStr}\n`;
      resultText += `Selected Provider: ${providerName}${isLive ? "" : " (Demo)"}\n`;

      if (isLive && liveObservations && liveObservations.length > 0) {
        const otherCandidates = liveObservations
          .filter((obs) => obs.providerId !== selectedLiveProvider)
          .map((obs) => `${obs.providerName} (${obs.latencyMs}ms)`)
          .join(", ");
        resultText += `Other Live Candidate(s): ${otherCandidates || "None"}\n`;

        const latencies = liveObservations
          .map((obs) => `${obs.providerName}: ${obs.latencyMs}ms`)
          .join(", ");
        resultText += `Observed Latencies: ${latencies}\n`;

        const diffStr = quoteDifferencePercent !== undefined && quoteDifferencePercent !== null
          ? `${(quoteDifferencePercent * 100).toFixed(4)}%`
          : "N/A";
        resultText += `Quote Difference: ${diffStr}\n`;
      } else {
        resultText += `Observed Latencies: ${providerName}: ${marketExec.measuredLatencyMs}ms${isLive ? "" : " (simulated)"}\n`;
      }

      resultText += `Timestamp: ${timestamp}\n`;
      
      if (isLive && liveSelectionExplanation) {
        resultText += `Why Winner Was Selected: ${liveSelectionExplanation}\n`;
      } else {
        resultText += `Why Winner Was Selected: Selected by procurement engine based on plan specifications.\n`;
      }

      const secondaryExecs = completedExecutions.filter((e) => e.service !== "market_data");
      if (secondaryExecs.length > 0) {
        resultText += "\n=== SUPPORTING DEMO CONTEXT ===\n";
        for (const sec of secondaryExecs) {
          resultText += `\n[Service: ${sec.service} | Provider: ${sec.providerName}]\n`;
          resultText += `${sec.payload}\n`;
        }
      }

      return resultText;
    }
  }

  const lastExec = completedExecutions[completedExecutions.length - 1];
  return lastExec ? lastExec.payload : null;
}
