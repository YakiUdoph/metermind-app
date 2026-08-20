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
  "most-reliable": { price: 0.05, quality: 0.1, reliability: 0.8, latency: 0.05 },
  "highest-trust": { price: 0.05, quality: 0.1, reliability: 0.1, latency: 0.05 },
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

  const PRIORITY_MAP: Record<string, ProcurementPriority> = {
    "cheapest": "lowest-cost",
    "cheapest-cost": "lowest-cost",
    "lowest-cost": "lowest-cost",
    "lowest_cost": "lowest-cost",
    "fastest": "fastest",
    "fastest-speed": "fastest",
    "highest-quality": "highest-quality",
    "highest_quality": "highest-quality",
    "most-reliable": "most-reliable",
    "most_reliable": "most-reliable",
    "balanced": "balanced",
    "highest-trust": "highest-trust",
    "highest_trust": "highest-trust"
  };
  const rawPriorityStr = (request.priority || "balanced").toString().toLowerCase().replace(/_/g, "-");
  const priority = PRIORITY_MAP[rawPriorityStr] || "balanced";
  const constraints = request.constraints || {};
  const weights = PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.balanced;

  const excluded = (constraints.excludedProviders || []).map((p) => p.toLowerCase());
  const preferred = (constraints.preferredProviders || []).map((p) => p.toLowerCase());

  const hasLiveProvider = providerCatalog.some((p) => p.mode === "live");

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

    // If a live provider is available, disqualify demo providers
    if (hasLiveProvider && p.mode === "demo") {
      disqualificationReasons.push(
        `Demo provider bypassed because a live provider is available`
      );
    }

    const hasPrice = p.price !== undefined && p.price !== null;

    if (hasPrice && p.price! > request.budget) {
      disqualificationReasons.push(
        `Exceeds maximum task budget ($${p.price!.toFixed(3)} vs $${request.budget.toFixed(2)})`,
      );
    }

    if (hasPrice && constraints.maximumProviderPrice && p.price! > constraints.maximumProviderPrice) {
      disqualificationReasons.push(
        `Exceeds maximum provider price limit ($${p.price!.toFixed(3)} vs $${constraints.maximumProviderPrice.toFixed(3)})`,
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
      priceHistory: p.priceHistory || (hasPrice ? [p.price!] : []),
      qualityHistory: p.qualityHistory || [p.quality],
      priceScore: 0,
      qualityScore: p.quality,
      reliabilityScore: p.reliability,
      latencyScore: 0,
      totalScore: 0,
      isWinner: false,
      isQualified,
      disqualificationReasons: isQualified ? undefined : disqualificationReasons,
      mode: p.mode,
      metricSource: p.metricSource,
    };
  });

  const qualified = evaluatedAll.filter((p) => p.isQualified);
  const rejected = evaluatedAll.filter((p) => !p.isQualified);

  if (qualified.length === 0) {
    const isBudgetExceeded = providerCatalog.every((p) => typeof p.price === "number" && p.price > request.budget);
    return {
      status: isBudgetExceeded ? "BUDGET_TOO_LOW" : "NO_COMPATIBLE_PROVIDERS",
      request,
      selectedProvider: null,
      rankedProviders: [],
      rejectedProviders: rejected,
      estimatedComparableCost: 0,
      selectedCost: undefined,
      estimatedSavings: undefined,
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
  const qualifiedPrices = qualified
    .map((p) => p.price)
    .filter((pr): pr is number => typeof pr === "number");

  const minPrice = qualifiedPrices.length > 0 ? Math.min(...qualifiedPrices) : 0;
  const maxPrice = qualifiedPrices.length > 0 ? Math.max(...qualifiedPrices) : 0;
  const minLatency = Math.min(...qualified.map((p) => p.latency));
  const maxLatency = Math.max(...qualified.map((p) => p.latency));

  qualified.forEach((p) => {
    // Price Score: lowest qualified price receives 100, highest receives 0 (safe equal price fallback: 100)
    if (typeof p.price !== "number") {
      p.priceScore = 100;
    } else {
      p.priceScore =
        maxPrice === minPrice
          ? 100
          : Math.round(((maxPrice - p.price) / (maxPrice - minPrice)) * 100);
    }

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

    const aPrice = typeof a.price === "number" ? a.price : Infinity;
    const bPrice = typeof b.price === "number" ? b.price : Infinity;
    if (aPrice !== bPrice) return aPrice - bPrice;

    if (a.latency !== b.latency) return a.latency - b.latency;
    return (a.id || a.name).localeCompare(b.id || b.name);
  });

  const winner = qualified[0]!;
  winner.isWinner = true;

  // 5. Estimated Savings Baseline (Next-Best Qualified Alternative)
  const alternative = qualified.length > 1 ? qualified[1] : undefined;
  const estimatedComparableCost = alternative && typeof alternative.price === "number"
    ? Number(alternative.price.toFixed(3))
    : (winner && typeof winner.price === "number" ? Number(winner.price.toFixed(3)) : 0);
  const comparisonProvider = alternative ? alternative.name : undefined;
  const selectedCost = typeof winner.price === "number" ? Number(winner.price.toFixed(3)) : undefined;
  const estimatedSavings = alternative && typeof alternative.price === "number" && typeof winner.price === "number"
    ? Number(Math.max(0, alternative.price - winner.price).toFixed(3))
    : (typeof winner.price === "number" ? 0 : undefined);

  // 6. Decision Rationale Generator
  const decisionReasons: string[] = [];

  if (winner.metricSource === "unknown") {
    decisionReasons.push(
      `${winner.name} was selected because it is the only configured live provider for this service category, and historical quality/reliability metrics are not yet observed or comparable.`
    );
  } else {
    decisionReasons.push(
      `${winner.name} achieved the highest weighted score (${winner.totalScore}/100) under your ${priority} priority.`
    );
  }

  if (selectedCost !== undefined) {
    if (alternative && typeof alternative.price === "number") {
      const pctLower = Math.round(((alternative.price - winner.price!) / alternative.price) * 100);
      decisionReasons.push(
        `Priced at $${selectedCost.toFixed(3)}, which is ${pctLower}% cheaper than the next-best qualified alternative (${alternative.name} at $${alternative.price.toFixed(3)}).`
      );
    } else {
      decisionReasons.push(`Delivers optimal value at $${selectedCost.toFixed(3)} per execution.`);
    }
  } else {
    decisionReasons.push(`Price is unknown or not applicable (subscription/free tier) for this live provider.`);
  }

  if (winner.metricSource !== "unknown") {
    decisionReasons.push(
      `Quality score ${winner.quality}/100 and reliability ${winner.reliability}% satisfy all task thresholds.`
    );
  }

  let whyCheapestWasNotSelected: string | undefined;

  const cheaperProvider = evaluatedAll.find((p) => typeof p.price === "number" && typeof winner.price === "number" && p.price < winner.price);
  if (cheaperProvider && typeof winner.price === "number") {
    if (!cheaperProvider.isQualified) {
      const reason = cheaperProvider.disqualificationReasons?.join("; ") || "failed constraints";
      whyCheapestWasNotSelected = `${cheaperProvider.name} was cheaper at $${cheaperProvider.price!.toFixed(3)}, but was rejected because it ${reason.toLowerCase()}.`;
    } else {
      whyCheapestWasNotSelected = `${cheaperProvider.name} was cheaper at $${cheaperProvider.price!.toFixed(3)}, but scored lower overall (${cheaperProvider.totalScore} vs ${winner.totalScore}) due to lower quality/reliability.`;
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

// ---------------------------------------------------------------------------
// Phase 2 Procurement Intelligence Extensions
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { getProviderTrustProfile, TrustDataProvider } from "./trust";
import type {
  ProcurementRequest as CanonicalRequest,
  ProviderOffer,
  EligibilityDecision,
  ProcurementDecisionExplanation,
  DecisionTrace,
  ProviderTrustProfile
} from "./procurement-engine-types";

export const PRIORITY_MAP: Record<string, ProcurementPriority> = {
  "cheapest": "lowest-cost",
  "cheapest-cost": "lowest-cost",
  "lowest-cost": "lowest-cost",
  "lowest_cost": "lowest-cost",
  "fastest": "fastest",
  "fastest-speed": "fastest",
  "highest-quality": "highest-quality",
  "highest_quality": "highest-quality",
  "most-reliable": "most-reliable",
  "most_reliable": "most-reliable",
  "balanced": "balanced",
  "highest-trust": "highest-trust",
  "highest_trust": "highest-trust"
};

export function canonicalizeRequest(
  request: any,
  taskId?: string
): CanonicalRequest {
  const task = request.task || request.rawTask || "";
  const budget = request.budget !== undefined ? request.budget : (request.totalBudget !== undefined ? request.totalBudget : 1.0);
  
  let rawPriority = request.priority || "balanced";
  const rawPriorityStr = rawPriority.toString().toLowerCase().replace(/_/g, "-");
  const priority = PRIORITY_MAP[rawPriorityStr] || "balanced";

  const oldConstraints = request.constraints || {};

  const preferredProviders = request.preferredProviders || oldConstraints.preferredProviders || [];
  const excludedProviders = request.excludedProviders || oldConstraints.excludedProviders || [];
  const maxLatencyMs = request.maxLatencyMs || undefined;
  const minimumQuality = request.minimumQuality !== undefined ? request.minimumQuality : oldConstraints.minimumQuality;
  const minimumReliability = request.minimumReliability !== undefined ? request.minimumReliability : oldConstraints.minimumReliability;
  const freshnessRequirement = request.freshnessRequirement || "any";
  const networkRequirement = request.networkRequirement || undefined;
  const paymentPreference = request.paymentPreference || "any";
  const deliveryCriteria = request.deliveryCriteria || undefined;
  const trustRequirement = request.trustRequirement || oldConstraints.trustRequirement || "ANY";
  const minimumReputation = request.minimumReputation !== undefined ? request.minimumReputation : oldConstraints.minimumReputation;

  return {
    taskId: request.taskId || taskId || `task_${Date.now()}`,
    rawTask: task,
    serviceRequirements: request.serviceRequirements || [],
    budget,
    currency: request.currency || "USD",
    priority,
    preferredProviders,
    excludedProviders,
    maxLatencyMs,
    minimumQuality,
    minimumReliability,
    freshnessRequirement,
    networkRequirement,
    paymentPreference,
    deliveryCriteria,
    trustRequirement,
    minimumReputation
  };
}

export function mapProviderToOffer(
  provider: Provider,
  service: string
): ProviderOffer {
  const paymentProtocol = provider.paymentModel === "x402" ? "x402" : "free";
  const paymentRequired = paymentProtocol === "x402" || (provider.price !== undefined && provider.price > 0);

  const idLower = (provider.id || provider.name).toLowerCase();
  const isLive = provider.mode === "live" || idLower === "coingecko" || idLower === "bitfinex";

  const isObserved = isLive && provider.latency !== undefined;

  // Commercial parameters (Step 8 & 9)
  const commercialModel = provider.paymentModel === "x402"
    ? "X402"
    : (provider.price === 0 || !provider.price ? "FREE" : "PER_CALL");

  const quoteNetwork = isLive ? "GOAT-Testnet" : "Local-Simulated";
  const quoteRecipient = provider.paymentDestination || `0x${idLower}RecipientAddress0000`;

  return {
    providerId: provider.id || provider.name.toLowerCase(),
    service,
    price: provider.price || 0,
    currency: "USD",
    estimatedLatencyMs: provider.latency || 500,
    observedLatencyMs: isObserved ? provider.latency : undefined,
    quality: provider.quality || 90,
    reliability: provider.reliability || 95,
    freshness: isLive ? "live" : "static",
    paymentRequired,
    paymentProtocol,
    network: isLive ? "GOAT-Testnet" : undefined,
    capabilities: provider.capabilities ? [...provider.capabilities] : [service],
    availability: true,
    metricSources: {
      price: provider.mode === "live" ? "PROVIDER_DECLARED" : "CATALOG_FIXTURE",
      latency: isObserved ? "OBSERVED" : "CATALOG_FIXTURE",
      quality: "CATALOG_FIXTURE",
      reliability: "CATALOG_FIXTURE"
    },
    timestamp: new Date().toISOString(),
    ttlMs: 5000,
    // Economic/Commercial fields
    commercialModel,
    quoteAmount: provider.price || 0,
    quoteCurrency: "USD",
    quoteNetwork,
    quoteRecipient,
    quoteTimestamp: new Date().toISOString(),
    quoteExpiresAt: new Date(Date.now() + 5000).toISOString(),
    commercialMetricSource: provider.mode === "live" ? "PROVIDER_DECLARED" : "CATALOG_FIXTURE"
  };
}

export function evaluateEligibility(
  offer: ProviderOffer,
  request: CanonicalRequest,
  trustProfile?: ProviderTrustProfile
): EligibilityDecision {
  const reasons: string[] = [];
  const failedConstraints: string[] = [];

  const providerId = offer.providerId.toLowerCase();
  
  const excluded = (request.excludedProviders || []).map(p => p.toLowerCase());
  if (excluded.includes(providerId)) {
    reasons.push("Excluded by user policy");
    failedConstraints.push("excludedProviders");
  }

  if (offer.price > request.budget) {
    reasons.push(`Price exceeds budget ($${offer.price} vs $${request.budget})`);
    failedConstraints.push("budget");
  }

  if (request.maxLatencyMs !== undefined && offer.estimatedLatencyMs > request.maxLatencyMs) {
    reasons.push(`Latency exceeds safety limit (${offer.estimatedLatencyMs}ms vs ${request.maxLatencyMs}ms)`);
    failedConstraints.push("maxLatencyMs");
  }

  if (request.minimumQuality !== undefined && offer.quality < request.minimumQuality) {
    reasons.push(`Quality score ${offer.quality} is below requirement of ${request.minimumQuality}`);
    failedConstraints.push("minimumQuality");
  }

  if (request.minimumReliability !== undefined && offer.reliability < request.minimumReliability) {
    reasons.push(`Reliability ${offer.reliability}% is below requirement of ${request.minimumReliability}%`);
    failedConstraints.push("minimumReliability");
  }

  if (request.networkRequirement !== undefined && offer.network !== undefined) {
    if (offer.network.toLowerCase() !== request.networkRequirement.toLowerCase()) {
      reasons.push(`Network mismatch: requested ${request.networkRequirement}, provider runs on ${offer.network}`);
      failedConstraints.push("networkRequirement");
    }
  }

  if (request.paymentPreference === "free-only" && offer.paymentRequired) {
    reasons.push("Free service required, but this provider requires payment");
    failedConstraints.push("paymentPreference");
  }

  if (request.freshnessRequirement === "live" && offer.freshness !== "live") {
    reasons.push("Real-time/live data required, but this provider offers static/cached data");
    failedConstraints.push("freshnessRequirement");
  }

  // Trust hard constraints (Step 3 & 12)
  const finalTrustProfile = trustProfile || getProviderTrustProfile(offer.providerId);
  if (request.trustRequirement === "VERIFIED_ONLY" && finalTrustProfile.identity.status !== "VERIFIED") {
    reasons.push(`Provider identity is not verified (${finalTrustProfile.identity.status})`);
    failedConstraints.push("trustRequirement");
  }

  if (request.trustRequirement === "MINIMUM_REPUTATION" && request.minimumReputation !== undefined) {
    if (finalTrustProfile.reputation.status !== "AVAILABLE" || finalTrustProfile.reputation.score === undefined || finalTrustProfile.reputation.score < request.minimumReputation) {
      const currentScore = finalTrustProfile.reputation.score !== undefined ? `${finalTrustProfile.reputation.score}` : "unavailable";
      reasons.push(`Reputation score ${currentScore} is below requirement of ${request.minimumReputation}`);
      failedConstraints.push("minimumReputation");
    }
  }

  return {
    providerId: offer.providerId,
    eligible: reasons.length === 0,
    reasons,
    failedConstraints
  };
}

export function computeParetoFrontier(
  offers: ProviderOffer[]
): { providerId: string; paretoOptimal: boolean; dominatedBy: string[] }[] {
  return offers.map((a) => {
    const dominatedBy: string[] = [];
    
    for (const b of offers) {
      if (a.providerId === b.providerId) continue;
      
      const noWorse =
        b.price <= a.price &&
        b.estimatedLatencyMs <= a.estimatedLatencyMs &&
        b.quality >= a.quality &&
        b.reliability >= a.reliability;
        
      const strictlyBetter =
        b.price < a.price ||
        b.estimatedLatencyMs < a.estimatedLatencyMs ||
        b.quality > a.quality ||
        b.reliability > a.reliability;
        
      if (noWorse && strictlyBetter) {
        dominatedBy.push(b.providerId);
      }
    }
    
    return {
      providerId: a.providerId,
      paretoOptimal: dominatedBy.length === 0,
      dominatedBy
    };
  });
}

export function generateDecisionExplanation(
  winner: ProviderOffer,
  runnerUp: ProviderOffer | undefined,
  eligibleOffers: ProviderOffer[],
  rejectedOffers: { offer: ProviderOffer; reasons: string[] }[],
  priority: ProcurementPriority,
  paretoSet: string[],
  trustProfile?: ProviderTrustProfile
): ProcurementDecisionExplanation {
  const eligibleIds = eligibleOffers.map(o => o.providerId);
  const rejectedIds = rejectedOffers.map(o => o.offer.providerId);
  
  const importantMetrics = {
    price: winner.price,
    latency: winner.observedLatencyMs || winner.estimatedLatencyMs,
    quality: winner.quality,
    reliability: winner.reliability
  };

  const tradeOffs: string[] = [];
  let winnerVsRunnerUpExplanation = "";
  
  const confidenceLimitations: string[] = [];
  if (winner.metricSources.price === "CATALOG_FIXTURE" || winner.metricSources.latency === "CATALOG_FIXTURE") {
    confidenceLimitations.push("Observed telemetry not available; relying on catalog metrics.");
  }
  if (winner.metricSources.reliability === "CATALOG_FIXTURE") {
    confidenceLimitations.push("Reliability values are catalog fixtures and were therefore not treated as live observations.");
  }
  if (winner.metricSources.quality === "CATALOG_FIXTURE") {
    confidenceLimitations.push("Quality values are catalog fixtures and were therefore not treated as live observations.");
  }

  if (runnerUp) {
    const winnerLatency = winner.observedLatencyMs || winner.estimatedLatencyMs;
    const runnerLatency = runnerUp.observedLatencyMs || runnerUp.estimatedLatencyMs;
    
    if (winner.price < runnerUp.price) {
      const diff = runnerUp.price - winner.price;
      tradeOffs.push(`${winner.providerId.toUpperCase()} is cheaper than runner-up ${runnerUp.providerId.toUpperCase()} by $${diff.toFixed(3)}.`);
    } else if (winner.price > runnerUp.price) {
      const diff = winner.price - runnerUp.price;
      tradeOffs.push(`${winner.providerId.toUpperCase()} is more expensive than runner-up ${runnerUp.providerId.toUpperCase()} by $${diff.toFixed(3)}.`);
    }
    
    if (winnerLatency < runnerLatency) {
      const diff = runnerLatency - winnerLatency;
      tradeOffs.push(`${winner.providerId.toUpperCase()} is faster than runner-up ${runnerUp.providerId.toUpperCase()} by ${diff}ms.`);
    } else if (winnerLatency > runnerLatency) {
      const diff = winnerLatency - runnerLatency;
      tradeOffs.push(`${winner.providerId.toUpperCase()} is slower than runner-up ${runnerUp.providerId.toUpperCase()} by ${diff}ms.`);
    }

    if (winner.quality > runnerUp.quality) {
      tradeOffs.push(`${winner.providerId.toUpperCase()} has higher quality than runner-up ${runnerUp.providerId.toUpperCase()} (${winner.quality} vs ${runnerUp.quality}).`);
    } else if (winner.quality < runnerUp.quality) {
      tradeOffs.push(`${winner.providerId.toUpperCase()} has lower quality than runner-up ${runnerUp.providerId.toUpperCase()} (${winner.quality} vs ${runnerUp.quality}).`);
    }

    const isLive = winner.observedLatencyMs !== undefined || runnerUp.observedLatencyMs !== undefined;
    const latencyType = isLive ? "observed response latency" : "estimated latency";
    
    winnerVsRunnerUpExplanation = 
      `${winner.providerId.toUpperCase()} was selected because ${priority.toUpperCase()} was requested. ` +
      `Its ${latencyType} was ${winnerLatency}ms compared with ${runnerUp.providerId.toUpperCase()} at ${runnerLatency}ms. ` +
      `Both providers passed the budget constraint.`;

    if (winner.metricSources.reliability === "CATALOG_FIXTURE") {
      winnerVsRunnerUpExplanation += ` Reliability values are catalog fixtures and were therefore not treated as live observations.`;
    }
  } else {
    winnerVsRunnerUpExplanation = 
      `${winner.providerId.toUpperCase()} was selected because it was the only eligible candidate provider that met all hard constraints.`;
  }

  if (rejectedOffers.length > 0) {
    const rejectionsList = rejectedOffers.map(r => `${r.offer.providerId.toUpperCase()} (${r.reasons.join(", ")})`).join("; ");
    winnerVsRunnerUpExplanation += ` Disqualified candidates: ${rejectionsList}.`;
  }

  const isWinnerParetoOptimal = paretoSet.includes(winner.providerId);

  // Confidence calculations based on Step 5 & Phase 3.1 limitations
  const finalTrustProfile = trustProfile || getProviderTrustProfile(winner.providerId);
  const priceSrc = winner.metricSources.price;
  const latencySrc = winner.metricSources.latency;
  const isLivePrice = priceSrc === "PROVIDER_DECLARED" || priceSrc === "OBSERVED";
  const isObservedLatency = latencySrc === "OBSERVED";
  const isVerifiedTrust = finalTrustProfile.identity.status === "VERIFIED" && finalTrustProfile.reputation.status === "AVAILABLE";
  const isQualityFixture = winner.metricSources.quality === "CATALOG_FIXTURE";
  const isReliabilityFixture = winner.metricSources.reliability === "CATALOG_FIXTURE";
  const evidenceCoverage = {
    live: [
      ...(isLivePrice ? ["price"] : []),
      ...(isObservedLatency ? ["latency"] : []),
      ...(finalTrustProfile.identity.provenance === "ERC8004_ONCHAIN" ? ["erc8004Identity"] : []),
      ...(finalTrustProfile.reputation.provenance === "ERC8004_ONCHAIN" ? ["erc8004Reputation"] : []),
    ],
    fixture: [
      ...(isQualityFixture ? ["quality"] : []),
      ...(isReliabilityFixture ? ["reliability"] : []),
      ...(finalTrustProfile.identity.provenance === "TEST_FIXTURE" ? ["trust"] : []),
    ],
    unknown: [
      ...(!isObservedLatency && latencySrc === "UNKNOWN" ? ["latency"] : []),
      ...(finalTrustProfile.reputation.status !== "AVAILABLE" ? ["reputationScore"] : []),
    ],
  };

  let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let confidenceRationale = "Decision based primarily on static catalog fixtures, with no live telemetry or verified reputation evidence.";

  if (isLivePrice && isObservedLatency && isVerifiedTrust && !isQualityFixture && !isReliabilityFixture) {
    confidence = "HIGH";
    confidenceRationale = "Selected provider features live pricing, observed response latency, and verified on-chain trust profile.";
  } else if (isObservedLatency) {
    confidence = "MEDIUM";
    confidenceRationale = isVerifiedTrust
      ? "Selected provider features observed response latency and a verified trust profile, but quality or reliability still relies on static catalog fixtures."
      : "Selected provider features observed response latency, but relies on declared/fixture pricing, uses static quality/reliability fixtures, and lacks verified on-chain reputation.";
  }

  return {
    selectedProviderId: winner.providerId,
    eligibleCandidates: eligibleIds,
    rejectedCandidates: rejectedIds,
    priority,
    importantMetrics,
    tradeOffs,
    winnerVsRunnerUpExplanation,
    isParetoOptimal: isWinnerParetoOptimal,
    confidenceLimitations,
    confidence,
    confidenceRationale,
    evidenceCoverage
  };
}

export async function runProcurement(
  rawRequest: any,
  providerCatalog: Provider[],
  service: string,
  trustProvider?: TrustDataProvider
): Promise<DecisionTrace> {
  const request = canonicalizeRequest(rawRequest);
  
  const offers = providerCatalog
    .filter((p) => Array.isArray(p.capabilities) && (p.capabilities as string[]).includes(service))
    .map((p) => mapProviderToOffer(p, service));

  // Resolve trust profiles in parallel
  const trustProfiles: Record<string, ProviderTrustProfile> = {};
  if (trustProvider) {
    await Promise.all(
      offers.map(async (offer) => {
        const profile = await trustProvider.getIdentity(offer.providerId);
        trustProfiles[offer.providerId] = profile;
      })
    );
  }
    
  const eligibilityDecisions: Record<string, EligibilityDecision> = {};
  const eligibleOffers: ProviderOffer[] = [];
  const rejectedOffers: { offer: ProviderOffer; reasons: string[] }[] = [];

  const hasLive = offers.some(o => o.network === "GOAT-Testnet");

  for (const offer of offers) {
    const trustProfile = trustProfiles[offer.providerId];
    const decision = evaluateEligibility(offer, request, trustProfile);
    
    if (hasLive && offer.network !== "GOAT-Testnet") {
      decision.eligible = false;
      decision.reasons.push("Demo provider bypassed because a live provider is available");
      decision.failedConstraints.push("liveProviderAvailability");
    }

    eligibilityDecisions[offer.providerId] = decision;
    if (decision.eligible) {
      eligibleOffers.push(offer);
    } else {
      rejectedOffers.push({ offer, reasons: decision.reasons });
    }
  }

  if (eligibleOffers.length === 0) {
    const traceId = `tr_${crypto.randomBytes(8).toString("hex")}`;
    return {
      traceId,
      request,
      discoveredCandidates: offers,
      eligibilityDecisions,
      normalizedMetrics: {},
      scores: {},
      paretoSet: [],
      winner: "",
      explanation: {
        selectedProviderId: "",
        eligibleCandidates: [],
        rejectedCandidates: rejectedOffers.map(o => o.offer.providerId),
        priority: request.priority,
        importantMetrics: { price: 0, latency: 0, quality: 0, reliability: 0 },
        tradeOffs: [],
        winnerVsRunnerUpExplanation: "No eligible providers satisfied task constraints.",
        isParetoOptimal: false,
        confidenceLimitations: []
      },
      timestamp: new Date().toISOString(),
      trustProfiles
    };
  }

  const prices = eligibleOffers.map(o => o.price);
  const latencies = eligibleOffers.map(o => o.observedLatencyMs || o.estimatedLatencyMs);
  
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  const weights = PRIORITY_WEIGHTS[request.priority] || PRIORITY_WEIGHTS.balanced;

  const normalizedMetrics: Record<string, { priceScore: number; latencyScore: number; qualityScore: number; reliabilityScore: number }> = {};
  const scores: Record<string, number> = {};

  eligibleOffers.forEach((o) => {
    const priceScore = maxPrice === minPrice ? 100 : Math.round(((maxPrice - o.price) / (maxPrice - minPrice)) * 100);
    const latencyVal = o.observedLatencyMs || o.estimatedLatencyMs;
    const latencyScore = maxLatency === minLatency ? 100 : Math.round(((maxLatency - latencyVal) / (maxLatency - minLatency)) * 100);
    
    normalizedMetrics[o.providerId] = {
      priceScore,
      latencyScore,
      qualityScore: o.quality,
      reliabilityScore: o.reliability
    };

    let baseScore =
      priceScore * weights.price +
      o.quality * weights.quality +
      o.reliability * weights.reliability +
      latencyScore * weights.latency;

    // Apply trust factor depending on priority and trust availability (Step 4)
    const trustProfile = trustProvider
      ? trustProfiles[o.providerId]!
      : getProviderTrustProfile(o.providerId);
    const identityEvidenceScore = trustProfile.identity.status === "VERIFIED" ? 100 : 0;
    let trustScore = identityEvidenceScore;
    if (trustProfile.reputation.status === "AVAILABLE" && trustProfile.reputation.score !== undefined) {
      trustScore = (identityEvidenceScore * 0.4) + (trustProfile.reputation.score * 0.6);
    }

    if (request.priority === "highest-trust") {
      baseScore = (trustScore * 0.7) + (baseScore * 0.3);
    } else if (request.priority === "balanced" && trustProfile.reputation.status === "AVAILABLE") {
      baseScore = (trustScore * 0.15) + (baseScore * 0.85);
    }

    const isPreferred = request.preferredProviders.map(p => p.toLowerCase()).includes(o.providerId.toLowerCase());
    const preferredBonus = isPreferred ? 3 : 0;

    scores[o.providerId] = Math.round((baseScore + preferredBonus) * 10) / 10;
  });

  const paretoResults = computeParetoFrontier(eligibleOffers);
  const paretoSet = paretoResults.filter(p => p.paretoOptimal).map(p => p.providerId);

  const sorted = [...eligibleOffers].sort((a, b) => {
    const scoreA = scores[a.providerId] || 0;
    const scoreB = scores[b.providerId] || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    if (b.reliability !== a.reliability) return b.reliability - a.reliability;
    if (b.quality !== a.quality) return b.quality - a.quality;

    if (a.price !== b.price) return a.price - b.price;
    const latA = a.observedLatencyMs || a.estimatedLatencyMs;
    const latB = b.observedLatencyMs || b.estimatedLatencyMs;
    if (latA !== latB) return latA - latB;
    return a.providerId.localeCompare(b.providerId);
  });

  const winner = sorted[0]!;
  const runnerUp = sorted[1];

  const explanation = generateDecisionExplanation(
    winner,
    runnerUp,
    eligibleOffers,
    rejectedOffers,
    request.priority,
    paretoSet,
    trustProfiles[winner.providerId]
  );

  const traceId = `tr_${crypto.randomBytes(8).toString("hex")}`;

  return {
    traceId,
    request,
    discoveredCandidates: offers,
    eligibilityDecisions,
    normalizedMetrics,
    scores,
    paretoSet,
    winner: winner.providerId,
    explanation,
    timestamp: new Date().toISOString(),
    trustProfiles
  };
}
