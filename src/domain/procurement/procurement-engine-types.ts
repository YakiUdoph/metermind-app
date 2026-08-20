import type { ServiceCategory } from "../planning/types";
import type { ProcurementPriority } from "./types";
import type { BuyContract } from "../payment/contract";
import type { DeliveryAcceptanceResult } from "../execution/acceptance";
import type { PaymentAudit } from "../payment/types";

export type MetricSource =
  | "OBSERVED"
  | "PROVIDER_DECLARED"
  | "HISTORICAL"
  | "CATALOG_FIXTURE"
  | "UNKNOWN";

export interface ProcurementRequest {
  taskId: string;
  rawTask: string;
  task?: string | undefined;
  serviceRequirements: ServiceCategory[];
  budget: number;
  currency: string;
  priority: ProcurementPriority;
  preferredProviders: string[];
  excludedProviders: string[];
  maxLatencyMs?: number | undefined;
  minimumQuality?: number | undefined;
  minimumReliability?: number | undefined;
  freshnessRequirement: "live" | "static" | "any";
  networkRequirement?: string | undefined;
  paymentPreference: "free-only" | "paid-allowed" | "any";
  deliveryCriteria?: string | undefined;
  trustRequirement?: "ANY" | "VERIFIED_ONLY" | "MINIMUM_REPUTATION" | undefined;
  minimumReputation?: number | undefined;
}

export interface ProviderOffer {
  providerId: string;
  service: string;
  price: number; // e.g. 0.04
  currency: string; // e.g. "USD"
  estimatedLatencyMs: number;
  observedLatencyMs?: number | undefined;
  quality: number;
  reliability: number;
  freshness: "live" | "static" | "any";
  paymentRequired: boolean;
  paymentProtocol?: "free" | "x402" | "unknown" | undefined;
  network?: string | undefined;
  capabilities: string[];
  availability: boolean;
  metricSources: {
    price: MetricSource;
    latency: MetricSource;
    quality: MetricSource;
    reliability: MetricSource;
  };
  timestamp: string; // ISO string representing when the quote was fetched
  ttlMs?: number | undefined; // e.g. 5000ms
  // Economic Machine-Commerce parameters
  commercialModel?: "FREE" | "PER_CALL" | "SUBSCRIPTION" | "X402" | "UNKNOWN" | undefined;
  quoteAmount?: number | undefined;
  quoteCurrency?: string | undefined;
  quoteNetwork?: string | undefined;
  quoteRecipient?: string | undefined;
  quoteTimestamp?: string | undefined;
  quoteExpiresAt?: string | undefined;
  commercialMetricSource?: "LIVE_QUOTE" | "PROVIDER_DECLARED" | "CATALOG_FIXTURE" | "UNKNOWN" | undefined;
}

export interface EligibilityDecision {
  providerId: string;
  eligible: boolean;
  reasons: string[];
  failedConstraints: string[];
}

export interface ProcurementDecisionExplanation {
  selectedProviderId: string;
  eligibleCandidates: string[];
  rejectedCandidates: string[];
  priority: ProcurementPriority;
  importantMetrics: {
    price: number;
    latency: number;
    quality: number;
    reliability: number;
  };
  tradeOffs: string[];
  winnerVsRunnerUpExplanation: string;
  isParetoOptimal: boolean;
  confidenceLimitations: string[];
  // Trust/Evidence Confidence mapping
  confidence?: "HIGH" | "MEDIUM" | "LOW" | undefined;
  confidenceRationale?: string | undefined;
  evidenceCoverage?: {
    live: string[];
    fixture: string[];
    unknown: string[];
  } | undefined;
}

export interface DecisionTrace {
  traceId: string;
  request: ProcurementRequest;
  discoveredCandidates: ProviderOffer[];
  eligibilityDecisions: Record<string, EligibilityDecision>;
  normalizedMetrics: Record<string, { priceScore: number; latencyScore: number; qualityScore: number; reliabilityScore: number }>;
  scores: Record<string, number>;
  paretoSet: string[];
  winner: string;
  explanation: ProcurementDecisionExplanation;
  timestamp: string;
  buyContractHash?: string | undefined;
  trustProfiles?: Record<string, ProviderTrustProfile> | undefined;
}

export interface ProcurementProof {
  trace: DecisionTrace;
  buyContract?: BuyContract | undefined;
  execution?: {
    status: string;
    payload: string | null;
    errorMessage?: string | undefined;
  } | undefined;
  deliveryAcceptance?: DeliveryAcceptanceResult | undefined;
  payment?: PaymentAudit | undefined;
  evidence: {
    transactionHash?: string | undefined;
    paymentReference?: string | undefined;
    mode: "simulation" | "live";
  };
}

export interface ProcurementBundle {
  bundleId: string;
  taskId: string;
  rawTask: string;
  serviceProcurements: {
    service: ServiceCategory;
    trace: DecisionTrace;
    contract?: BuyContract | undefined;
  }[];
  individualWinners: Record<string, string>; // maps service to winning providerId
  individualCosts: Record<string, number>; // maps service to price/cost
  totalEstimatedCost: number;
  totalActualCost: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
}

export interface ProviderTrustProfile {
  providerId: string;
  identity: {
    status: "VERIFIED" | "UNVERIFIED" | "UNAVAILABLE" | "NOT_CONFIGURED";
    source: "ERC8004" | "PROVIDER_METADATA" | "INTERNAL" | "UNKNOWN";
    provenance?: "ERC8004_ONCHAIN" | "CATALOG_FIXTURE" | "TEST_FIXTURE" | "NOT_CONFIGURED" | "UNAVAILABLE" | undefined;
    agentId?: string;
    registry?: string;
    agentURI?: string;
    wallet?: string;
    metadataTimestamp?: string;
  };
  reputation: {
    status: "AVAILABLE" | "AVAILABLE_WITH_NO_FEEDBACK" | "UNAVAILABLE";
    score?: number;
    count?: number;
    source?: string;
    evidence?: string;
    updatedAt?: string;
    provenance?: "ERC8004_ONCHAIN" | "CATALOG_FIXTURE" | "TEST_FIXTURE" | "NOT_CONFIGURED" | "UNAVAILABLE" | undefined;
  };
}

export interface PreparedReputationFeedback {
  providerId: string;
  procurementId: string;
  deliveryStatus: "ACCEPTED" | "REJECTED" | "FAILED";
  ratingRecommendation: number; // e.g. 1 to 5, or 100
  evidenceHash: string;
  reason: string;
  timestamp: string;
}

export type PaymentState =
  | "PROCUREMENT_CREATED"
  | "CANDIDATES_DISCOVERED"
  | "WINNER_SELECTED"
  | "CONTRACT_FROZEN"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "DELIVERY_PENDING"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "REMEDY_REQUIRED"
  | "FAILED"
  | "UNKNOWN";
