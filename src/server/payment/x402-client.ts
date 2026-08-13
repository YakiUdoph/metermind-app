import { verifyPaymentPolicy, PolicyParams } from "../../domain/payment/policy";
import { createPaymentAudit } from "../../domain/payment/audit";
import { signPaymentChallenge, isWalletConfigured } from "./wallet";
import type { PaymentRequest, PaymentQuote, PaymentResult, PaymentAudit, PaymentStatus } from "../../domain/payment/types";

// In-memory set to store settled payment idempotency keys (prevents double payment)
export const settledPayments = new Set<string>();

export interface X402ExecutionRequest {
  url: string;
  procurementId: string;
  taskId: string;
  service: string;
  allocatedBudget: number;
  idempotencyKey: string;
  provider: {
    id: string;
    name: string;
    mode: "live" | "demo";
    paymentModel?: "free" | "x402";
    paymentDestination?: string;
    isExcluded?: boolean;
  };
  policyParams: {
    maxTransactionAmount: number;
    allowedAssets: string[];
    allowedNetworks: string[];
    remainingTaskBudget: number;
  };
  fetchHandler?: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface X402ExecutionResult {
  status: "SUCCESS" | "FAILED" | "PAID_BUT_DELIVERY_FAILED";
  paymentResult?: PaymentResult | undefined;
  audit: PaymentAudit;
  payload?: string | undefined;
  errorCode?: string | undefined;
  errorMessageSafe?: string | undefined;
}

export async function executeX402Request(
  req: X402ExecutionRequest
): Promise<X402ExecutionResult> {
  const startedAt = Date.now();
  const fetchFn = req.fetchHandler || fetch;

  // 1. Send initial request (which should trigger a 402 challenge)
  let response: Response;
  try {
    response = await fetchFn(req.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": req.idempotencyKey,
      },
      body: JSON.stringify({
        procurementId: req.procurementId,
        taskId: req.taskId,
        service: req.service,
      }),
    });
  } catch (error: any) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "initial-fetch-error"
    };

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "INITIAL_REQUEST", passed: false, message: `Initial connection failed: ${error.message}` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Connection error: ${error.message}` }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: "Could not connect to the merchant provider."
    };
  }

  // 2. Expecting HTTP 402 Payment Required
  if (response.status !== 402) {
    const rawText = await response.text().catch(() => "");
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "non-402-response"
    };

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "HTTP_402_CHALLENGE", passed: false, message: `Server returned status ${response.status} instead of 402.` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Server returned unexpected status ${response.status}: ${rawText}` }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: "X402_CHALLENGE_INVALID",
      errorMessageSafe: `Expected payment challenge, got status ${response.status}.`
    };
  }

  // 3. Parse challenge from PAYMENT-REQUIRED header
  const paymentRequiredHeader = response.headers.get("payment-required") || response.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "missing-header"
    };

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "PAYMENT_REQUIRED_HEADER", passed: false, message: "PAYMENT-REQUIRED header was missing in 402 response." }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Merchant challenge lacked payment-required header." }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: "X402_CHALLENGE_INVALID",
      errorMessageSafe: "Merchant challenge header was missing."
    };
  }

  let challengeData: any;
  try {
    const decoded = Buffer.from(paymentRequiredHeader, "base64").toString("utf-8");
    challengeData = JSON.parse(decoded);
  } catch (error: any) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "malformed-header"
    };

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "HEADER_PARSING", passed: false, message: `Failed to parse base64 header JSON: ${error.message}` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Failed to parse PAYMENT-REQUIRED challenge." }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: "X402_CHALLENGE_INVALID",
      errorMessageSafe: "Malformed x402 payment challenge."
    };
  }

  // Map to structured PaymentQuote
  const quote: PaymentQuote = {
    providerId: challengeData.providerId || req.provider.id,
    service: challengeData.service || req.service,
    amount: parseFloat(challengeData.price),
    asset: challengeData.asset,
    network: challengeData.network,
    paymentDestination: challengeData.paymentDestination,
    expiresAt: challengeData.expiresAt,
    source: "payment-required-header",
    raw: challengeData
  };

  // 4. Verify Payment Policy Guard
  const paymentRequest: PaymentRequest = {
    procurementId: req.procurementId,
    taskId: req.taskId,
    service: req.service,
    selectedProviderId: req.provider.id,
    allocatedBudget: req.allocatedBudget,
    quote,
    idempotencyKey: req.idempotencyKey,
  };

  const policyCheckResult = verifyPaymentPolicy(paymentRequest, {
    provider: req.provider,
    alreadyPaidKeys: settledPayments,
    maxTransactionAmount: req.policyParams.maxTransactionAmount,
    allowedAssets: req.policyParams.allowedAssets,
    allowedNetworks: req.policyParams.allowedNetworks,
    remainingTaskBudget: req.policyParams.remainingTaskBudget,
  });

  if (!policyCheckResult.approved) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Policy guard rejected: ${policyCheckResult.errorMessageSafe}` }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: policyCheckResult.errorCode,
      errorMessageSafe: policyCheckResult.errorMessageSafe
    };
  }

  // 5. Sign the payment challenge
  let signatureInfo: ReturnType<typeof signPaymentChallenge>;
  try {
    signatureInfo = signPaymentChallenge({
      price: quote.amount,
      asset: quote.asset,
      network: quote.network,
      paymentDestination: quote.paymentDestination,
      idempotencyKey: req.idempotencyKey,
    });
  } catch (error: any) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Signing failed: ${error.message}` }
    });

    return {
      status: "FAILED",
      audit,
      errorCode: error.message === "PAYMENT_NOT_CONFIGURED" ? "PAYMENT_NOT_CONFIGURED" : "PAYMENT_SIGNATURE_FAILED",
      errorMessageSafe: error.message === "PAYMENT_NOT_CONFIGURED"
        ? "Wallet/signer is not configured on the server."
        : "Failed to sign payment payload."
    };
  }

  // Construct structured PaymentResult
  const paymentResult: PaymentResult = {
    status: "SUCCESS",
    providerId: req.provider.id,
    amount: quote.amount,
    asset: quote.asset,
    network: quote.network,
    transactionHash: signatureInfo.transactionHash,
    paymentReference: signatureInfo.paymentReference,
    startedAt,
    completedAt: Date.now(),
    settlementStatus: "SETTLED",
    executionLinked: false,
  };

  // 6. Submit signature to retry request
  const signatureHeaderPayload = Buffer.from(
    JSON.stringify({
      signature: signatureInfo.signature,
      transactionHash: signatureInfo.transactionHash,
      paymentReference: signatureInfo.paymentReference,
      amount: quote.amount,
      asset: quote.asset,
      network: quote.network,
      paymentDestination: quote.paymentDestination,
      idempotencyKey: req.idempotencyKey,
    })
  ).toString("base64");

  let retryResponse: Response;
  try {
    retryResponse = await fetchFn(req.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": req.idempotencyKey,
        "PAYMENT-SIGNATURE": signatureHeaderPayload,
      },
      body: JSON.stringify({
        procurementId: req.procurementId,
        taskId: req.taskId,
        service: req.service,
      }),
    });
  } catch (error: any) {
    paymentResult.settlementStatus = "UNKNOWN";
    paymentResult.status = "FAILED";
    paymentResult.errorCode = "PAYMENT_SUBMISSION_FAILED";
    paymentResult.errorMessageSafe = `Payment submission failed: ${error.message}`;

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      paymentResult,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Failed to submit signed payment: ${error.message}` }
    });

    return {
      status: "FAILED",
      paymentResult,
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: "Failed to submit signed payment proof to merchant."
    };
  }

  // 7. Verify response
  if (retryResponse.status !== 200) {
    const rawText = await retryResponse.text().catch(() => "");
    paymentResult.status = "FAILED";
    paymentResult.settlementStatus = "FAILED";
    paymentResult.errorCode = "PAYMENT_REJECTED";
    paymentResult.errorMessageSafe = `Merchant rejected payment: ${rawText}`;

    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      paymentResult,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Merchant returned status ${retryResponse.status}: ${rawText}` }
    });

    return {
      status: "FAILED",
      paymentResult,
      audit,
      errorCode: "PAYMENT_REJECTED",
      errorMessageSafe: "Merchant rejected the transaction signature."
    };
  }

  // Add key to idempotency store to prevent future double payment
  settledPayments.add(req.idempotencyKey);
  paymentResult.executionLinked = true;

  const paymentResponseHeader = retryResponse.headers.get("payment-response") || retryResponse.headers.get("PAYMENT-RESPONSE");
  let responseData: any;
  if (paymentResponseHeader) {
    try {
      const decoded = Buffer.from(paymentResponseHeader, "base64").toString("utf-8");
      responseData = JSON.parse(decoded);
      if (responseData.status === "SUCCESS") {
        paymentResult.settlementStatus = "SETTLED";
      }
    } catch {
      // safe fallback
    }
  }

  // Parse result payload from response
  let servicePayload: string;
  try {
    const bodyObj = await retryResponse.json();
    servicePayload = bodyObj.payload || JSON.stringify(bodyObj);
  } catch {
    servicePayload = "Service completed, but response was not valid JSON.";
  }

  const isDeliverySuccess = servicePayload && !servicePayload.includes("delivery-failed");
  const deliveryStatus = isDeliverySuccess ? "SUCCESS" : "PAID_BUT_DELIVERY_FAILED";

  const audit = createPaymentAudit({
    procurementId: req.procurementId,
    taskId: req.taskId,
    selectedProviderId: req.provider.id,
    quote,
    policyChecks: policyCheckResult.checks,
    approvalDecision: true,
    paymentResult,
    startedAt,
    serviceDeliveryResult: {
      status: deliveryStatus,
      payload: servicePayload,
      errorMessage: isDeliverySuccess ? undefined : "Paid service failed to deliver content payload."
    }
  });

  return {
    status: deliveryStatus,
    paymentResult,
    audit,
    payload: servicePayload
  };
}
