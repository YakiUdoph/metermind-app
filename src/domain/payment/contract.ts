import { createHash } from "node:crypto";

export interface BuyContract {
  contractId: string;
  requirementHash: string;
  service: string;
  providerId: string;
  providerEndpoint: string;
  quoteId: string;
  quoteTimestamp: string;
  quoteExpiry?: string;
  maximumAuthorizedAmount: number;
  actualQuotedAmount: number;
  currency: string;
  network: string;
  recipient: string;
  deliveryDeadline?: string;
  expectedOutputSchema?: string;
  acceptanceCriteria?: string;
  retryPolicy?: string;
  idempotencyKey: string;
  createdAt: string;
  decisionEvidenceHash: string;
  contractHash?: string;
  // Phase 3 Commercial additions
  tokenContractAddress?: string | undefined;
  chainId?: number | undefined;
  payerAddress?: string | undefined;
}

/**
 * Calculates a deterministic SHA-256 hash of all commercial parameters in a Buy Contract.
 */
export function hashBuyContract(contract: Omit<BuyContract, "contractHash">): string {
  const payload = JSON.stringify({
    contractId: contract.contractId,
    requirementHash: contract.requirementHash,
    service: contract.service,
    providerId: contract.providerId,
    providerEndpoint: contract.providerEndpoint,
    quoteId: contract.quoteId,
    quoteTimestamp: contract.quoteTimestamp,
    quoteExpiry: contract.quoteExpiry || "",
    maximumAuthorizedAmount: Number(contract.maximumAuthorizedAmount.toFixed(6)),
    actualQuotedAmount: Number(contract.actualQuotedAmount.toFixed(6)),
    currency: contract.currency.toUpperCase(),
    network: contract.network.toLowerCase(),
    recipient: contract.recipient.toLowerCase(),
    deliveryDeadline: contract.deliveryDeadline || "",
    expectedOutputSchema: contract.expectedOutputSchema || "",
    acceptanceCriteria: contract.acceptanceCriteria || "",
    retryPolicy: contract.retryPolicy || "",
    idempotencyKey: contract.idempotencyKey,
    createdAt: contract.createdAt,
    decisionEvidenceHash: contract.decisionEvidenceHash,
    tokenContractAddress: contract.tokenContractAddress || "",
    chainId: contract.chainId || 0,
    payerAddress: contract.payerAddress || ""
  });

  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Verifies that the internal contractHash of a Buy Contract matches the recalculation of its fields.
 */
export function verifyBuyContract(contract: BuyContract): boolean {
  if (!contract.contractHash) return false;
  const { contractHash, ...rest } = contract;
  const calculated = hashBuyContract(rest);
  return calculated === contractHash;
}

/**
 * Validates that a Buy Contract has not been altered since its initial hashing.
 */
export function verifyBuyContractTampering(contract: BuyContract, originalHash: string): boolean {
  if (!verifyBuyContract(contract)) return false;
  return contract.contractHash === originalHash;
}
