import type { BuyContract } from "./contract";

/** Testnet demo safety policy. This is not a general production spending limit. */
export const LIVE_PAYMENT_POLICY = Object.freeze({
  enabledChainIds: [48816] as const,
  network: "GOAT-Testnet" as const,
  maxSinglePaymentUsdc: 0.1,
  maxAuthorizedLivePurchases: 1,
  requireExplicitAuthorization: true,
  requireFrozenBuyContract: true,
  requireDurableIdempotency: true,
  requireMerchantVerification: true,
  requireBalanceVerification: true,
  requireRecipientMatch: true,
});

export interface LiveMerchantTerms {
  merchantId: string;
  enabled: boolean;
  receiveMode: string;
  receiver: string;
  chainId: number;
  tokenSymbol: string;
  tokenContract: string;
  decimals: number;
  minimumPayment: number;
  quoteTimestamp: string;
  quoteExpiry?: string;
}

export interface ControlledDemoCommercialOffer {
  providerId: string;
  service: "CONTROLLED_DEMO_SERVICE";
  commercialModel: "X402 / GOAT_FLOW";
  amount: number;
  currency: string;
  chainId: number;
  tokenContract: string;
  recipient: string;
  minimumPayment: number;
  minimumPaymentSource: "LIVE_MERCHANT_API";
  amountSource: "LIVE_MERCHANT_REQUIREMENT";
  tokenSource: "LIVE_MERCHANT_CONFIG";
  recipientSource: "LIVE_MERCHANT_CONFIG";
  quoteTimestamp: string;
  quoteExpiry?: string;
}

export function createControlledDemoOffer(terms: LiveMerchantTerms, budget: number): ControlledDemoCommercialOffer {
  if (!terms.enabled) throw new Error("MERCHANT_DISABLED");
  if (!LIVE_PAYMENT_POLICY.enabledChainIds.includes(terms.chainId as 48816)) throw new Error("PAYMENT_NETWORK_NOT_ALLOWED");
  if (budget < terms.minimumPayment) {
    throw new Error(`BUDGET_TOO_LOW_FOR_PROVIDER_MINIMUM: GOAT Flow requires a minimum payment of ${terms.minimumPayment.toFixed(2)} ${terms.tokenSymbol}, but the agent budget is only ${budget.toFixed(2)}.`);
  }
  if (terms.minimumPayment > LIVE_PAYMENT_POLICY.maxSinglePaymentUsdc) throw new Error("MERCHANT_MINIMUM_EXCEEDS_TESTNET_SAFETY_LIMIT");
  return {
    providerId: "paidresearchapi", service: "CONTROLLED_DEMO_SERVICE", commercialModel: "X402 / GOAT_FLOW",
    amount: terms.minimumPayment, currency: terms.tokenSymbol, chainId: terms.chainId,
    tokenContract: terms.tokenContract, recipient: terms.receiver, minimumPayment: terms.minimumPayment,
    minimumPaymentSource: "LIVE_MERCHANT_API", amountSource: "LIVE_MERCHANT_REQUIREMENT",
    tokenSource: "LIVE_MERCHANT_CONFIG", recipientSource: "LIVE_MERCHANT_CONFIG",
    quoteTimestamp: terms.quoteTimestamp, ...(terms.quoteExpiry ? { quoteExpiry: terms.quoteExpiry } : {}),
  };
}

export interface PaymentAuthorizationPreview {
  authorizationScope: "AUTHORIZE ONE TESTNET PURCHASE";
  task: string;
  provider: string;
  service: string;
  amount: number;
  token: string;
  network: string;
  payer: string;
  receiver: string;
  orderId: string;
  buyContractHash: string;
  budget: number;
  safetyCeiling: number;
  merchantVerification: boolean;
  gasReadiness: boolean;
  tokenReadiness: boolean;
  feeReadiness: boolean;
  idempotencyReadiness: boolean;
  paymentSent: false;
}

export function createPaymentAuthorizationPreview(input: Omit<PaymentAuthorizationPreview, "authorizationScope" | "safetyCeiling" | "paymentSent">): PaymentAuthorizationPreview {
  return { ...input, authorizationScope: "AUTHORIZE ONE TESTNET PURCHASE", safetyCeiling: LIVE_PAYMENT_POLICY.maxSinglePaymentUsdc, paymentSent: false };
}

export function validateFrozenContractAgainstOffer(contract: BuyContract, offer: ControlledDemoCommercialOffer, orderId: string, payer: string): boolean {
  return contract.providerId === offer.providerId && contract.quoteId === orderId && contract.actualQuotedAmount === offer.amount &&
    contract.currency.toUpperCase() === offer.currency.toUpperCase() && contract.tokenContractAddress?.toLowerCase() === offer.tokenContract.toLowerCase() &&
    contract.recipient.toLowerCase() === offer.recipient.toLowerCase() && contract.chainId === offer.chainId &&
    contract.payerAddress?.toLowerCase() === payer.toLowerCase() && contract.idempotencyKey.trim().length > 0;
}
