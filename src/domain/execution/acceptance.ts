import type { BuyContract } from "../payment/contract";
import { createHash } from "node:crypto";
import type { PreparedReputationFeedback } from "../procurement/procurement-engine-types";

export type DeliveryAcceptanceStatus =
  | "DELIVERY_PENDING"
  | "DELIVERED"
  | "ACCEPTED"
  | "REJECTED"
  | "REMEDY_REQUIRED";

export interface DeliveryAcceptanceResult {
  status: DeliveryAcceptanceStatus;
  passed: boolean;
  message: string;
  evaluatedAt: string;
}

/**
 * Validates provider output against the Buy Contract criteria (e.g., non-empty, JSON schema, or keyword checks).
 */
export function evaluateDeliveryAcceptance(
  payload: string | null,
  contract: BuyContract,
  paymentConfirmed: boolean,
): DeliveryAcceptanceResult {
  const evaluatedAt = new Date().toISOString();

  // 1. A successful blockchain transaction MUST NOT automatically result in: TASK COMPLETE.
  // The final success state requires both payment confirmed AND delivery accepted.
  if (!paymentConfirmed) {
    return {
      status: "DELIVERY_PENDING",
      passed: false,
      message: "Delivery verification blocked: Payment is not confirmed.",
      evaluatedAt,
    };
  }

  if (payload === null || payload === undefined) {
    return {
      status: "DELIVERY_PENDING",
      passed: false,
      message: "Delivery is pending: No payload received.",
      evaluatedAt,
    };
  }

  const trimmed = payload.trim();
  if (trimmed.length === 0) {
    return {
      status: "REMEDY_REQUIRED",
      passed: false,
      message: "Acceptance rejected: Empty response received.",
      evaluatedAt,
    };
  }

  // 2. Validate expected output schema (e.g. JSON check)
  if (contract.expectedOutputSchema === "json") {
    try {
      JSON.parse(trimmed);
    } catch {
      return {
        status: "REJECTED",
        passed: false,
        message: "Acceptance rejected: Output failed schema validation (not valid JSON).",
        evaluatedAt,
      };
    }
  }

  // 3. Evaluate criteria rules (e.g. "contains:..." or "non-empty")
  if (contract.acceptanceCriteria) {
    const criteria = contract.acceptanceCriteria.toLowerCase();
    
    // Check for "non-empty" explicitly
    if (criteria.includes("non-empty") && trimmed.length === 0) {
      return {
        status: "REMEDY_REQUIRED",
        passed: false,
        message: "Acceptance rejected: Criteria 'non-empty' was not satisfied.",
        evaluatedAt,
      };
    }

    // Check for keyword matches e.g. "contains:btc"
    const keywordMatches = criteria.match(/contains:([a-z0-9_-]+)/);
    if (keywordMatches && keywordMatches[1]) {
      const requiredKeyword = keywordMatches[1];
      if (!trimmed.toLowerCase().includes(requiredKeyword)) {
        return {
          status: "REJECTED",
          passed: false,
          message: `Acceptance rejected: Required keyword '${requiredKeyword}' was not found in response.`,
          evaluatedAt,
        };
      }
    }
  }

  // 4. Verification completed successfully
  return {
    status: "ACCEPTED",
    passed: true,
    message: "Delivery successfully validated and accepted.",
    evaluatedAt,
  };
}

export function prepareReputationFeedback(
  providerId: string,
  procurementId: string,
  acceptance: DeliveryAcceptanceResult | null | undefined,
  evidence: string,
): PreparedReputationFeedback | null {
  if (!acceptance || acceptance.status === "DELIVERY_PENDING" || acceptance.status === "REMEDY_REQUIRED") {
    return null;
  }
  const accepted = acceptance.status === "ACCEPTED" && acceptance.passed;
  return {
    providerId,
    procurementId,
    deliveryStatus: accepted ? "ACCEPTED" : "REJECTED",
    ratingRecommendation: accepted ? 5 : 1,
    evidenceHash: createHash("sha256").update(evidence).digest("hex"),
    reason: acceptance.message,
    timestamp: acceptance.evaluatedAt,
  };
}
