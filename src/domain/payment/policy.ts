import type { PaymentRequest, PaymentPolicyCheck } from "./types";
import { BuyContract, verifyBuyContract } from "./contract";

export interface PolicyParams {
  provider: {
    id: string;
    name: string;
    mode: "live" | "demo";
    paymentModel?: "free" | "x402";
    paymentDestination?: string;
    isExcluded?: boolean;
  };
  alreadyPaidKeys: { has: (key: string) => boolean };
  /** Live execution must set this only when backed by a durable store. */
  idempotencyStoreReady?: boolean;
  maxTransactionAmount: number; // e.g. 0.05
  allowedAssets: string[]; // e.g. ["USDC"]
  allowedNetworks: string[]; // e.g. ["GOAT-Testnet"]
  remainingTaskBudget: number;
}

export function verifyPaymentPolicy(
  request: PaymentRequest & { buyContract?: BuyContract },
  params: PolicyParams,
): {
  approved: boolean;
  checks: PaymentPolicyCheck[];
  errorCode?: string;
  errorMessageSafe?: string;
} {
  const { quote, allocatedBudget, idempotencyKey } = request;
  const {
    provider,
    alreadyPaidKeys,
    maxTransactionAmount,
    allowedAssets,
    allowedNetworks,
    remainingTaskBudget,
    idempotencyStoreReady = true,
  } = params;

  const checks: PaymentPolicyCheck[] = [];

  // Helper to add check
  const addCheck = (rule: string, passed: boolean, message: string) => {
    checks.push({ rule, passed, message });
  };

  // 1. Selected provider is the actual procurement winner
  const isWinner = request.selectedProviderId === quote.providerId && request.selectedProviderId === provider.id;
  addCheck(
    "PROV_WINNER",
    isWinner,
    isWinner
      ? `Selected provider ${quote.providerId} matches procurement winner.`
      : `Provider mismatch: requested ${request.selectedProviderId}, quoted ${quote.providerId}, catalog provider ${provider.id}.`,
  );

  // 2. Provider is marked as paid/x402-capable
  const isX402 = provider.paymentModel === "x402";
  addCheck(
    "PROV_CAPABLE",
    isX402,
    isX402
      ? "Provider is marked as x402-capable."
      : "Provider is not marked as x402-capable.",
  );

  // 3. Quoted amount is known
  const isAmountValid = typeof quote.amount === "number" && quote.amount > 0 && !isNaN(quote.amount);
  addCheck(
    "QUOTE_AMOUNT_VALID",
    isAmountValid,
    isAmountValid
      ? `Quoted amount ${quote.amount} ${quote.asset} is valid.`
      : `Quoted amount ${quote.amount} is invalid.`,
  );

  // 4. Amount <= allocated service budget
  const withinAllocated = isAmountValid && quote.amount <= allocatedBudget;
  addCheck(
    "WITHIN_ALLOCATED_BUDGET",
    withinAllocated,
    withinAllocated
      ? `Quoted amount ${quote.amount} is within allocated budget of ${allocatedBudget}.`
      : `Quoted amount ${quote.amount} exceeds allocated budget of ${allocatedBudget}.`,
  );

  // 5. Amount <= per-transaction maximum
  const withinTxMax = isAmountValid && quote.amount <= maxTransactionAmount;
  addCheck(
    "WITHIN_TX_MAXIMUM",
    withinTxMax,
    withinTxMax
      ? `Quoted amount ${quote.amount} is within transaction safety limit of ${maxTransactionAmount}.`
      : `Quoted amount ${quote.amount} exceeds transaction safety limit of ${maxTransactionAmount}.`,
  );

  // 6. Amount <= remaining task budget
  const withinTaskBudget = isAmountValid && quote.amount <= remainingTaskBudget;
  addCheck(
    "WITHIN_TASK_BUDGET",
    withinTaskBudget,
    withinTaskBudget
      ? `Quoted amount ${quote.amount} is within remaining task budget of ${remainingTaskBudget}.`
      : `Quoted amount ${quote.amount} exceeds remaining task budget of ${remainingTaskBudget}.`,
  );

  // 7. Provider is not excluded
  const isNotExcluded = !provider.isExcluded;
  addCheck(
    "PROVIDER_NOT_EXCLUDED",
    isNotExcluded,
    isNotExcluded
      ? "Provider is not excluded from procurement."
      : "Provider is excluded from procurement.",
  );

  // 8. Payment destination matches selected provider metadata
  const destMatches = provider.paymentDestination && quote.paymentDestination?.toLowerCase() === provider.paymentDestination.toLowerCase();
  addCheck(
    "DESTINATION_MATCH",
    !!destMatches,
    destMatches
      ? `Payment destination matches provider metadata: ${quote.paymentDestination}.`
      : `Destination mismatch: quoted ${quote.paymentDestination}, expected ${provider.paymentDestination}.`,
  );

  // 9. Required asset/network are allowed
  const assetAllowed = allowedAssets.map(a => a.toUpperCase()).includes(quote.asset?.toUpperCase());
  addCheck(
    "ASSET_ALLOWED",
    assetAllowed,
    assetAllowed
      ? `Payment asset ${quote.asset} is allowed.`
      : `Payment asset ${quote.asset} is not allowed. Must be one of: ${allowedAssets.join(", ")}.`,
  );

  const networkAllowed = allowedNetworks.map(n => n.toLowerCase()).includes(quote.network?.toLowerCase());
  addCheck(
    "NETWORK_ALLOWED",
    networkAllowed,
    networkAllowed
      ? `Payment network ${quote.network} is allowed.`
      : `Payment network ${quote.network} is not allowed. Must be one of: ${allowedNetworks.join(", ")}.`,
  );

  // 10. Execution has not already been paid for
  const isNotPaid = !idempotencyKey || !alreadyPaidKeys.has(idempotencyKey);
  addCheck(
    "IDEMPOTENCY_NOT_PAID",
    isNotPaid,
    isNotPaid
      ? "No prior settled payment found for this transaction key."
      : "Duplicate payment detected: this transaction key is already settled.",
  );

  const idempotencyReliable = provider.mode !== "live" || idempotencyStoreReady;
  addCheck(
    "IDEMPOTENCY_STORE_READY",
    idempotencyReliable,
    idempotencyReliable
      ? "Idempotency state is available for this execution mode."
      : "Live payment blocked: durable idempotency state is not configured.",
  );

  // 11. Idempotency key is present
  const hasIdempotency = !!idempotencyKey && idempotencyKey.trim().length > 0;
  addCheck(
    "IDEMPOTENCY_KEY_PRESENT",
    hasIdempotency,
    hasIdempotency
      ? "Idempotency key is present."
      : "Idempotency key is missing.",
  );

  // 12. Task ID and Procurement ID are present
  const idsPresent = !!request.taskId && request.taskId.trim().length > 0 && !!request.procurementId && request.procurementId.trim().length > 0;
  addCheck(
    "IDS_PRESENT",
    idsPresent,
    idsPresent
      ? "taskId and procurementId are present."
      : "Missing taskId or procurementId.",
  );

  // 13. If a Buy Contract is provided, verify it is cryptographically valid and untampered
  let contractValid = true;
  let contractNotTampered = true;

  if (request.buyContract) {
    contractValid = verifyBuyContract(request.buyContract);
    
    // Check if any of the commercial parameters have been tampered with
    const providerMatches = request.buyContract.providerId === request.selectedProviderId;
    const amountMatches = Math.abs(request.buyContract.actualQuotedAmount - request.quote.amount) < 0.000001;
    const currencyMatches = request.buyContract.currency.toUpperCase() === request.quote.asset.toUpperCase();
    const networkMatches = request.buyContract.network.toLowerCase() === request.quote.network.toLowerCase();
    const recipientMatches = request.buyContract.recipient.toLowerCase() === request.quote.paymentDestination.toLowerCase();
    const idempotencyMatches = request.buyContract.idempotencyKey === request.idempotencyKey;
    const quoteIdMatches = !!request.quote.quoteId && request.buyContract.quoteId === request.quote.quoteId;
    const tokenMatches = !!request.quote.tokenContractAddress &&
      request.buyContract.tokenContractAddress?.toLowerCase() === request.quote.tokenContractAddress.toLowerCase();
    const chainMatches = request.quote.chainId !== undefined && request.buyContract.chainId === request.quote.chainId;
    const payerMatches = !!request.quote.payerAddress &&
      request.buyContract.payerAddress?.toLowerCase() === request.quote.payerAddress.toLowerCase();
    
    contractNotTampered = providerMatches && amountMatches && currencyMatches && networkMatches &&
      recipientMatches && idempotencyMatches && quoteIdMatches && tokenMatches && chainMatches && payerMatches;
  }

  addCheck(
    "CONTRACT_VALID",
    contractValid,
    request.buyContract
      ? (contractValid ? "Buy Contract signature is cryptographically valid." : "Buy Contract signature is invalid or corrupted.")
      : "No Buy Contract provided (skipped verification)."
  );

  addCheck(
    "CONTRACT_NOT_TAMPERED",
    contractNotTampered,
    request.buyContract
      ? (contractNotTampered ? "Buy Contract commercial terms match request parameters (untampered)." : "Buy Contract commercial terms have been altered after authorization (tampered).")
      : "No Buy Contract provided (skipped verification)."
  );

  const approved = checks.every((c) => c.passed);

  if (!approved) {
    // Determine specific error code
    let errorCode = "PAYMENT_REJECTED";
    let errorMessageSafe = "Payment policy checks failed.";

    if (!isWinner) {
      errorCode = "PAYMENT_PROVIDER_MISMATCH";
      errorMessageSafe = "Provider mismatch or not winning provider.";
    } else if (!isX402) {
      errorCode = "PAYMENT_ASSET_NOT_ALLOWED"; // Or capability error
      errorMessageSafe = "Provider lacks x402 capability.";
    } else if (!isAmountValid) {
      errorCode = "PAYMENT_QUOTE_INVALID";
      errorMessageSafe = "Payment quote amount is invalid.";
    } else if (!withinAllocated || !withinTaskBudget) {
      errorCode = "PAYMENT_BUDGET_EXCEEDED";
      errorMessageSafe = "Payment exceeds allocated or task budget limit.";
    } else if (!withinTxMax) {
      errorCode = "PAYMENT_BUDGET_EXCEEDED";
      errorMessageSafe = `Payment exceeds safety limit per transaction (${maxTransactionAmount}).`;
    } else if (!isNotExcluded) {
      errorCode = "PAYMENT_PROVIDER_MISMATCH";
      errorMessageSafe = "Selected provider is excluded.";
    } else if (!destMatches) {
      errorCode = "PAYMENT_PROVIDER_MISMATCH";
      errorMessageSafe = "Selected provider destination address mismatch.";
    } else if (!assetAllowed) {
      errorCode = "PAYMENT_ASSET_NOT_ALLOWED";
      errorMessageSafe = `Asset ${quote.asset} is not permitted.`;
    } else if (!networkAllowed) {
      errorCode = "PAYMENT_NETWORK_NOT_ALLOWED";
      errorMessageSafe = `Network ${quote.network} is not permitted.`;
    } else if (!idempotencyReliable) {
      errorCode = "PAYMENT_IDEMPOTENCY_NOT_READY";
      errorMessageSafe = "Live payment blocked because durable idempotency state is unavailable.";
    } else if (!hasIdempotency) {
      errorCode = "PAYMENT_QUOTE_INVALID";
      errorMessageSafe = "Idempotency key is missing.";
    } else if (!isNotPaid) {
      errorCode = "PAYMENT_ALREADY_SETTLED";
      errorMessageSafe = "This transaction has already been paid for and settled.";
    } else if (!idsPresent) {
      errorCode = "PAYMENT_QUOTE_INVALID";
      errorMessageSafe = "Missing taskId or procurementId.";
    } else if (!contractValid) {
      errorCode = "PAYMENT_CONTRACT_INVALID";
      errorMessageSafe = "Buy Contract is invalid or corrupted.";
    } else if (!contractNotTampered) {
      errorCode = "PAYMENT_CONTRACT_TAMPERED";
      errorMessageSafe = "Buy Contract commercial terms have been tampered with.";
    }

    return { approved: false, checks, errorCode, errorMessageSafe };
  }

  return { approved: true, checks };
}
