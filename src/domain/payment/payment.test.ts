/**
 * MeterMind x402 Paid Execution & Payment Audit Layer — Test Suite
 *
 * Deterministic tests covering all specified requirements.
 * Run with: npx tsx --test src/domain/payment/payment.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { verifyPaymentPolicy } from "./policy";
import type { PolicyParams } from "./policy";
import { createPaymentAudit } from "./audit";
import { executeX402Request } from "../../server/payment/simulated-x402-client";
import { getWalletConfig, signPaymentChallenge } from "../../server/payment/wallet";
import { executePlan } from "../execution/executor";
import { AdapterRegistry } from "../execution/registry";
import { PaidResearchAdapter } from "../../server/providers/paid-research-live";
import { SimulatedPaidResearchAdapter } from "../../server/providers/simulated-paid-research";
import { DemoProviderAdapter } from "../execution/adapters/demo";
import { PAID_RESEARCH_PROVIDER_ENTRY, COINGECKO_PROVIDER_ENTRY, BITFINEX_PROVIDER_ENTRY } from "../../lib/mock";
import type { ProcurementPlan } from "../planning/types";
import type { ServiceExecutionRequest } from "../execution/types";
import type { PaymentRequest } from "./types";
import { HttpMerchantGatewayAdapter, EvmPayerWalletAdapter } from "@goatnetwork/agentkit";
import { JsonRpcProvider } from "ethers";
import { Wallet } from "ethers";
import { hashBuyContract } from "./contract";
import type { BuyContract } from "./contract";
import { makeTestPrivateKey } from "./test-credentials";

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
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: "sim_merchant_paidresearchapi",
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
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: "sim_merchant_paidresearchapi",
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

    const unavailableStore = verifyPaymentPolicy(request, {
      ...params,
      alreadyPaidKeys: new Set<string>(),
      idempotencyStoreReady: false,
    });
    assert.equal(unavailableStore.approved, false);
    assert.equal(unavailableStore.errorCode, "PAYMENT_IDEMPOTENCY_NOT_READY");
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
    const { handlePaidResearchRequest } = await import("../../server/providers/simulated-paid-research");
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
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: "sim_merchant_paidresearchapi",
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
    assert.ok(result.paymentResult!.transactionHash!.startsWith("sim_tx_"));

    process.env["PAYMENT_MODE"] = prevMode;
  });

  it("13. executeX402Request returns payment details on success", async () => {
    const { handlePaidResearchRequest } = await import("../../server/providers/simulated-paid-research");
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
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: "sim_merchant_paidresearchapi",
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
    const { handlePaidResearchRequest } = await import("../../server/providers/simulated-paid-research");
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
        mode: "demo",
        paymentModel: "x402",
        paymentDestination: "sim_merchant_paidresearchapi",
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
    assert.match(result.paymentResult!.transactionHash || "", /^sim_tx_[0-9a-f]+$/);

    process.env["PAYMENT_MODE"] = "live";
    assert.throws(
      () => signPaymentChallenge({ price: 0.01, asset: "USDC", network: "GOAT-Testnet", paymentDestination: "receiver", idempotencyKey: "live-must-use-agentkit" }),
      /LIVE_SIGNING_REQUIRES_AGENTKIT/,
    );

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
    reg.register(new SimulatedPaidResearchAdapter());

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
    reg.register(new SimulatedPaidResearchAdapter());

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
    reg.register(new SimulatedPaidResearchAdapter());

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

  // ---------------------------------------------------------------------------
  // 24+: New Official GOAT Payment Stack integration tests
  // ---------------------------------------------------------------------------

  describe("Official GOAT Payment Flow live-ready verification", () => {
    const livePrivateKey = makeTestPrivateKey("payment-flow");
    const liveReceiver = "0x2222222222222222222222222222222222222222";
    const liveToken = "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";

    function createTestBuyContract(idempotencyKey: string): BuyContract {
      const base: Omit<BuyContract, "contractHash"> = {
        contractId: `contract-${idempotencyKey}`,
        requirementHash: "test-requirement",
        service: "paid_research",
        providerId: "paidresearchapi",
        providerEndpoint: "http://real-merchant.internal/v1/deliver",
        quoteId: `quote-${idempotencyKey}`,
        quoteTimestamp: "2026-08-20T00:00:00.000Z",
        maximumAuthorizedAmount: 0.05,
        actualQuotedAmount: 0.01,
        currency: "USDC",
        network: "GOAT-Testnet",
        recipient: liveReceiver,
        idempotencyKey,
        createdAt: "2026-08-20T00:00:00.000Z",
        decisionEvidenceHash: "test-decision",
        tokenContractAddress: liveToken,
        chainId: 48816,
        payerAddress: new Wallet(livePrivateKey).address,
      };
      return { ...base, contractHash: hashBuyContract(base) };
    }
    
    // Mocks helper for setup and teardown
    function setupGoatMocks(options?: {
      chainId?: number;
      createPaymentIntent?: typeof HttpMerchantGatewayAdapter.prototype.createPaymentIntent;
      signCalldataTypedData?: typeof EvmPayerWalletAdapter.prototype.signCalldataTypedData;
      submitPaymentAuthorization?: typeof HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization;
      transferToken?: typeof EvmPayerWalletAdapter.prototype.transferToken;
      getPaymentStatus?: typeof HttpMerchantGatewayAdapter.prototype.getPaymentStatus;
      fetchHandler?: typeof global.fetch;
    }) {
      const originalCreate = HttpMerchantGatewayAdapter.prototype.createPaymentIntent;
      const originalSign = EvmPayerWalletAdapter.prototype.signCalldataTypedData;
      const originalSubmit = HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization;
      const originalTransfer = EvmPayerWalletAdapter.prototype.transferToken;
      const originalStatus = HttpMerchantGatewayAdapter.prototype.getPaymentStatus;
      const originalGetNetwork = JsonRpcProvider.prototype.getNetwork;
      const originalFetch = global.fetch;
      const previousReceiver = process.env["GOAT_MERCHANT_RECEIVER"];
      const previousIdempotencyReady = process.env["GOAT_DURABLE_IDEMPOTENCY_READY"];
      process.env["GOAT_MERCHANT_RECEIVER"] = liveReceiver;
      process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] = "true";

      HttpMerchantGatewayAdapter.prototype.createPaymentIntent = options?.createPaymentIntent || (async () => ({
        paymentId: "mock-payment-id",
        status: 'created',
        payToAddress: liveReceiver,
        tokenAddress: liveToken,
        tokenDecimals: 6,
        calldataSignRequest: { domain: {}, types: {}, message: {} },
        raw: {}
      }) as any);

      EvmPayerWalletAdapter.prototype.signCalldataTypedData = options?.signCalldataTypedData || (async () => "0xmocksignature");

      HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization = options?.submitPaymentAuthorization || (async () => ({
        paymentId: "mock-payment-id",
        status: 'authorized',
        raw: {}
      }));

      EvmPayerWalletAdapter.prototype.transferToken = options?.transferToken || (async () => ({
        txHash: "0xmocktransfertxhash"
      }));

      HttpMerchantGatewayAdapter.prototype.getPaymentStatus = options?.getPaymentStatus || (async () => ({
        paymentId: "mock-payment-id",
        status: 'settled',
        raw: {}
      }) as any);

      JsonRpcProvider.prototype.getNetwork = async function() {
        return { chainId: BigInt(options?.chainId ?? 48816), name: "GOAT-Testnet" } as any;
      };

      global.fetch = options?.fetchHandler || (async () => new Response(JSON.stringify({ payload: "=== PAID PREMIUM RESEARCH REPORT ===\n" }), { status: 200 }));

      return () => {
        HttpMerchantGatewayAdapter.prototype.createPaymentIntent = originalCreate;
        EvmPayerWalletAdapter.prototype.signCalldataTypedData = originalSign;
        HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization = originalSubmit;
        EvmPayerWalletAdapter.prototype.transferToken = originalTransfer;
        HttpMerchantGatewayAdapter.prototype.getPaymentStatus = originalStatus;
        JsonRpcProvider.prototype.getNetwork = originalGetNetwork;
        global.fetch = originalFetch;
        if (previousReceiver === undefined) delete process.env["GOAT_MERCHANT_RECEIVER"];
        else process.env["GOAT_MERCHANT_RECEIVER"] = previousReceiver;
        if (previousIdempotencyReady === undefined) delete process.env["GOAT_DURABLE_IDEMPOTENCY_READY"];
        else process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] = previousIdempotencyReady;
      };
    }

    it("24. Official GOAT client layer is invoked under live mode", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      let createCalled = false;
      const restore = setupGoatMocks({
        createPaymentIntent: async (input) => {
          createCalled = true;
          return {
            paymentId: "live-payment-id",
            status: "created",
            payToAddress: liveReceiver,
            tokenAddress: liveToken,
            tokenDecimals: 6,
            calldataSignRequest: { domain: {}, types: {}, message: {} },
            raw: {}
          } as any;
        }
      });

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-24",
        buyContract: createTestBuyContract("idem-goat-24"),
      } as any);

      assert.ok(createCalled, "Should have called merchant createPaymentIntent");
      assert.equal(result.status, "SUCCESS");
      assert.equal(result.paymentResult?.transactionHash, "0xmocktransfertxhash");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("25. No custom wire-protocol fallback occurs in live mode", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      let fetchRequests: string[] = [];
      const restore = setupGoatMocks({
        fetchHandler: async (url) => {
          fetchRequests.push(url.toString());
          return new Response(JSON.stringify({ payload: "live research outcome" }), { status: 200 });
        }
      });

      const adapter = new PaidResearchAdapter();
      await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-25",
        buyContract: createTestBuyContract("idem-goat-25"),
      } as any);

      // In custom wire protocol, it sent headers to req.url.
      // In live mode, it only communicates through HttpMerchantGatewayAdapter (which uses fetch under the hood) and the deliver endpoint.
      // Let's verify that no request was sent directly to custom wire endpoint format (http://local-paid-research-api/v1/research) without official flow
      const customWireEndpointUsed = fetchRequests.some(url => url.includes("local-paid-research-api"));
      assert.ok(!customWireEndpointUsed, "Custom wire-protocol fallback endpoint should not be invoked in live mode");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("26. Winner-only payment remains enforced in live mode", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks();

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-26",
        buyContract: createTestBuyContract("idem-goat-26"),
        selectedProvider: {
          id: "mismatching_provider", // Mismatch!
          name: "Wrong API",
          score: 80,
          price: 0.01,
          latencyMs: 100,
          mode: "live"
        } as any
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.errorCode, "PAYMENT_PROVIDER_MISMATCH");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("27. Budget guard remains enforced in live mode", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks();

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.005, // Budget (0.005) is less than quote (0.01)
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-27",
        buyContract: createTestBuyContract("idem-goat-27"),
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.errorCode, "PAYMENT_BUDGET_EXCEEDED");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("28. Settlement status check is required before delivery in live mode", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      let statusChecked = false;
      const restore = setupGoatMocks({
        getPaymentStatus: async (paymentId) => {
          statusChecked = true;
          return {
            paymentId,
            status: "created" // MOCK AS UNSETTLED / TIMED OUT
          } as any;
        }
      });

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-28",
        buyContract: createTestBuyContract("idem-goat-28"),
      } as any);

      assert.ok(statusChecked, "Should check status first");
      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.paymentResult?.settlementStatus, "UNKNOWN");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("29. Delivery failure after payment yields PAID_BUT_DELIVERY_FAILED status", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks({
        fetchHandler: async () => new Response(JSON.stringify({ payload: "[PAID_BUT_DELIVERY_FAILED] error" }), { status: 500 }) // Fails delivery
      });

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-29",
        buyContract: createTestBuyContract("idem-goat-29"),
      } as any);

      assert.equal(result.status, "PAID_BUT_DELIVERY_FAILED");
      assert.equal(result.paymentResult?.settlementStatus, "SETTLED");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("30. Simulation mode is clearly labeled", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      process.env["PAYMENT_MODE"] = "simulation";

      const plan: any = {
        id: "plan-mock-30",
        intent: {
          category: "paid_research",
          confidence: 0.95,
          matchedKeywords: ["premium"],
        },
        originalTask: "premium research task",
        totalBudget: 1.0,
        priority: "balanced",
        serviceRequirements: [
          { service: "paid_research", executionOrder: 1, rationale: "test" },
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
      reg.register(new SimulatedPaidResearchAdapter());

      const result = await executePlan(plan, reg);

      assert.equal(result.status, "SUCCESS");
      assert.ok(result.finalResult);
      assert.match(result.finalResult!, /=== SIMULATED GOAT\/x402 PAYMENT ===/);
      assert.match(result.serviceExecutions[0]!.paymentResult!.transactionHash!, /^sim_tx_/);
      assert.equal(result.serviceExecutions[0]!.executionMode, "demo");
      assert.equal(result.serviceExecutions[0]!.integrationClassification, "SIMULATED");
      assert.equal(result.overallExecutionMode, "demo");

      process.env["PAYMENT_MODE"] = prevMode;
    });

    it("31. Live results cannot be fabricated and fails truthfully if config is missing", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      delete process.env["GOAT_PRIVATE_KEY"];
      delete process.env["GOAT_MERCHANT_URL"];
      delete process.env["GOAT_MERCHANT_API_KEY"];

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-31"
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.errorCode, "PAYMENT_NOT_CONFIGURED"); // Blocks fabrication

      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey;
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl;
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey;
    });

    it("32. Live mode sanitizes secrets and keys in audit logs", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks({
        createPaymentIntent: async () => ({
          paymentId: "live-payment-id",
          status: "created",
          payToAddress: liveReceiver,
          tokenAddress: liveToken,
          tokenDecimals: 6,
          calldataSignRequest: { domain: {}, types: {}, message: {} },
          raw: {
            privateKey: "0xshould_be_removed",
            secret: "should_be_removed",
            apiSecret: "should_be_removed"
          }
        }) as any
      });

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-32",
        buyContract: createTestBuyContract("idem-goat-32"),
      } as any);

      assert.equal(result.status, "SUCCESS");
      const serializedAudit = JSON.stringify(result.paymentAudit);
      assert.ok(!serializedAudit.includes("should_be_removed"), "Audit log must sanitize raw secrets.");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("33. Live mode validates chain ID and blocks mainnet configuration", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks({
        chainId: 1 // MAINNET (blocked!)
      });

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-33",
        buyContract: createTestBuyContract("idem-goat-33"),
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.match(result.paymentAudit?.policyChecks[0]?.message || "", /Unsupported chain ID: 1/);

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("34. Live mode blocks execution if merchant config is missing", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      process.env["GOAT_PRIVATE_KEY"] = livePrivateKey;
      delete process.env["GOAT_MERCHANT_URL"]; // Missing
      delete process.env["GOAT_MERCHANT_API_KEY"]; // Missing

      const restore = setupGoatMocks();

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-34"
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.errorCode, "LIVE_PAYMENT_BLOCKED");
      assert.match(result.errorMessage || "", /LIVE PAYMENT BLOCKED — REAL GOAT MERCHANT NOT CONFIGURED/);

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

    it("35. Live mode blocks execution if wallet key is missing", async () => {
      const prevMode = process.env["PAYMENT_MODE"];
      const prevKey = process.env["GOAT_PRIVATE_KEY"];
      const prevMnemonic = process.env["WALLET_MNEMONIC"];
      const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
      const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

      process.env["PAYMENT_MODE"] = "live";
      delete process.env["GOAT_PRIVATE_KEY"]; // Missing
      delete process.env["WALLET_MNEMONIC"]; // Missing
      process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
      process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";

      const restore = setupGoatMocks();

      const adapter = new PaidResearchAdapter();
      const result = await adapter.execute({
        service: "paid_research",
        task: "do research",
        allocatedBudget: 0.05,
        procurementId: "p-123",
        taskId: "t-123",
        idempotencyKey: "idem-goat-35"
      } as any);

      assert.equal(result.status, "EXECUTION_FAILED");
      assert.equal(result.errorCode, "PAYMENT_NOT_CONFIGURED");

      restore();
      process.env["PAYMENT_MODE"] = prevMode;
      if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
      if (prevMnemonic) process.env["WALLET_MNEMONIC"] = prevMnemonic; else delete process.env["WALLET_MNEMONIC"];
      if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
      if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
    });

  });

});
