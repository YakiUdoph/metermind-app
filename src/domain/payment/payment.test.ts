/**
 * MeterMind x402 Paid Execution & Payment Audit Layer — Test Suite
 *
 * 23 deterministic tests covering all specified requirements.
 * Run with: npx tsx --test src/domain/payment/payment.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { verifyPaymentPolicy } from "./policy";
import type { PolicyParams } from "./policy";
import { createPaymentAudit } from "./audit";
import { executeX402Request } from "../../server/payment/x402-client";
import { getWalletConfig } from "../../server/payment/wallet";
import { executePlan } from "../execution/executor";
import { AdapterRegistry } from "../execution/registry";
import { PaidResearchAdapter } from "../../server/providers/paid-research";
import { PAID_RESEARCH_PROVIDER_ENTRY, COINGECKO_PROVIDER_ENTRY, BITFINEX_PROVIDER_ENTRY } from "../../lib/mock";
import type { ProcurementPlan } from "../planning/types";
import type { ServiceExecutionRequest } from "../execution/types";
import type { PaymentRequest } from "./types";

describe("MeterMind Payment & x402 Policy Audit Suite", () => {

  // ---------------------------------------------------------------------------
  // 1-9: verifyPaymentPolicy tests
  // ---------------------------------------------------------------------------

  it("1. verifyPaymentPolicy approves a valid payment quote", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.deepEqual(result.approved, true);
  });

  it("2. verifyPaymentPolicy rejects when provider.id !== destination mismatch", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0xBadRecipientAddress0000000000000000", // Mismatch
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /Destination address mismatch/i);
  });

  it("3. verifyPaymentPolicy rejects when amount exceeds allocated stage budget", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.03, // Exceeds allocatedBudget (0.02)
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /exceeds allocated or task budget limit/i);
  });

  it("4. verifyPaymentPolicy rejects when amount exceeds MAX_LIVE_PAYMENT_USD limit (0.05)", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.10,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.06, // Exceeds 0.05 limit
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /exceeds safety limit/i);
  });

  it("5. verifyPaymentPolicy rejects invalid asset symbol", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDT", // Mismatch
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /Asset USDT is not permitted/);
  });

  it("6. verifyPaymentPolicy rejects invalid network type", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "Ethereum", // Mismatch
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /Network Ethereum is not permitted/);
  });

  it("7. verifyPaymentPolicy rejects double-pay attempt (same idempotency key)", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(["idem-123"]), // Already paid!
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /already been paid/i);
  });

  it("8. verifyPaymentPolicy allows same idempotency key for failed prior attempts", () => {
    const request: PaymentRequest = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(), // Not in settled keys set
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, true);
  });

  it("9. verifyPaymentPolicy requires present taskId and procurementId", () => {
    const request: PaymentRequest = {
      procurementId: "", // Empty
      taskId: "", // Empty
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.02,
      idempotencyKey: "idem-123",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
    };
    const params: PolicyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: new Set<string>(),
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
      remainingTaskBudget: 1.0,
    };
    const result = verifyPaymentPolicy(request, params);
    assert.equal(result.approved, false);
    assert.match(result.errorMessageSafe || "", /Missing taskId or procurementId/);
  });

  // ---------------------------------------------------------------------------
  // 10-11: createPaymentAudit tests
  // ---------------------------------------------------------------------------

  it("10. createPaymentAudit compiles all required metadata fields", () => {
    const quote = {
      price: 0.01,
      asset: "USDC" as const,
      network: "GOAT-Testnet" as const,
      recipientAddress: "0x789C402PaidResearchMerchantAddress0000",
    };
    const req: any = {
      service: "paid_research",
      task: "test task",
      priorContext: null,
      allocatedBudget: 0.02,
      selectedProvider: {
        ...PAID_RESEARCH_PROVIDER_ENTRY,
        score: 98,
      },
      procurementId: "proc-123",
      taskId: "task-123",
      idempotencyKey: "idem-123",
    };
    const auditPolicy = { approved: true };
    const paymentResult: any = {
      settlementStatus: "SETTLED" as const,
      amount: 0.01,
      asset: "USDC" as const,
      network: "GOAT-Testnet" as const,
      transactionHash: "0xabc123",
    };

    const audit = createPaymentAudit({
      procurementId: "proc-123",
      taskId: "task-123",
      selectedProviderId: "paidresearchapi",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
      policyChecks: [{ rule: "Winner Match", passed: true, message: "Provider matches selected recipient" }],
      approvalDecision: true,
      paymentResult,
      serviceDeliveryResult: {
        status: "SUCCESS",
        latencyMs: 150,
        payload: "success payload",
      },
      startedAt: Date.now(),
    });

    assert.equal(audit.procurementId, "proc-123");
    assert.equal(audit.taskId, "task-123");
    assert.equal(audit.selectedProviderId, "paidresearchapi");
    assert.equal(audit.quote.amount, 0.01);
    assert.equal(audit.approvalDecision, true);
    assert.equal(audit.paymentResult!.settlementStatus, "SETTLED");
    assert.equal(audit.paymentResult!.transactionHash, "0xabc123");
    assert.equal(audit.serviceDeliveryResult!.status, "SUCCESS");
    assert.ok(audit.timestamps.startedAt > 0);
  });

  it("11. createPaymentAudit strips sensitive wallet keys / mnemonics / secrets", () => {
    const quote = {
      price: 0.01,
      asset: "USDC" as const,
      network: "GOAT-Testnet" as const,
      recipientAddress: "0x789C402PaidResearchMerchantAddress0000",
    };
    const req: any = {
      service: "paid_research",
      task: "test task",
      priorContext: null,
      allocatedBudget: 0.02,
      selectedProvider: {
        ...PAID_RESEARCH_PROVIDER_ENTRY,
        score: 98,
      },
      procurementId: "proc-123",
      taskId: "task-123",
      idempotencyKey: "idem-123",
    };
    const auditPolicy = { approved: true };
    const paymentResult = {
      settlementStatus: "SETTLED" as const,
      amount: 0.01,
      asset: "USDC" as const,
      network: "GOAT-Testnet" as const,
      transactionHash: "0xabc123",
      // Include dummy secret parameters to simulate pollution
      mnemonic: "secret mnemonic key phrase",
      privateKey: "0xsecretprivatekey",
      apiSecret: "super-secret-api-key",
    } as any;

    const audit = createPaymentAudit({
      procurementId: "proc-123",
      taskId: "task-123",
      selectedProviderId: "paidresearchapi",
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "x402-client",
      },
      policyChecks: [{ rule: "Winner Match", passed: true, message: "Provider matches selected recipient" }],
      approvalDecision: true,
      paymentResult,
      serviceDeliveryResult: {
        status: "SUCCESS",
        latencyMs: 150,
        payload: "success payload",
      },
      startedAt: Date.now(),
    });

    // Verify key fields are present
    assert.equal(audit.paymentResult!.settlementStatus, "SETTLED");

    // Verify sensitive keys are NOT leaked
    const serialized = JSON.stringify(audit);
    assert.ok(!serialized.includes("secret mnemonic"));
    assert.ok(!serialized.includes("0xsecretprivatekey"));
    assert.ok(!serialized.includes("super-secret-api-key"));
  });

  // ---------------------------------------------------------------------------
  // 12-17: executeX402Request tests
  // ---------------------------------------------------------------------------

  it("12. executeX402Request challenge loop mock completes successfully", async () => {
    const { handlePaidResearchRequest } = await import("../../server/providers/paid-research");
    const mockFetchHandler = async (url: string, init?: RequestInit): Promise<Response> => {
      if (url.includes("network-error-endpoint")) {
        throw new Error("Network connection failed");
      }
      if (url.includes("bad-headers-endpoint")) {
        return {
          status: 402,
          headers: { get: () => null },
          text: async () => "Bad headers",
        } as any;
      }
      if (url.includes("bad-settlement-endpoint")) {
        const isRetry = init?.headers && ((init.headers as any)["payment-signature"] || (init.headers as any)["PAYMENT-SIGNATURE"]);
        if (isRetry) {
          return {
            status: 400,
            headers: { get: () => null },
            text: async () => "Invalid signature proof",
          } as any;
        }
        const challenge = {
          providerId: "paidresearchapi",
          service: "paid_research",
          price: "0.01",
          asset: "USDC",
          network: "GOAT-Testnet",
          paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        };
        return {
          status: 402,
          headers: {
            get: () => Buffer.from(JSON.stringify(challenge)).toString("base64"),
          },
          text: async () => JSON.stringify(challenge),
        } as any;
      }

      const mockReq = {
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

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://mock-merchant.internal/paid-research",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-12",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.paymentResult!.settlementStatus, "SETTLED");
    assert.ok(result.paymentResult!.transactionHash!.startsWith("0x"));

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("13. executeX402Request returns payment details on success", async () => {
    const { handlePaidResearchRequest } = await import("../../server/providers/paid-research");
    const mockFetchHandler = async (url: string, init?: RequestInit): Promise<Response> => {
      const mockReq = {
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

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://mock-merchant.internal/paid-research",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-13",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.paymentResult!.amount, 0.01);
    assert.equal(result.paymentResult!.asset, "USDC");
    assert.equal(result.paymentResult!.network, "GOAT-Testnet");

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("14. executeX402Request handles simulated payment mode correctly", async () => {
    const { handlePaidResearchRequest } = await import("../../server/providers/paid-research");
    const mockFetchHandler = async (url: string, init?: RequestInit): Promise<Response> => {
      const mockReq = {
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

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://mock-merchant.internal/paid-research",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-14",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.paymentResult!.settlementStatus, "SETTLED");
    assert.match(result.paymentResult!.transactionHash || "", /^0x_sim_tx_[0-9a-f]+$/);

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("15. executeX402Request fails on network error during challenge submission", async () => {
    const mockFetchHandler = async (url: string): Promise<Response> => {
      throw new Error("Network connection failed");
    };

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://network-error-endpoint.internal",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-15",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.errorCode, "PAYMENT_SUBMISSION_FAILED");
    assert.match(result.errorMessageSafe || "", /Could not connect/);

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("16. executeX402Request throws error on bad/invalid challenge headers", async () => {
    const mockFetchHandler = async (): Promise<Response> => {
      return {
        status: 402,
        headers: { get: () => null },
        text: async () => "Bad headers",
      } as any;
    };

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://bad-headers-endpoint.internal",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-16",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.errorCode, "X402_CHALLENGE_INVALID");
    assert.match(result.errorMessageSafe || "", /Merchant challenge header was missing/);

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("17. executeX402Request fails on invalid settlement transaction proof", async () => {
    const mockFetchHandler = async (url: string, init?: RequestInit): Promise<Response> => {
      const isRetry = init?.headers && ((init.headers as any)["payment-signature"] || (init.headers as any)["PAYMENT-SIGNATURE"]);
      if (isRetry) {
        return {
          status: 400,
          headers: { get: () => null },
          text: async () => "Invalid signature proof",
        } as any;
      }
      const challenge = {
        providerId: "paidresearchapi",
        service: "paid_research",
        price: "0.01",
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      };
      return {
        status: 402,
        headers: {
          get: () => Buffer.from(JSON.stringify(challenge)).toString("base64"),
        },
        text: async () => JSON.stringify(challenge),
      } as any;
    };

    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const result = await executeX402Request({
      url: "http://bad-settlement-endpoint.internal",
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-mock-17",
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live",
        paymentModel: "x402",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      policyParams: {
        maxTransactionAmount: 0.05,
        allowedAssets: ["USDC"],
        allowedNetworks: ["GOAT-Testnet", "GOAT-Mainnet"],
        remainingTaskBudget: 1.0,
      },
      fetchHandler: mockFetchHandler
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.errorCode, "PAYMENT_REJECTED");
    assert.match(result.errorMessageSafe || "", /Merchant rejected/);

  });

  // ---------------------------------------------------------------------------
  // 18-21: executePlan integration tests
  // ---------------------------------------------------------------------------

  it("18. executePlan executes paid research when budget is sufficient", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const plan: any = {
      id: "plan-mock-18",
      intent: {
        category: "paid_research",
        confidence: 0.95,
        matchedKeywords: ["premium", "research"],
      },
      originalTask: "premium research task on AI trends",
      totalBudget: 1.0,
      priority: "balanced",
      serviceRequirements: [
        { service: "paid_research", executionOrder: 1, rationale: "premium source" },
      ],
      serviceResults: [
        {
          service: "paid_research",
          allocatedBudget: 0.05,
          procurementResult: {
            status: "SUCCESS",
            selectedProvider: {
              ...PAID_RESEARCH_PROVIDER_ENTRY,
              score: 98,
            },
            selectedCost: 0.01,
            selectedLatencyMs: 350,
            decisionReasons: [],
            rankedProviders: [],
          },
        },
      ],
      totalAllocatedBudget: 0.05,
      estimatedTotalCost: 0.01,
      estimatedTotalSavings: 0.04,
      planRationale: "",
    };

    const reg = new AdapterRegistry();
    reg.register(new PaidResearchAdapter());

    const result = await executePlan(plan, reg);

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.serviceExecutions.length, 1);
    const exec = result.serviceExecutions[0]!;
    assert.equal(exec.status, "SUCCESS");
    assert.ok(exec.paymentAudit);
    assert.equal(exec.paymentResult?.settlementStatus, "SETTLED");
    assert.ok(exec.payload && exec.payload.includes("PREMIUM RESEARCH REPORT"));

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("19. executePlan halts with EXECUTION_BUDGET_EXCEEDED when paid provider exceeds stage budget", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const plan: any = {
      id: "plan-mock-19",
      intent: {
        category: "paid_research",
        confidence: 0.95,
        matchedKeywords: ["premium", "research"],
      },
      originalTask: "premium research task on AI trends",
      totalBudget: 1.0,
      priority: "balanced",
      serviceRequirements: [
        { service: "paid_research", executionOrder: 1, rationale: "premium source" },
      ],
      serviceResults: [
        {
          service: "paid_research",
          allocatedBudget: 0.005, // Provider cost is 0.01, exceeds budget!
          procurementResult: {
            status: "SUCCESS",
            selectedProvider: {
              ...PAID_RESEARCH_PROVIDER_ENTRY,
              score: 98,
            },
            selectedCost: 0.01,
            selectedLatencyMs: 350,
            decisionReasons: [],
            rankedProviders: [],
          },
        },
      ],
      totalAllocatedBudget: 0.005,
      estimatedTotalCost: 0.01,
      estimatedTotalSavings: -0.005,
      planRationale: "",
    };

    const reg = new AdapterRegistry();
    reg.register(new PaidResearchAdapter());

    const result = await executePlan(plan, reg);

    assert.equal(result.status, "EXECUTION_BUDGET_EXCEEDED");
    assert.equal(result.serviceExecutions.length, 1);
    const exec = result.serviceExecutions[0]!;
    assert.equal(exec.status, "EXECUTION_BUDGET_EXCEEDED");
    assert.ok(!exec.paymentAudit);

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("20. executePlan halts with PROVIDER_UNAVAILABLE when wallet config is missing in live mode", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "live"; // Switch to live
    // Temporarily clear environment configs
    const prevKey = process.env["GOAT_PRIVATE_KEY"];
    const prevMnemonic = process.env["WALLET_MNEMONIC"];
    delete process.env["GOAT_PRIVATE_KEY"];
    delete process.env["WALLET_MNEMONIC"];

    const plan: any = {
      id: "plan-mock-20",
      intent: {
        category: "paid_research",
        confidence: 0.95,
        matchedKeywords: ["premium", "research"],
      },
      originalTask: "premium research task on AI trends",
      totalBudget: 1.0,
      priority: "balanced",
      serviceRequirements: [
        { service: "paid_research", executionOrder: 1, rationale: "premium source" },
      ],
      serviceResults: [
        {
          service: "paid_research",
          allocatedBudget: 0.05,
          procurementResult: {
            status: "SUCCESS",
            selectedProvider: {
              ...PAID_RESEARCH_PROVIDER_ENTRY,
              score: 98,
            },
            selectedCost: 0.01,
            selectedLatencyMs: 350,
            decisionReasons: [],
            rankedProviders: [],
          },
        },
      ],
      totalAllocatedBudget: 0.05,
      estimatedTotalCost: 0.01,
      estimatedTotalSavings: 0.04,
      planRationale: "",
    };

    const reg = new AdapterRegistry();
    reg.register(new PaidResearchAdapter());

    const result = await executePlan(plan, reg);

    // Should resolve as PROVIDER_UNAVAILABLE because adapter isAvailable() returns false since wallet is not configured
    assert.equal(result.status, "PROVIDER_UNAVAILABLE");

    // Restore environment
    process.env["PAYMENT_MODE"] = prevMode;
    if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey;
    if (prevMnemonic) process.env["WALLET_MNEMONIC"] = prevMnemonic;
  });

  it("21. executePlan handles PAID_BUT_DELIVERY_FAILED correctly (payment settled, but payload fails)", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    process.env["PAYMENT_MODE"] = "simulation";

    const plan: any = {
      id: "plan-mock-21",
      intent: {
        category: "paid_research",
        confidence: 0.95,
        matchedKeywords: ["premium", "research"],
      },
      originalTask: "premium research task on AI trends fail",
      totalBudget: 1.0,
      priority: "balanced",
      serviceRequirements: [
        { service: "paid_research", executionOrder: 1, rationale: "premium source" },
      ],
      serviceResults: [
        {
          service: "paid_research",
          allocatedBudget: 0.05,
          procurementResult: {
            status: "SUCCESS",
            selectedProvider: {
              ...PAID_RESEARCH_PROVIDER_ENTRY,
              score: 98,
              // Induces the PAID_BUT_DELIVERY_FAILED delivery failure on server side
              priceHistory: [0.01, 402, 500],
            },
            selectedCost: 0.01,
            selectedLatencyMs: 350,
            decisionReasons: [],
            rankedProviders: [],
          },
        },
      ],
      totalAllocatedBudget: 0.05,
      estimatedTotalCost: 0.01,
      estimatedTotalSavings: 0.04,
      planRationale: "",
    };

    const reg = new AdapterRegistry();
    reg.register(new PaidResearchAdapter());

    const result = await executePlan(plan, reg);

    assert.equal(result.status, "PAID_BUT_DELIVERY_FAILED");
    assert.equal(result.serviceExecutions.length, 1);
    const exec = result.serviceExecutions[0]!;
    assert.equal(exec.status, "PAID_BUT_DELIVERY_FAILED");
    assert.equal(exec.errorCode, "PAID_BUT_DELIVERY_FAILED");
    assert.ok(exec.paymentAudit);
    assert.equal(exec.paymentResult?.settlementStatus, "SETTLED");
    assert.match(exec.payload || "", /delivery-failed/);
    assert.equal(result.finalResult, null);

    process.env["PAYMENT_MODE"] = prevMode;
  });

  // ---------------------------------------------------------------------------
  // 22-23: General requirements tests
  // ---------------------------------------------------------------------------

  it("22. free providers do not show fake x402 payment", async () => {
    const plan: any = {
      id: "plan-mock-22",
      intent: {
        category: "market_comparison",
        confidence: 0.95,
        matchedKeywords: ["bitcoin", "price"],
      },
      originalTask: "Check BTC price",
      totalBudget: 1.0,
      priority: "balanced",
      serviceRequirements: [
        { service: "market_data", executionOrder: 1, rationale: "get price" },
      ],
      serviceResults: [
        {
          service: "market_data",
          allocatedBudget: 0.5,
          procurementResult: {
            status: "SUCCESS",
            selectedProvider: {
              ...BITFINEX_PROVIDER_ENTRY,
              score: 95,
            },
            selectedCost: 0.0,
            selectedLatencyMs: 200,
            decisionReasons: [],
            rankedProviders: [],
          },
        },
      ],
      totalAllocatedBudget: 0.5,
      estimatedTotalCost: 0.0,
      estimatedTotalSavings: 0.5,
      planRationale: "",
    };

    const reg = new AdapterRegistry();
    // Register demo/free adapters
    const { DemoProviderAdapter } = require("../execution/adapters/demo");
    reg.register(new DemoProviderAdapter("bitfinex", "Bitfinex", ["market_data"]));

    const result = await executePlan(plan, reg);

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.serviceExecutions.length, 1);
    const exec = result.serviceExecutions[0]!;
    assert.equal(exec.status, "SUCCESS");
    assert.ok(!exec.paymentAudit);
    assert.ok(!exec.paymentResult);
  });

  it("23. CoinGecko/Bitfinex remain free/live market-data providers", () => {
    assert.ok(!COINGECKO_PROVIDER_ENTRY.paymentModel);
    assert.ok(!BITFINEX_PROVIDER_ENTRY.paymentModel);
    assert.ok((COINGECKO_PROVIDER_ENTRY.capabilities as string[]).includes("market_data"));
    assert.ok((BITFINEX_PROVIDER_ENTRY.capabilities as string[]).includes("market_data"));
  });

});
