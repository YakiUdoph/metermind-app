export type PaymentStatus =
  | "CREATED"
  | "POLICY_APPROVED"
  | "PAYMENT_PENDING"
  | "SETTLED"
  | "FAILED"
  | "DELIVERED";

export interface PaymentQuote {
  providerId: string;
  service: string;
  amount: number;
  asset: string;
  network: string;
  paymentDestination: string;
  expiresAt?: string | undefined;
  source: string;
  raw?: any | undefined; // Raw challenge metadata stored only server-side
}

export interface PaymentRequest {
  procurementId: string;
  taskId: string;
  service: string;
  selectedProviderId: string;
  allocatedBudget: number;
  quote: PaymentQuote;
  idempotencyKey: string;
}

export interface PaymentResult {
  status: "SUCCESS" | "FAILED";
  providerId: string;
  amount: number;
  asset: string;
  network: string;
  transactionHash?: string;
  paymentReference?: string;
  startedAt: number;
  completedAt: number;
  settlementStatus: "PENDING" | "SETTLED" | "FAILED" | "UNKNOWN";
  executionLinked: boolean;
  errorCode?: string;
  errorMessageSafe?: string;
}

export interface PaymentPolicyCheck {
  rule: string;
  passed: boolean;
  message: string;
}

export interface PaymentAudit {
  procurementId: string;
  taskId: string;
  selectedProviderId: string;
  quote: PaymentQuote;
  policyChecks: PaymentPolicyCheck[];
  approvalDecision: boolean;
  paymentResult?: PaymentResult | undefined;
  transactionReference?: string | undefined;
  serviceDeliveryResult?: {
    status: "SUCCESS" | "FAILED" | "PAID_BUT_DELIVERY_FAILED";
    latencyMs?: number | undefined;
    payload?: string | undefined;
    errorMessage?: string | undefined;
  } | undefined;
  timestamps: {
    startedAt: number;
    completedAt?: number | undefined;
  };
}
