/**
 * MeterMind Planning Domain — Type Definitions
 *
 * Pure TypeScript. No React, no TanStack, no browser APIs, no external services.
 * This module defines all typed models for Task Understanding + Procurement Planning.
 */

import type {
  ProcurementResult,
  ProcurementPriority,
  ProcurementConstraints,
} from "@/domain/procurement/types";

// ---------------------------------------------------------------------------
// Service Categories
// ---------------------------------------------------------------------------

/** The bounded set of service categories MeterMind can procure for. */
export type ServiceCategory =
  | "web_search"
  | "content_extraction"
  | "summarization"
  | "translation"
  | "market_data"
  | "code_analysis"
  | "image_analysis"
  | "paid_research";

/** Human-readable labels for each service category. */
export const SERVICE_LABELS: Record<ServiceCategory, string> = {
  web_search: "Web Search",
  content_extraction: "Content Extraction",
  summarization: "Summarization",
  translation: "Translation",
  market_data: "Market Data",
  code_analysis: "Code Analysis",
  image_analysis: "Image Analysis",
  paid_research: "Paid Research",
};

// ---------------------------------------------------------------------------
// Task Intent
// ---------------------------------------------------------------------------

/** All recognizable task intent categories plus the terminal unsupported case. */
export type TaskIntentCategory =
  | "research_and_summarize"
  | "translate_and_summarize"
  | "market_comparison"
  | "web_search_only"
  | "code_review"
  | "image_analysis_only"
  | "content_extraction_only"
  | "translate_only"
  | "paid_research"
  | "unsupported";

/**
 * The result of classifying a natural-language task description.
 * Produced entirely by deterministic pattern matching — no ML.
 */
export interface TaskIntent {
  readonly originalTask: string;
  readonly category: TaskIntentCategory;
  /** The specific keywords from the task text that triggered this classification. */
  readonly matchedKeywords: readonly string[];
  readonly confidence: "high" | "medium" | "low";
}

// ---------------------------------------------------------------------------
// Service Requirements
// ---------------------------------------------------------------------------

/**
 * A single service that must be procured as part of executing a task.
 * Services sharing the same executionOrder may execute in parallel.
 */
export interface ServiceRequirement {
  readonly service: ServiceCategory;
  /** 1-indexed step position; services with equal order numbers run in parallel. */
  readonly executionOrder: number;
  readonly canParallelize: boolean;
  /** Human-readable explanation of why this service is required. */
  readonly rationale: string;
  /**
   * Relative weight used for proportional budget allocation.
   * Higher weight = larger share of the total task budget.
   * Must be > 0.
   */
  readonly budgetWeight: number;
}

// ---------------------------------------------------------------------------
// Planning Request / Result
// ---------------------------------------------------------------------------

/** Input to the planning pipeline. */
export interface PlanningRequest {
  readonly task: string;
  readonly totalBudget: number;
  readonly priority: ProcurementPriority;
  readonly constraints?: ProcurementConstraints | undefined;
}

/** The per-service procurement outcome produced by delegating to the scoring engine. */
export interface ServiceProcurementResult {
  readonly service: ServiceCategory;
  /** Budget allocated to this service by the planner. */
  readonly allocatedBudget: number;
  /** Full result from evaluateProcurement() for this service. */
  readonly procurementResult: ProcurementResult;
}

/** The complete procurement plan assembled after all services have been scored. */
export interface ProcurementPlan {
  readonly id?: string | undefined;
  readonly originalTask: string;
  readonly intent: TaskIntent;
  readonly serviceRequirements: readonly ServiceRequirement[];
  readonly serviceResults: readonly ServiceProcurementResult[];
  /** Sum of all per-service allocations. Guaranteed <= totalBudget. */
  readonly totalAllocatedBudget: number;
  readonly totalBudget: number;
  /** Narrative summary of why this plan was constructed. */
  readonly planRationale: string;
  readonly estimatedTotalCost: number;
  readonly estimatedTotalSavings: number;
}

/** Typed status codes returned by the planning pipeline. Never throws. */
export type PlanningStatusResult =
  | "SUCCESS"
  | "UNSUPPORTED_TASK"
  | "EMPTY_TASK"
  | "BUDGET_TOO_LOW"
  | "NO_PROVIDERS_FOR_SERVICE"
  | "PLANNING_FAILURE";

/**
 * The top-level result from planTask().
 * On failure, plan is always null — no partial plans are fabricated.
 */
export interface PlanningResult {
  readonly status: PlanningStatusResult;
  readonly plan: ProcurementPlan | null;
  readonly errorMessage?: string | undefined;
  /** Populated when a specific service caused the failure. */
  readonly failedService?: ServiceCategory | undefined;
}
