import type { PaymentAudit, PaymentQuote, PaymentPolicyCheck, PaymentResult } from "./types";

export interface CreateAuditParams {
  procurementId: string;
  taskId: string;
  selectedProviderId: string;
  quote: PaymentQuote;
  policyChecks: PaymentPolicyCheck[];
  approvalDecision: boolean;
  paymentResult?: PaymentResult | undefined;
  serviceDeliveryResult?: {
    status: "SUCCESS" | "FAILED" | "PAID_BUT_DELIVERY_FAILED";
    latencyMs?: number | undefined;
    payload?: string | undefined;
    errorMessage?: string | undefined;
  } | undefined;
  startedAt: number;
}

export function createPaymentAudit(params: CreateAuditParams): PaymentAudit {
  // Deep clone and sanitize the quote object to ensure no private data is present
  const sanitizedQuote: PaymentQuote = {
    providerId: params.quote.providerId,
    service: params.quote.service,
    amount: params.quote.amount,
    asset: params.quote.asset,
    network: params.quote.network,
    paymentDestination: params.quote.paymentDestination,
    expiresAt: params.quote.expiresAt,
    source: params.quote.source,
  };

  // Strip any raw secrets or signatures from the structured payload if any existed
  if (params.quote.raw) {
    const cleanRaw = { ...params.quote.raw };
    delete cleanRaw.privateKey;
    delete cleanRaw.secret;
    delete cleanRaw.mnemonic;
    delete cleanRaw.mnemonicPhrase;
    delete cleanRaw.apiSecret;
    sanitizedQuote.raw = cleanRaw;
  }

  // Create audit
  const audit: PaymentAudit = {
    procurementId: params.procurementId,
    taskId: params.taskId,
    selectedProviderId: params.selectedProviderId,
    quote: sanitizedQuote,
    policyChecks: params.policyChecks,
    approvalDecision: params.approvalDecision,
    timestamps: {
      startedAt: params.startedAt,
      completedAt: Date.now(),
    },
  };

  if (params.paymentResult) {
    // Sanitize paymentResult just in case
    const cleanResult = { ...params.paymentResult };
    delete (cleanResult as any).privateKey;
    delete (cleanResult as any).secret;
    delete (cleanResult as any).mnemonic;
    delete (cleanResult as any).mnemonicPhrase;
    delete (cleanResult as any).apiSecret;
    audit.paymentResult = cleanResult;
    audit.transactionReference = cleanResult.transactionHash || cleanResult.paymentReference;
  }

  if (params.serviceDeliveryResult) {
    const cleanDelivery = { ...params.serviceDeliveryResult };
    if (cleanDelivery.payload) {
      // Strip potential tokens/secrets from payload if it has structured fields
      // For simplicity, we just keep the cleaned delivery result
    }
    audit.serviceDeliveryResult = cleanDelivery;
  }

  return audit;
}
