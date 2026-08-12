import type { Provider } from "@/lib/mock";

export type ProcurementPriority =
  | "lowest-cost"
  | "balanced"
  | "highest-quality"
  | "fastest";

export interface ProcurementConstraints {
  minimumQuality?: number | undefined;
  minimumReliability?: number | undefined;
  maximumProviderPrice?: number | undefined;
  preferredProviders?: string[] | undefined;
  excludedProviders?: string[] | undefined;
}

export interface ProcurementRequest {
  task: string;
  budget: number;
  priority: ProcurementPriority;
  constraints?: ProcurementConstraints | undefined;
}

export interface EvaluatedProvider extends Provider {
  priceScore: number;
  qualityScore: number;
  reliabilityScore: number;
  latencyScore: number;
  totalScore: number;
  isWinner: boolean;
  isQualified: boolean;
  disqualificationReasons?: string[] | undefined;
}

export type ProcurementStatusResult =
  | "SUCCESS"
  | "NO_COMPATIBLE_PROVIDERS"
  | "BUDGET_TOO_LOW"
  | "INVALID_REQUEST";

export interface ProcurementResult {
  status: ProcurementStatusResult;
  request: ProcurementRequest;
  selectedProvider: EvaluatedProvider | null;
  rankedProviders: EvaluatedProvider[];
  rejectedProviders: EvaluatedProvider[];
  estimatedComparableCost: number;
  selectedCost: number;
  estimatedSavings: number;
  comparisonProvider?: string | undefined;
  decisionReasons: string[];
  whyCheapestWasNotSelected?: string | undefined;
  errorMessage?: string | undefined;
}
