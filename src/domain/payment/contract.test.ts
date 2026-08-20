import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BuyContract, hashBuyContract, verifyBuyContract, verifyBuyContractTampering } from "./contract";
import { verifyPaymentPolicy } from "./policy";
import { evaluateDeliveryAcceptance } from "../execution/acceptance";
import type { PaymentRequest } from "./types";

describe("MeterMind Buy Contract & Delivery Acceptance Suite", () => {
  const sampleContractBase: Omit<BuyContract, "contractHash"> = {
    contractId: "c-12345",
    requirementHash: "req-sha256-hash-value-123",
    service: "paid_research",
    providerId: "paidresearchapi",
    providerEndpoint: "https://api.paid-research.internal/v1/research",
    quoteId: "q-9988",
    quoteTimestamp: "2026-08-17T12:00:00Z",
    maximumAuthorizedAmount: 0.05,
    actualQuotedAmount: 0.01,
    currency: "USDC",
    network: "GOAT-Testnet",
    recipient: "0x789C402PaidResearchMerchantAddress0000",
    idempotencyKey: "idem-abc-123",
    createdAt: "2026-08-17T12:01:00Z",
    decisionEvidenceHash: "decision-sha256-hash-value-456",
    expectedOutputSchema: "json",
    acceptanceCriteria: "contains:btc",
    tokenContractAddress: "0x3022b87ac063DE95b1570F46f5e470F8B53112D8",
    chainId: 48816,
    payerAddress: "0x1111111111111111111111111111111111111111",
  };

  it("1. Generates deterministic hashes and validates untampered contracts", () => {
    const hash1 = hashBuyContract(sampleContractBase);
    const hash2 = hashBuyContract(sampleContractBase);
    assert.equal(hash1, hash2);

    const contract: BuyContract = { ...sampleContractBase, contractHash: hash1 };
    assert.ok(verifyBuyContract(contract));
  });

  it("2. Rejects contracts with corrupted or missing signature", () => {
    const contractNoHash: BuyContract = { ...sampleContractBase };
    assert.equal(verifyBuyContract(contractNoHash), false);

    const contractWrongHash: BuyContract = { ...sampleContractBase, contractHash: "0xcorrupted" };
    assert.equal(verifyBuyContract(contractWrongHash), false);
  });

  it("3. Detects tampering when commercial parameters are mutated", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    // Tamper providerId
    const tamperedProv = { ...contract, providerId: "hackers-api" };
    assert.equal(verifyBuyContractTampering(tamperedProv, hash), false);

    // Tamper quoted amount
    const tamperedAmount = { ...contract, actualQuotedAmount: 0.05 };
    assert.equal(verifyBuyContractTampering(tamperedAmount, hash), false);

    // Tamper recipient
    const tamperedRecip = { ...contract, recipient: "0xattackeraddress" };
    assert.equal(verifyBuyContractTampering(tamperedRecip, hash), false);
  });

  it("4. Integrated verifyPaymentPolicy approves valid contract matches", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    const request: PaymentRequest & { buyContract?: BuyContract } = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.05,
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.01,
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        quoteId: "q-9988",
        tokenContractAddress: "0x3022b87ac063DE95b1570F46f5e470F8B53112D8",
        chainId: 48816,
        payerAddress: "0x1111111111111111111111111111111111111111",
        source: "mock"
      },
      idempotencyKey: "idem-abc-123",
      buyContract: contract,
    };

    const policyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live" as const,
        paymentModel: "x402" as const,
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        quoteId: "q-9988",
        tokenContractAddress: "0x3022b87ac063DE95b1570F46f5e470F8B53112D8",
        chainId: 48816,
        payerAddress: "0x1111111111111111111111111111111111111111",
        isExcluded: false,
      },
      alreadyPaidKeys: { has: () => false },
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet"],
      remainingTaskBudget: 1.0,
    };

    const result = verifyPaymentPolicy(request, policyParams);
    assert.ok(result.approved);
  });

  it("5. verifyPaymentPolicy rejects tampered parameters in request", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    const request: PaymentRequest & { buyContract?: BuyContract } = {
      procurementId: "proc-123",
      taskId: "task-123",
      service: "paid_research",
      selectedProviderId: "paidresearchapi",
      allocatedBudget: 0.05,
      quote: {
        providerId: "paidresearchapi",
        service: "paid_research",
        amount: 0.02, // TAMPERED: quoted amount changed from 0.01 to 0.02
        asset: "USDC",
        network: "GOAT-Testnet",
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
        source: "mock"
      },
      idempotencyKey: "idem-abc-123",
      buyContract: contract,
    };

    const policyParams = {
      provider: {
        id: "paidresearchapi",
        name: "PaidResearchAPI",
        mode: "live" as const,
        paymentModel: "x402" as const,
        paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      },
      alreadyPaidKeys: { has: () => false },
      maxTransactionAmount: 0.05,
      allowedAssets: ["USDC"],
      allowedNetworks: ["GOAT-Testnet"],
      remainingTaskBudget: 1.0,
    };

    const result = verifyPaymentPolicy(request, policyParams);
    assert.equal(result.approved, false);
    assert.equal(result.errorCode, "PAYMENT_CONTRACT_TAMPERED");

    const tokenTamper = {
      ...request,
      quote: { ...request.quote, amount: 0.01, tokenContractAddress: "0x2222222222222222222222222222222222222222" },
    };
    assert.equal(verifyPaymentPolicy(tokenTamper, policyParams).errorCode, "PAYMENT_CONTRACT_TAMPERED");

    const quoteIdTamper = {
      ...request,
      quote: { ...request.quote, amount: 0.01, quoteId: "q-attacker" },
    };
    assert.equal(verifyPaymentPolicy(quoteIdTamper, policyParams).errorCode, "PAYMENT_CONTRACT_TAMPERED");
  });

  it("6. Delivery acceptance: approves valid payload matching criteria", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    // Valid JSON and contains "btc" keyword
    const payload = JSON.stringify({ message: "Research complete, BTC price compared." });
    const check = evaluateDeliveryAcceptance(payload, contract, true);

    assert.ok(check.passed);
    assert.equal(check.status, "ACCEPTED");
  });

  it("7. Delivery acceptance: rejects when payment is not confirmed", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    const payload = JSON.stringify({ message: "Research complete, BTC price compared." });
    const check = evaluateDeliveryAcceptance(payload, contract, false);

    assert.equal(check.passed, false);
    assert.equal(check.status, "DELIVERY_PENDING");
  });

  it("8. Delivery acceptance: rejects malformed JSON if json schema required", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    const payload = "plain text, not json, containing BTC";
    const check = evaluateDeliveryAcceptance(payload, contract, true);

    assert.equal(check.passed, false);
    assert.equal(check.status, "REJECTED");
    assert.ok(check.message.includes("schema validation"));
  });

  it("9. Delivery acceptance: rejects when keyword requirement fails", () => {
    const hash = hashBuyContract(sampleContractBase);
    const contract: BuyContract = { ...sampleContractBase, contractHash: hash };

    // Valid JSON but misses keyword "btc"
    const payload = JSON.stringify({ message: "Research complete, Eth price compared." });
    const check = evaluateDeliveryAcceptance(payload, contract, true);

    assert.equal(check.passed, false);
    assert.equal(check.status, "REJECTED");
    assert.ok(check.message.includes("btc"));
  });
});
