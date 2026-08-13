/**
 * MeterMind Planning Domain — Budget Allocation
 *
 * Deterministic, weight-proportional budget allocation across service requirements.
 *
 * Algorithm:
 *   allocationᵢ = floor((weightᵢ / Σweights) × totalBudget × 1000) / 1000
 *
 * The last service absorbs the floating-point remainder so that:
 *   Σallocations <= totalBudget  (invariant always holds)
 *
 * All allocations are floored to 3 decimal places (matching provider price precision).
 */

import type { ServiceCategory, ServiceRequirement } from "./types";

// ---------------------------------------------------------------------------
// Documented budget weights per service category
// ---------------------------------------------------------------------------

/**
 * Base budget weight for each service category.
 * Higher weight = larger proportional share of the task budget.
 *
 * Rationale:
 *   code_analysis / image_analysis: compute-intensive inference → largest share
 *   translation:                     standalone language model tasks → medium-large
 *   web_search / market_data:        high-volume I/O tasks → medium
 *   summarization:                   inference but often secondary → medium
 *   content_extraction:              lightweight parsing → smallest share
 */
export const SERVICE_BUDGET_WEIGHTS: Record<ServiceCategory, number> = {
  code_analysis: 0.40,
  image_analysis: 0.35,
  translation: 0.35,
  market_data: 0.30,
  web_search: 0.30,
  summarization: 0.25,
  content_extraction: 0.20,
};

// ---------------------------------------------------------------------------
// Allocation function
// ---------------------------------------------------------------------------

/**
 * Deterministically allocates totalBudget across services by their relative weights.
 *
 * Invariant: sum(values in returned Map) <= totalBudget
 *
 * @param services - Ordered service requirements (order matters for determinism)
 * @param totalBudget - Total available budget in USD
 * @returns Map of ServiceCategory → allocated USD amount (3 decimal precision)
 */
export function allocateBudget(
  services: readonly ServiceRequirement[],
  totalBudget: number,
): Map<ServiceCategory, number> {
  const result = new Map<ServiceCategory, number>();
  if (services.length === 0) return result;

  const totalWeight = services.reduce((sum, s) => sum + s.budgetWeight, 0);
  let cumulativeAllocated = 0;

  for (let i = 0; i < services.length; i++) {
    const req = services[i]!;

    if (i === services.length - 1) {
      // Last service absorbs the remaining budget.
      // This guarantees sum(allocations) == totalBudget (to floating-point precision)
      // and ensures the invariant sum(allocations) <= totalBudget holds.
      const remaining = Number(
        Math.max(0, totalBudget - cumulativeAllocated).toFixed(3),
      );
      result.set(req.service, remaining);
    } else {
      // Floor to 3dp to guarantee we never over-allocate on intermediate services.
      const rawShare = (req.budgetWeight / totalWeight) * totalBudget;
      const share = Math.floor(rawShare * 1000) / 1000;
      result.set(req.service, share);
      cumulativeAllocated = Number((cumulativeAllocated + share).toFixed(3));
    }
  }

  return result;
}
