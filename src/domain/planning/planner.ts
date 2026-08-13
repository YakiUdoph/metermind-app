/**
 * MeterMind Planning Domain — Task Planner (Orchestrator)
 *
 * Top-level entry point for the planning pipeline:
 *
 *   PlanningRequest
 *     → Task Understanding  (understandTask)
 *     → Service Requirements  (getServiceRequirements)
 *     → Budget Allocation  (allocateBudget)
 *     → Provider Capability Filtering
 *     → Procurement Scoring  (evaluateProcurement — existing Milestone #1 engine)
 *     → ProcurementPlan
 *
 * The scoring algorithm is NEVER duplicated here. Provider selection is entirely
 * delegated to evaluateProcurement() for each service.
 *
 * On any failure the result status is a typed PlanningStatusResult and plan is null.
 * Partial plans are never fabricated.
 */

import type {
  PlanningRequest,
  PlanningResult,
  ProcurementPlan,
  ServiceProcurementResult,
  ServiceCategory,
} from "./types";
import { understandTask, getServiceRequirements } from "./understanding";
import { allocateBudget } from "./budget";
import { evaluateProcurement } from "@/domain/procurement/scoring";
import { planningProviders as defaultCatalog } from "@/lib/mock";
import type { Provider } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum budget that must be allocated to any single service.
 * Below this threshold the procurement engine cannot meaningfully function.
 */
const MIN_SERVICE_BUDGET = 0.001;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPlanRationale(
  partial: Omit<ProcurementPlan, "planRationale">,
): string {
  const n = partial.serviceRequirements.length;
  const hasParallel = partial.serviceRequirements.some((s) => s.canParallelize);
  const winners = partial.serviceResults
    .map((r) => r.procurementResult.selectedProvider?.name)
    .filter((name): name is string => typeof name === "string")
    .join(", ");

  return (
    `MeterMind identified ${n} service${n !== 1 ? "s" : ""} required for this task ` +
    `(intent: ${partial.intent.category.replace(/_/g, " ")}). ` +
    (hasParallel
      ? "Some services can execute in parallel to reduce total latency. "
      : "Services execute sequentially. ") +
    `Selected providers: ${winners || "none"}. ` +
    `Estimated total cost: $${partial.estimatedTotalCost.toFixed(3)} ` +
    `of $${partial.totalBudget.toFixed(3)} total budget.`
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Plans procurement for a natural-language task within the given budget.
 *
 * @param request - Task, total budget, priority, and optional constraints.
 * @param catalog - Provider catalog with capabilities annotated (defaults to planningProviders).
 * @returns A typed PlanningResult. On failure, plan is always null.
 */
export function planTask(
  request: PlanningRequest,
  catalog: Provider[] = defaultCatalog,
): PlanningResult {
  // ── Step 1: Input validation ──────────────────────────────────────────────
  if (!request.task || !request.task.trim()) {
    return {
      status: "EMPTY_TASK",
      plan: null,
      errorMessage: "Task description is required.",
    };
  }

  if (typeof request.totalBudget !== "number" || request.totalBudget <= 0) {
    return {
      status: "BUDGET_TOO_LOW",
      plan: null,
      errorMessage: "A valid positive total budget is required.",
    };
  }

  // ── Step 2: Task understanding ────────────────────────────────────────────
  const intent = understandTask(request.task);

  if (intent.category === "unsupported") {
    return {
      status: "UNSUPPORTED_TASK",
      plan: null,
      errorMessage:
        "MeterMind could not determine what services are required for this task. " +
        "Supported task types: research & summarize, web search, translation, " +
        "market data comparison, code review, image analysis, content extraction.",
    };
  }

  // ── Step 3: Resolve service requirements ──────────────────────────────────
  const serviceRequirements = getServiceRequirements(intent.category);

  // ── Step 4: Allocate budget ───────────────────────────────────────────────
  const budgetMap = allocateBudget(serviceRequirements, request.totalBudget);

  // Reject budgets too small to meaningfully allocate per service
  for (const req of serviceRequirements) {
    const allocated = budgetMap.get(req.service) ?? 0;
    if (allocated < MIN_SERVICE_BUDGET) {
      return {
        status: "BUDGET_TOO_LOW",
        plan: null,
        errorMessage:
          `Total budget of $${request.totalBudget.toFixed(3)} is too small to allocate ` +
          `the minimum $${MIN_SERVICE_BUDGET.toFixed(3)} per service across ` +
          `${serviceRequirements.length} required service(s). ` +
          `Minimum recommended budget: $${(MIN_SERVICE_BUDGET * serviceRequirements.length).toFixed(3)}.`,
      };
    }
  }

  // ── Step 5: Provider selection via existing scoring engine ────────────────
  const serviceResults: ServiceProcurementResult[] = [];

  for (const req of serviceRequirements) {
    // Filter the catalog to only providers that declare this service capability
    const capableProviders = catalog.filter(
      (p) =>
        Array.isArray(p.capabilities) &&
        (p.capabilities as string[]).includes(req.service as string),
    );

    if (capableProviders.length === 0) {
      return {
        status: "NO_PROVIDERS_FOR_SERVICE",
        plan: null,
        errorMessage: `No providers in the catalog support the "${req.service}" service category.`,
        failedService: req.service,
      };
    }

    const allocatedBudget = budgetMap.get(req.service) ?? 0;

    // Delegate provider ranking to the Milestone #1 procurement scoring engine.
    // The planner does NOT duplicate the scoring mathematics.
    const procResult = evaluateProcurement(
      {
        task: request.task,
        budget: allocatedBudget,
        priority: request.priority,
        constraints: request.constraints,
      },
      capableProviders,
    );

    // Propagate procurement failure — do not fabricate a partial plan
    if (procResult.status !== "SUCCESS") {
      const mappedStatus =
        procResult.status === "BUDGET_TOO_LOW"
          ? "BUDGET_TOO_LOW"
          : "NO_PROVIDERS_FOR_SERVICE";

      return {
        status: mappedStatus,
        plan: null,
        errorMessage:
          `Failed to procure the "${req.service}" service: ${procResult.errorMessage ?? procResult.status}`,
        failedService: req.service,
      };
    }

    serviceResults.push({ service: req.service, allocatedBudget, procurementResult: procResult });
  }

  // ── Step 6: Assemble the final plan ──────────────────────────────────────
  const totalAllocatedBudget = Number(
    [...budgetMap.values()].reduce((s, v) => s + v, 0).toFixed(3),
  );
  const estimatedTotalCost = Number(
    serviceResults
      .reduce((s, r) => s + (r.procurementResult.selectedCost ?? 0), 0)
      .toFixed(3),
  );
  const estimatedTotalSavings = Number(
    serviceResults
      .reduce((s, r) => s + (r.procurementResult.estimatedSavings ?? 0), 0)
      .toFixed(3),
  );

  const planBase: Omit<ProcurementPlan, "planRationale"> = {
    originalTask: request.task,
    intent,
    serviceRequirements,
    serviceResults,
    totalAllocatedBudget,
    totalBudget: request.totalBudget,
    estimatedTotalCost,
    estimatedTotalSavings,
  };

  const plan: ProcurementPlan = {
    ...planBase,
    planRationale: buildPlanRationale(planBase),
  };

  return { status: "SUCCESS", plan };
}
