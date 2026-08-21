import type { ProviderAdapter, ServiceExecutionRequest, ServiceExecutionResult } from "../../domain/execution/types";
import type { ServiceCategory } from "../../domain/planning/types";
import { executeGoatPayment } from "../payment/goat-client";
import { getWalletConfig, isWalletConfigured } from "../payment/wallet";
import { LIVE_PAYMENT_POLICY } from "../../domain/payment/live-payment-policy";

export const PAID_RESEARCH_PROVIDER_ID = "paidresearchapi";
export const PAID_RESEARCH_MERCHANT_ADDRESS = "NOT_CONFIGURED";

export function getPaidResearchMerchantAddress(): string {
  return process.env["GOAT_MERCHANT_RECEIVER"]?.trim() || "";
}

/**
 * Adapter implementing the official MeterMind Controlled Research Service execution capability on GOAT Testnet3.
 * Classified as: CONTROLLED_DEMO_SERVICE.
 */
export class PaidResearchAdapter implements ProviderAdapter {
  readonly providerId = PAID_RESEARCH_PROVIDER_ID;
  readonly providerName = "MeterMind Controlled Research Service";
  readonly supportedCapabilities: readonly ServiceCategory[] = ["paid_research"];
  readonly executionMode = "live" as const;

  isAvailable(): boolean {
    return isWalletConfigured() && getPaidResearchMerchantAddress().length > 0;
  }

  async execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult> {
    const startedAt = Date.now();

    const result = await executeGoatPayment({
      url: "https://api.paid-research.internal/v1/research", // Conceptually the merchant URL
      procurementId: request.procurementId || "mock-proc",
      taskId: request.taskId || "mock-task",
      service: request.service,
      allocatedBudget: request.allocatedBudget,
      idempotencyKey: request.idempotencyKey || `idem-${Date.now()}`,
      buyContract: request.buyContract,
      selectedProviderId: request.selectedProvider?.id || this.providerId,
      provider: {
        id: this.providerId,
        name: this.providerName,
        mode: "live",
        paymentModel: "x402",
        paymentDestination: getPaidResearchMerchantAddress(),
      },
      policyParams: {
        maxTransactionAmount: getWalletConfig().maxLivePayment,
        allowedAssets: ["USDC"],
        allowedNetworks: [LIVE_PAYMENT_POLICY.network],
        remainingTaskBudget: request.allocatedBudget,
      }
    });

    const completedAt = Date.now();

    if (result.status === "PAID_BUT_DELIVERY_FAILED") {
      return {
        status: "PAID_BUT_DELIVERY_FAILED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        integrationClassification: "REAL",
        payload: result.payload || "Paid research execution failed during delivery.",
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        allocatedBudget: request.allocatedBudget,
        paymentResult: result.paymentResult,
        paymentAudit: result.audit,
        errorCode: "PAID_BUT_DELIVERY_FAILED",
        errorMessage: result.errorMessageSafe || "Paid research execution failed during delivery.",
      };
    }

    if (result.status === "FAILED") {
      return {
        status: "EXECUTION_FAILED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        integrationClassification: "REAL",
        payload: "",
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        allocatedBudget: request.allocatedBudget,
        paymentResult: result.paymentResult,
        paymentAudit: result.audit,
        errorCode: result.errorCode || "PAYMENT_REJECTED",
        errorMessage: result.errorMessageSafe,
      };
    }

    return {
      status: "SUCCESS",
      service: request.service,
      providerId: this.providerId,
      providerName: this.providerName,
      executionMode: "live",
      integrationClassification: "REAL",
      payload: result.payload || "",
      startedAt,
      completedAt,
      measuredLatencyMs: completedAt - startedAt,
      allocatedBudget: request.allocatedBudget,
      paymentResult: result.paymentResult,
      paymentAudit: result.audit,
    };
  }
}
