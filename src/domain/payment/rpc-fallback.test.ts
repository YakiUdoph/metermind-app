/**
 * MeterMind RPC Fallback — Test Suite
 *
 * Deterministic tests covering RPC connection failures and rotations.
 * Run with: npx tsx --test src/domain/payment/rpc-fallback.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeGoatPayment } from "../../server/payment/goat-client";
import { HttpMerchantGatewayAdapter, EvmPayerWalletAdapter } from "@goatnetwork/agentkit";
import { JsonRpcProvider, Wallet } from "ethers";
import { hashBuyContract } from "./contract";
import type { BuyContract } from "./contract";
import { makeTestPrivateKey } from "./test-credentials";
import { DurablePaymentLedger } from "../../server/payment/durable-idempotency";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("MeterMind RPC Fallback Suite", () => {
  const privateKey = makeTestPrivateKey("rpc-fallback");
  const receiver = "0x789C402PaidResearchMerchantAddress0000";
  const token = "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";

  it("persists live idempotency and blocks unknown/order-created retries across restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "metermind-ledger-"));
    const file = join(directory, "ledger.json");
    try {
      const firstProcess = new DurablePaymentLedger(file);
      firstProcess.reserve("restart-safe-key", "contract-hash");
      firstProcess.update("restart-safe-key", "ORDER_CREATED", { orderId: "order-1" });

      const restartedProcess = new DurablePaymentLedger(file);
      assert.equal(restartedProcess.get("restart-safe-key")?.orderId, "order-1");
      assert.equal(restartedProcess.retryRequiresReconciliation("restart-safe-key"), true);
      assert.throws(() => restartedProcess.reserve("restart-safe-key"), /IDEMPOTENCY_RETRY_BLOCKED_ORDER_CREATED/);
      restartedProcess.update("restart-safe-key", "SUBMISSION_UNKNOWN");
      assert.equal(new DurablePaymentLedger(file).retryRequiresReconciliation("restart-safe-key"), true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function contractFor(idempotencyKey: string): BuyContract {
    const base: Omit<BuyContract, "contractHash"> = {
      contractId: `contract-${idempotencyKey}`, requirementHash: "req", service: "paid_research",
      providerId: "paidresearchapi", providerEndpoint: "http://real-merchant.internal",
      quoteId: `quote-${idempotencyKey}`, quoteTimestamp: "2026-08-20T00:00:00.000Z",
      maximumAuthorizedAmount: 0.05, actualQuotedAmount: 0.01, currency: "USDC",
      network: "GOAT-Testnet", recipient: receiver, idempotencyKey,
      createdAt: "2026-08-20T00:00:00.000Z", decisionEvidenceHash: "decision",
      tokenContractAddress: token, chainId: 48816, payerAddress: new Wallet(privateKey).address,
    };
    return { ...base, contractHash: hashBuyContract(base) };
  }

  function setupGoatMocks(options?: {
    chainIdResponses?: Record<string, number | Error>;
    getPaymentStatus?: any;
    createPaymentIntent?: any;
  }) {
    const originalGetNetwork = JsonRpcProvider.prototype.getNetwork;
    const originalCreate = HttpMerchantGatewayAdapter.prototype.createPaymentIntent;
    const originalSign = EvmPayerWalletAdapter.prototype.signCalldataTypedData;
    const originalSubmit = HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization;
    const originalTransfer = EvmPayerWalletAdapter.prototype.transferToken;
    const originalStatus = HttpMerchantGatewayAdapter.prototype.getPaymentStatus;
    const originalFetch = global.fetch;

    // Override getNetwork to mock different behaviors based on URL
    JsonRpcProvider.prototype.getNetwork = async function() {
      // Access private RPC URL via provider configuration or path
      const providerUrl = (this as any)._getConnection().url;
      
      if (options?.chainIdResponses) {
        for (const [key, value] of Object.entries(options.chainIdResponses)) {
          if (providerUrl.includes(key)) {
            if (value instanceof Error) {
              throw value;
            }
            return { chainId: BigInt(value), name: "MockNetwork" } as any;
          }
        }
      }
      return { chainId: 48816n, name: "GOAT-Testnet" } as any;
    };

    HttpMerchantGatewayAdapter.prototype.createPaymentIntent = options?.createPaymentIntent || (async () => ({
      paymentId: "mock-payment-id",
      status: 'created',
      payToAddress: receiver,
      tokenAddress: token,
      tokenDecimals: 6,
      calldataSignRequest: { domain: {}, types: {}, message: {} },
      raw: {}
    }) as any);

    EvmPayerWalletAdapter.prototype.signCalldataTypedData = async () => "0xmocksignature";
    HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization = async () => ({ paymentId: "mock-payment-id", status: 'authorized', raw: {} });
    EvmPayerWalletAdapter.prototype.transferToken = async () => ({ txHash: "0xmocktransfertxhash" });
    HttpMerchantGatewayAdapter.prototype.getPaymentStatus = options?.getPaymentStatus || (async () => ({ paymentId: "mock-payment-id", status: 'settled', raw: {} }) as any);
    global.fetch = async () => new Response(JSON.stringify({ payload: "=== PAID PREMIUM RESEARCH REPORT ===\n" }), { status: 200 });

    return () => {
      JsonRpcProvider.prototype.getNetwork = originalGetNetwork;
      HttpMerchantGatewayAdapter.prototype.createPaymentIntent = originalCreate;
      EvmPayerWalletAdapter.prototype.signCalldataTypedData = originalSign;
      HttpMerchantGatewayAdapter.prototype.submitPaymentAuthorization = originalSubmit;
      EvmPayerWalletAdapter.prototype.transferToken = originalTransfer;
      HttpMerchantGatewayAdapter.prototype.getPaymentStatus = originalStatus;
      global.fetch = originalFetch;
    };
  }

  it("1. Fallback rotates to secondary RPC on primary failure", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    const prevKey = process.env["GOAT_PRIVATE_KEY"];
    const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
    const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

    process.env["PAYMENT_MODE"] = "live";
    process.env["GOAT_PRIVATE_KEY"] = privateKey;
    process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
    process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";
    process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] = "true";

    // Set primary RPC to fail, secondary to pass with correct chain ID
    const restore = setupGoatMocks({
      chainIdResponses: {
        "rpc.testnet3.goat.network": new Error("Connection timed out"),
        "rpc.thirdweb.com": 48816
      }
    });

    const result = await executeGoatPayment({
      url: "http://real-merchant.internal",
      procurementId: "p-123",
      taskId: "t-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-fallback-1",
      selectedProviderId: "paidresearchapi",
      buyContract: contractFor("idem-fallback-1"),
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
      }
    });

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.paymentResult?.transactionHash, "0xmocktransfertxhash");

    restore();
    process.env["PAYMENT_MODE"] = prevMode;
    if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
    if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
    if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
  });

  it("2. Blocks connection and fails if chain ID differs (Chain ID check)", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    const prevKey = process.env["GOAT_PRIVATE_KEY"];
    const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
    const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

    process.env["PAYMENT_MODE"] = "live";
    process.env["GOAT_PRIVATE_KEY"] = privateKey;
    process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
    process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";
    process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] = "true";

    // Set primary and secondary both to return mainnet (chainId = 1)
    const restore = setupGoatMocks({
      chainIdResponses: {
        "rpc.testnet3.goat.network": 1,
        "rpc.thirdweb.com": 1
      }
    });

    const result = await executeGoatPayment({
      url: "http://real-merchant.internal",
      procurementId: "p-123",
      taskId: "t-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-fallback-2",
      selectedProviderId: "paidresearchapi",
      buyContract: contractFor("idem-fallback-2"),
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
      }
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.errorCode, "PAYMENT_SUBMISSION_FAILED");
    assert.match(result.errorMessageSafe || "", /Unsupported chain ID: 1/);

    restore();
    process.env["PAYMENT_MODE"] = prevMode;
    if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
    if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
    if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
  });

  it("3. Throws typed failure if all RPC nodes fail to connect", async () => {
    const prevMode = process.env["PAYMENT_MODE"];
    const prevKey = process.env["GOAT_PRIVATE_KEY"];
    const prevMerchantUrl = process.env["GOAT_MERCHANT_URL"];
    const prevMerchantKey = process.env["GOAT_MERCHANT_API_KEY"];

    process.env["PAYMENT_MODE"] = "live";
    process.env["GOAT_PRIVATE_KEY"] = privateKey;
    process.env["GOAT_MERCHANT_URL"] = "http://real-merchant.internal";
    process.env["GOAT_MERCHANT_API_KEY"] = "real-api-key";
    process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] = "true";

    // Set primary and secondary RPC to both throw errors
    const restore = setupGoatMocks({
      chainIdResponses: {
        "rpc.testnet3.goat.network": new Error("Connection refused"),
        "rpc.thirdweb.com": new Error("Host unreachable")
      }
    });

    const result = await executeGoatPayment({
      url: "http://real-merchant.internal",
      procurementId: "p-123",
      taskId: "t-123",
      service: "paid_research",
      allocatedBudget: 0.05,
      idempotencyKey: "idem-fallback-3",
      selectedProviderId: "paidresearchapi",
      buyContract: contractFor("idem-fallback-3"),
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
      }
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.errorCode, "PAYMENT_SUBMISSION_FAILED");
    assert.match(result.errorMessageSafe || "", /Failed to connect to GOAT RPC/);

    restore();
    process.env["PAYMENT_MODE"] = prevMode;
    if (prevKey) process.env["GOAT_PRIVATE_KEY"] = prevKey; else delete process.env["GOAT_PRIVATE_KEY"];
    if (prevMerchantUrl) process.env["GOAT_MERCHANT_URL"] = prevMerchantUrl; else delete process.env["GOAT_MERCHANT_URL"];
    if (prevMerchantKey) process.env["GOAT_MERCHANT_API_KEY"] = prevMerchantKey; else delete process.env["GOAT_MERCHANT_API_KEY"];
  });

});
