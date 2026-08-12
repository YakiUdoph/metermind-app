import type { Provider } from "@/lib/mock";
import { demoProviders as defaultProviders } from "@/lib/mock";
import type {
  ProcurementRequest,
  ProcurementResult,
  EvaluatedProvider,
  ProcurementPriority,
} from "./types";

const PRIORITY_WEIGHTS: Record<
  ProcurementPriority,
  { price: number; quality: number; reliability: number; latency: number }
> = {
  balanced: { price: 0.2, quality: 0.45, reliability: 0.25, latency: 0.1 },
  "lowest-cost": { price: 0.75, quality: 0.1, reliability: 0.1, latency: 0.05 },
  "highest-quality": { price: 0.0, quality: 0.7, reliability: 0.3, latency: 0.0 },
  fastest: { price: 0.05, quality: 0.1, reliability: 0.2, latency: 0.65 },
};

export function evaluateProcurement(
  request: ProcurementRequest,
  providerCatalog: Provider[] = defaultProviders,
): ProcurementResult {
  // 1. Input Validation
  if (!request || typeof request.task !== "string" || !request.task.trim()) {
    return {
      status: "INVALID_REQUEST",
      request,
      selectedProvider: null,
      rankedProviders: [],
      rejectedProviders: [],
      estimatedComparableCost: 0,
      selectedCost: 0,
      estimatedSavings: 0,
      decisionReasons: [],
      errorMessage: "Task description is required.",
    };
  }

  if (typeof request.budget !== "number" || request.budget <= 0) {
    return {
      status: "BUDGET_TOO_LOW",
      request,
      selectedProvider: null,
      rankedProviders: [],
      rejectedProviders: [],
      estimatedComparableCost: 0,
      selectedCost: 0,
      estimatedSavings: 0,
      decisionReasons: [],
      errorMessage: "A valid positive budget is required.",
    };
  }

  const priority: ProcurementPriority = request.priority || "balanced";
  const constraints = request.constraints || {};
  const weights = PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.balanced;

  const excluded = (constraints.excludedProviders || []).map((p) => p.toLowerCase());
  const preferred = (constraints.preferredProviders || []).map((p) => p.toLowerCase());

  // 2. Filter Providers by Policy Constraints (Budget determines eligibility only)
  const evaluatedAll: EvaluatedProvider[] = providerCatalog.map((p) => {
    const disqualificationReasons: string[] = [];

    const providerId = (p.id || p.name).toLowerCase();
    const providerName = (p.name || "").toLowerCase();

    const isExcluded =
      excluded.includes(providerId) || excluded.includes(providerName);
    if (isExcluded) {
      disqualificationReasons.push(`Excluded by user policy`);
    }

    if (p.price > request.budget) {
      disqualificationReasons.push(
        `Exceeds maximum task budget ($${p.price.toFixed(3)} vs $${request.budget.toFixed(2)})`,
      );
    }

    if (constraints.maximumProviderPrice && p.price > constraints.maximumProviderPrice) {
      disqualificationReasons.push(
        `Exceeds maximum provider price limit ($${p.price.toFixed(3)} vs $${constraints.maximumProviderPrice.toFixed(3)})`,
      );
    }

    if (constraints.minimumQuality && p.quality < constraints.minimumQuality) {
      disqualificationReasons.push(
        `Quality score ${p.quality} is below minimum requirement of ${constraints.minimumQuality}`,
      );
    }

    if (constraints.minimumReliability && p.reliability < constraints.minimumReliability) {
      disqualificationReasons.push(
        `Reliability ${p.reliability}% is below minimum requirement of ${constraints.minimumReliability}%`,
      );
    }

    const isQualified = disqualificationReasons.length === 0;

    return {
      id: p.id || p.name.toLowerCase(),
      name: p.name,
      category: p.category || "Search",
      price: p.price,
      quality: p.quality,
      reliability: p.reliability,
      latency: p.latency,
      score: p.score,
      jobs: p.jobs || 0,
      failed: p.failed || 0,
      spend: p.spend || 0,
      trend: p.trend || 0,
      assessment: p.assessment || "",
      priceHistory: p.priceHistory || [p.price],
      qualityHistory: p.qualityHistory || [p.quality],
      priceScore: 0,
      qualityScore: p.quality,
      reliabilityScore: p.reliability,
      latencyScore: 0,
      totalScore: 0,
      isWinner: false,
      isQualified,
      disqualificationReasons: isQualified ? undefined : disqualificationReasons,
    };
  });

  const qualified = evaluatedAll.filter((p) => p.isQualified);
  const rejected = evaluatedAll.filter((p) => !p.isQualified);

  if (qualified.length === 0) {
    const isBudgetExceeded = providerCatalog.every((p) => p.price > request.budget);
    return {
      status: isBudgetExceeded ? "BUDGET_TOO_LOW" : "NO_COMPATIBLE_PROVIDERS",
      request,
      selectedProvider: null,
      rankedProviders: [],
      rejectedProviders: rejected,
      estimatedComparableCost: 0,
      selectedCost: 0,
      estimatedSavings: 0,
      decisionReasons: [],
      errorMessage: isBudgetExceeded
        ? `Budget of $${request.budget.toFixed(2)} is too low. No providers available within this budget.`
        : `No providers satisfied all constraints (${[
            constraints.minimumQuality ? `min quality ${constraints.minimumQuality}` : null,
            constraints.minimumReliability ? `min reliability ${constraints.minimumReliability}%` : null,
            constraints.excludedProviders?.length ? `excluded ${constraints.excludedProviders.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join(", ")}).`,
    };
  }

  // 3. Min-Max Normalization Across Qualified Candidate Set
  const minPrice = Math.min(...qualified.map((p) => p.price));
  const maxPrice = Math.max(...qualified.map((p) => p.price));
  const minLatency = Math.min(...qualified.map((p) => p.latency));
  const maxLatency = Math.max(...qualified.map((p) => p.latency));

  qualified.forEach((p) => {
    // Price Score: lowest qualified price receives 100, highest receives 0 (safe equal price fallback: 100)
    p.priceScore =
      maxPrice === minPrice
        ? 100
        : Math.round(((maxPrice - p.price) / (maxPrice - minPrice)) * 100);

    // Latency Score: lowest latency receives 100, highest receives 0 (safe equal latency fallback: 100)
    p.latencyScore =
      maxLatency === minLatency
        ? 100
        : Math.round(((maxLatency - p.latency) / (maxLatency - minLatency)) * 100);

    const baseScore =
      p.priceScore * weights.price +
      p.qualityScore * weights.quality +
      p.reliabilityScore * weights.reliability +
      p.latencyScore * weights.latency;

    const isPreferred =
      (p.id && preferred.includes(p.id.toLowerCase())) ||
      (p.name && preferred.includes(p.name.toLowerCase()));

    // Preferred provider receives a soft tie-breaker bonus of +3 points
    const preferredBonus = isPreferred ? 3 : 0;

    p.totalScore = Math.round((baseScore + preferredBonus) * 10) / 10;
  });

  // 4. 6-Stage Deterministic Tie Breaking
  qualified.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.reliability !== a.reliability) return b.reliability - a.reliability;
    if (b.quality !== a.quality) return b.quality - a.quality;
    if (a.price !== b.price) return a.price - b.price;
    if (a.latency !== b.latency) return a.latency - b.latency;
    return (a.id || a.name).localeCompare(b.id || b.name);
  });

  const winner = qualified[0]!;
  winner.isWinner = true;

  // 5. Estimated Savings Baseline (Next-Best Qualified Alternative)
  const alternative = qualified.length > 1 ? qualified[1] : undefined;
  const estimatedComparableCost = alternative
    ? Number(alternative.price.toFixed(3))
    : Number(winner.price.toFixed(3));
  const comparisonProvider = alternative ? alternative.name : undefined;
  const selectedCost = Number(winner.price.toFixed(3));
  const estimatedSavings = alternative
    ? Number(Math.max(0, alternative.price - winner.price).toFixed(3))
    : 0;

  // 6. Decision Rationale Generator
  const decisionReasons: string[] = [];

  decisionReasons.push(
    `${winner.name} achieved the highest weighted score (${winner.totalScore}/100) under your ${priority} priority.`,
  );

  if (alternative && alternative.price > winner.price) {
    const pctLower = Math.round(((alternative.price - winner.price) / alternative.price) * 100);
    decisionReasons.push(
      `Priced at $${selectedCost.toFixed(3)}, which is ${pctLower}% cheaper than the next-best qualified alternative (${alternative.name} at $${alternative.price.toFixed(3)}).`,
    );
  } else {
    decisionReasons.push(`Delivers optimal value at $${selectedCost.toFixed(3)} per execution.`);
  }

  decisionReasons.push(
    `Quality score ${winner.quality}/100 and reliability ${winner.reliability}% satisfy all task thresholds.`,
  );

  let whyCheapestWasNotSelected: string | undefined;

  const cheaperProvider = evaluatedAll.find((p) => p.price < winner.price);
  if (cheaperProvider) {
    if (!cheaperProvider.isQualified) {
      const reason = cheaperProvider.disqualificationReasons?.join("; ") || "failed constraints";
      whyCheapestWasNotSelected = `${cheaperProvider.name} was cheaper at $${cheaperProvider.price.toFixed(3)}, but was rejected because it ${reason.toLowerCase()}.`;
    } else {
      whyCheapestWasNotSelected = `${cheaperProvider.name} was cheaper at $${cheaperProvider.price.toFixed(3)}, but scored lower overall (${cheaperProvider.totalScore} vs ${winner.totalScore}) due to lower quality/reliability.`;
    }
  }

  return {
    status: "SUCCESS",
    request,
    selectedProvider: winner,
    rankedProviders: qualified,
    rejectedProviders: rejected,
    estimatedComparableCost,
    selectedCost,
    estimatedSavings,
    comparisonProvider,
    decisionReasons,
    whyCheapestWasNotSelected,
  };
}
