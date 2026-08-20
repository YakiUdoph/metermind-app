import type { ProviderAdapter, ServiceExecutionRequest, ServiceExecutionResult } from "../../domain/execution/types";
import type { ServiceCategory } from "../../domain/planning/types";
import { executeX402Request } from "../payment/simulated-x402-client";
import { isWalletConfigured } from "../payment/wallet";

export const PAID_RESEARCH_PROVIDER_ID = "paidresearchapi";
export const PAID_RESEARCH_MERCHANT_ADDRESS = "sim_merchant_paidresearchapi";

export interface MockRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Local HTTP-level merchant router that simulates the x402 Payment Challenge server side.
 */
export async function handlePaidResearchRequest(req: MockRequest): Promise<MockResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const bodyData = JSON.parse(req.body || "{}");
  const signatureHeader = req.headers["payment-signature"] || req.headers["PAYMENT-SIGNATURE"];

  let isFailureTrigger = bodyData.service === "paid_research_fail" || req.body?.includes("fail");
  if (signatureHeader) {
    try {
      const decoded = Buffer.from(signatureHeader, "base64").toString("utf-8");
      const sigData = JSON.parse(decoded);
      if (sigData.idempotencyKey?.includes("fail") || sigData.idempotencyKey?.includes("mock-21") || sigData.idempotencyKey?.includes("-21")) {
        isFailureTrigger = true;
      }
    } catch {}
  }

  if (!signatureHeader) {
    // 1. Initial request: Challenge the client with HTTP 402 Payment Required
    const challenge = {
      providerId: PAID_RESEARCH_PROVIDER_ID,
      service: bodyData.service || "paid_research",
      price: "0.01",
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: PAID_RESEARCH_MERCHANT_ADDRESS,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    };

    headers["PAYMENT-REQUIRED"] = Buffer.from(JSON.stringify(challenge)).toString("base64");

    return {
      status: 402,
      headers,
      body: JSON.stringify({ error: "Payment required", challenge })
    };
  }

  // 2. Client retried with payment proof: Decode and verify signature
  let sigData: any;
  try {
    const decoded = Buffer.from(signatureHeader, "base64").toString("utf-8");
    sigData = JSON.parse(decoded);
  } catch (error: any) {
    return {
      status: 400,
      headers,
      body: JSON.stringify({ error: "Malformed payment signature header" })
    };
  }

  // Validation checks on the merchant side
  if (!sigData.signature || sigData.signature.trim().length === 0) {
    return {
      status: 402, // Ask to repay if signature missing
      headers,
      body: JSON.stringify({ error: "Signature missing" })
    };
  }

  if (sigData.amount !== 0.01 || sigData.asset !== "USDC" || sigData.network !== "GOAT-Testnet") {
    return {
      status: 400,
      headers,
      body: JSON.stringify({ error: "Invalid payment amount, asset, or network" })
    };
  }

  if (sigData.paymentDestination.toLowerCase() !== PAID_RESEARCH_MERCHANT_ADDRESS.toLowerCase()) {
    return {
      status: 400,
      headers,
      body: JSON.stringify({ error: "Incorrect merchant payment destination" })
    };
  }

  // Set the settlement success headers
  const receipt = {
    status: "SUCCESS",
    transactionHash: sigData.transactionHash || "sim_tx_mock",
    paymentReference: sigData.paymentReference || "sim_ref_mock",
    settledAt: Date.now()
  };

  headers["PAYMENT-RESPONSE"] = Buffer.from(JSON.stringify(receipt)).toString("base64");

  if (isFailureTrigger) {
    // Deliver delivery-failed payload for testing PAID_BUT_DELIVERY_FAILED
    return {
      status: 200,
      headers,
      body: JSON.stringify({
        payload: "[PAID_BUT_DELIVERY_FAILED] Error: delivery-failed due to simulated service timeout."
      })
    };
  }

  // Deliver premium research content
  return {
    status: 200,
    headers,
    body: JSON.stringify({
      payload: "=== PAID PREMIUM RESEARCH REPORT ===\nTopic: AI Agents and On-Chain micropayments.\nKey Finding: AI agents leveraging HTTP 402 payment handshakes on GOAT Network can dynamically purchase services on-demand in less than 500ms, removing traditional credit-card and session hurdles."
    })
  };
}

/**
 * Adapter implementing the Simulated MeterMind Controlled Research Service execution capability.
 * Classified as: CONTROLLED_DEMO_SERVICE.
 */
export class SimulatedPaidResearchAdapter implements ProviderAdapter {
  readonly providerId = PAID_RESEARCH_PROVIDER_ID;
  readonly providerName = "Simulated MeterMind Controlled Research Service";
  readonly supportedCapabilities: readonly ServiceCategory[] = ["paid_research"];
  readonly executionMode = "demo" as const;

  isAvailable(): boolean {
    return isWalletConfigured();
  }

  async execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult> {
    const startedAt = Date.now();

    // Map local mock request router into fetch-like adapter
    const localFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const mockReq: MockRequest = {
        method: init?.method || "POST",
        headers: (init?.headers as Record<string, string>) || {},
        body: (init?.body as string) || "{}"
      };
      
      const mockRes = await handlePaidResearchRequest(mockReq);
      
      return {
        status: mockRes.status,
        headers: {
          get: (name: string) => mockRes.headers[name] || mockRes.headers[name.toUpperCase()] || null
        },
        json: async () => JSON.parse(mockRes.body),
        text: async () => mockRes.body
      } as any;
    };

    const x402Result = await executeX402Request({
      url: "http://local-paid-research-api/v1/research",
      procurementId: request.procurementId || "mock-proc",
      taskId: request.taskId || "mock-task",
      service: request.service,
      allocatedBudget: request.allocatedBudget,
      idempotencyKey: request.idempotencyKey || `idem-${Date.now()}`,
      provider: {
        id: this.providerId,
        name: this.providerName,
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: PAID_RESEARCH_MERCHANT_ADDRESS,
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: localFetch
    });

    const completedAt = Date.now();

    if (x402Result.status === "PAID_BUT_DELIVERY_FAILED") {
      return {
        status: "PAID_BUT_DELIVERY_FAILED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "demo",
        integrationClassification: "SIMULATED",
        payload: x402Result.payload || "Paid research execution failed during delivery.",
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        allocatedBudget: request.allocatedBudget,
        paymentResult: x402Result.paymentResult,
        paymentAudit: x402Result.audit,
        errorCode: "PAID_BUT_DELIVERY_FAILED",
      };
    }

    if (x402Result.status === "FAILED") {
      return {
        status: "EXECUTION_FAILED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "demo",
        integrationClassification: "SIMULATED",
        payload: "",
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        allocatedBudget: request.allocatedBudget,
        paymentResult: x402Result.paymentResult,
        paymentAudit: x402Result.audit,
        errorCode: x402Result.errorCode || "PAYMENT_REJECTED",
      };
    }

    return {
      status: "SUCCESS",
      service: request.service,
      providerId: this.providerId,
      providerName: this.providerName,
      executionMode: "demo",
      integrationClassification: "SIMULATED",
      payload: x402Result.payload || "",
      startedAt,
      completedAt,
      measuredLatencyMs: completedAt - startedAt,
      allocatedBudget: request.allocatedBudget,
      paymentResult: x402Result.paymentResult,
      paymentAudit: x402Result.audit,
    };
  }
}
