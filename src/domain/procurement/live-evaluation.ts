/**
 * MeterMind Procurement Domain — Live Provider Session Evaluation (Milestone #5)
 *
 * Implements provider-agnostic, runtime ranking of live service execution attempts
 * based on in-memory session observations, user priorities, and policy constraints.
 */

import type { ProcurementPriority, ProcurementConstraints } from "./types";

export interface LiveObservation {
  providerId: string;
  providerName: string;
  capability: string;
  startedAt: number;
  completedAt: number;
  latencyMs: number;
  success: boolean;
  httpStatus: number;
  dataValid: boolean;
  freshness: string | null; // e.g. fetchedAt timestamp from data source
  errorCode: string | null;
  payload: string | null;
  structuredPayload: any;
}

export interface LiveEvaluationResult {
  winner: LiveObservation | null;
  rankedObservations: LiveObservation[];
  disqualifiedObservations: { observation: LiveObservation; reason: string }[];
  quoteDifferencePercent: number | null;
  hasQuoteDisagreement: boolean;
  explanation: string;
}

/**
 * Calculates the percentage difference between two crypto quotes.
 * differencePercent = |priceA - priceB| / min(priceA, priceB)
 */
export function calculateQuoteDifference(priceA: number, priceB: number): number {
  if (priceA <= 0 || priceB <= 0) return 0;
  return Math.abs(priceA - priceB) / Math.min(priceA, priceB);
}

/**
 * Ranks live provider observations according to session observations,
 * priority rules, and user policy constraints.
 *
 * Generic selection engine: does not contain any provider-specific hardcodings.
 */
export function evaluateLiveObservations(
  observations: LiveObservation[],
  priority: ProcurementPriority,
  constraints?: ProcurementConstraints,
  quoteDisagreementThreshold = 0.05, // 5% threshold
): LiveEvaluationResult {
  const excluded = (constraints?.excludedProviders || []).map((p) => p.toLowerCase());
  const preferred = (constraints?.preferredProviders || []).map((p) => p.toLowerCase());

  const disqualifiedObservations: { observation: LiveObservation; reason: string }[] = [];
  const qualifiedObservations: { observation: LiveObservation; effectiveScore: number }[] = [];

  // 1. Filter and identify qualified candidates
  for (const obs of observations) {
    const providerIdLower = obs.providerId.toLowerCase();
    const providerNameLower = obs.providerName.toLowerCase();

    // Check exclusion constraint
    const isExcluded =
      excluded.includes(providerIdLower) || excluded.includes(providerNameLower);
    if (isExcluded) {
      disqualifiedObservations.push({
        observation: obs,
        reason: "Excluded by user policy constraints.",
      });
      continue;
    }

    // Check availability and validity
    if (!obs.success) {
      disqualifiedObservations.push({
        observation: obs,
        reason: `Provider execution failed: ${obs.errorCode ?? "unknown error"}.`,
      });
      continue;
    }

    if (!obs.dataValid) {
      disqualifiedObservations.push({
        observation: obs,
        reason: "Provider returned malformed or incomplete data.",
      });
      continue;
    }

    // Candidate is qualified! Let's calculate its ranking score.
    // Observed latency must always remain the actual measured latency (unmodified).
    // Bounded preference bonus: preferred providers get a 50ms virtual ranking bonus.
    const isPreferred =
      preferred.includes(providerIdLower) || preferred.includes(providerNameLower);
    const preferenceBonusMs = isPreferred ? 50 : 0;
    const rankingScore = obs.latencyMs - preferenceBonusMs;

    qualifiedObservations.push({
      observation: obs,
      effectiveScore: rankingScore, // rankingScore is used to rank, actual latency remains unmodified
    });
  }

  // 2. Perform quote consistency check (Step 8)
  let quoteDifferencePercent: number | null = null;
  let hasQuoteDisagreement = false;

  // We only compare quotes if we have at least two successful, valid observations
  const successfulValid = observations.filter((o) => o.success && o.dataValid);
  if (successfulValid.length >= 2) {
    // Extract BTC prices for comparison (if available)
    const getBtcPrice = (obs: LiveObservation): number | null => {
      const assets = obs.structuredPayload?.assets;
      if (!Array.isArray(assets)) return null;
      const btcAsset = assets.find((a: any) => a.assetId === "bitcoin" || a.symbol === "BTC");
      return btcAsset ? btcAsset.price : null;
    };

    const priceA = getBtcPrice(successfulValid[0]!);
    const priceB = getBtcPrice(successfulValid[1]!);

    if (priceA !== null && priceB !== null && priceA > 0 && priceB > 0) {
      quoteDifferencePercent = calculateQuoteDifference(priceA, priceB);
      if (quoteDifferencePercent > quoteDisagreementThreshold) {
        hasQuoteDisagreement = true;
      }
    }
  }

  // 3. Rank qualified observations (lower effective score = better)
  qualifiedObservations.sort((a, b) => a.effectiveScore - b.effectiveScore);

  const rankedObservations = qualifiedObservations.map((q) => q.observation);
  const winner = rankedObservations[0] ?? null;

  // 4. Generate user explanation (Step 9)
  let explanation = "";
  if (hasQuoteDisagreement) {
    explanation = `Execution halted due to quote disagreement. Prices differed by ${(quoteDifferencePercent! * 100).toFixed(2)}%, exceeding the safety threshold of ${(quoteDisagreementThreshold * 100).toFixed(0)}%.`;
  } else if (!winner) {
    explanation = "No live providers succeeded or returned valid responses.";
  } else if (rankedObservations.length === 1) {
    const singleObs = rankedObservations[0]!;
    const disqualified = disqualifiedObservations.find((d) => d.observation.providerId !== singleObs.providerId);
    if (disqualified) {
      explanation = `${singleObs.providerName} was selected because it succeeded, while ${disqualified.observation.providerName} failed/returned invalid data (${disqualified.reason}).`;
    } else {
      explanation = `${singleObs.providerName} was selected as it was the only live provider available for execution.`;
    }
  } else {
    // Multi-candidate competition explanation
    const best = rankedObservations[0]!;
    const second = rankedObservations[1]!;
    
    const isBestPreferred = preferred.includes(best.providerId.toLowerCase()) || preferred.includes(best.providerName.toLowerCase());
    const isSecondPreferred = preferred.includes(second.providerId.toLowerCase()) || preferred.includes(second.providerName.toLowerCase());

    const latencyDiffPercent = Math.round(
      (Math.abs(best.latencyMs - second.latencyMs) / Math.max(best.latencyMs, second.latencyMs)) * 100
    );

    if (isBestPreferred && !isSecondPreferred && best.latencyMs > second.latencyMs) {
      explanation = `${best.providerName} and ${second.providerName} both returned valid complete BTC/ETH quotes. ${best.providerName} was selected due to user policy preference (applying a 50ms bonus to preferred providers), overriding ${second.providerName} which responded in ${second.latencyMs}ms versus ${best.providerName} at ${best.latencyMs}ms in this session.`;
    } else {
      explanation = `${best.providerName} and ${second.providerName} both returned valid complete BTC/ETH quotes. ${best.providerName} was selected because it responded in ${best.latencyMs}ms versus ${second.providerName} at ${second.latencyMs}ms in this session.`;
    }

    if (priority === "highest-quality") {
      explanation += " (Note: priority was mapped to session observations as historical metrics are unknown for these live providers).";
    }
  }

  return {
    winner,
    rankedObservations,
    disqualifiedObservations,
    quoteDifferencePercent,
    hasQuoteDisagreement,
    explanation,
  };
}
