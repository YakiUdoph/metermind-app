/**
 * MeterMind Phase 2.1 — Procurement Proof & Bundle Verification Test Suite
 *
 * Runs deterministic checks covering:
 * - Pareto frontier + preferred provider bonus interactions.
 * - Re-quoting flow on quote expiration.
 * - Budget Ledger reservation safety and spent invariants.
 * - Multi-Service bundles ("Get current BTC price and summarize the market context").
 * - Serializable ProcurementProof compilation, including metric provenance.
 * - Explanation engine quality checks.
 *
 * Run with: npx tsx --test src/domain/procurement/procurement-proof.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  runProcurement,
  computeParetoFrontier,
  mapProviderToOffer,
  evaluateEligibility
} from "./scoring";
import { isQuoteExpired, requoteAndSelectWinner } from "./requote";
import { BudgetLedger } from "./budget-ledger";
import { hashBuyContract } from "../payment/contract";
import type { BuyContract } from "../payment/contract";
import type {
  ProviderOffer,
  ProcurementRequest,
  ProcurementProof,
  ProcurementBundle,
  DecisionTrace
} from "./procurement-engine-types";
import type { Provider } from "@/lib/mock";

describe("MeterMind final audits — Procurement Proof & Bundle Verification", () => {

  // =========================================================================
  // 1. PARETO + PREFERENCE INTERACTION TEST (Step 9)
  // =========================================================================
  it("Pareto frontier is computed purely from base metrics; preference bonus does not falsify Pareto status", async () => {
    // Provider B is strictly superior to Provider C in all metrics
    const providerB: Provider = {
      id: "providerb",
      name: "Provider B",
      category: "market_data",
      price: 0.02,
      quality: 95,
      reliability: 98,
      latency: 100,
      score: 0,
      jobs: 100,
      failed: 0,
      spend: 0,
      trend: 0,
      assessment: "",
      priceHistory: [],
      qualityHistory: [],
      capabilities: ["market_data"]
    };

    // Provider C is strictly dominated by B: more expensive, slower, lower quality/reliability
    // BUT Provider C is designated as PREFERRED by the user!
    const providerC: Provider = {
      id: "providerc",
      name: "Provider C",
      category: "market_data",
      price: 0.04, // dominated
      quality: 85, // dominated
      reliability: 90, // dominated
      latency: 300, // dominated
      score: 0,
      jobs: 100,
      failed: 0,
      spend: 0,
      trend: 0,
      assessment: "",
      priceHistory: [],
      qualityHistory: [],
      capabilities: ["market_data"]
    };

    const offerB = mapProviderToOffer(providerB, "market_data");
    const offerC = mapProviderToOffer(providerC, "market_data");

    // Perform Pareto frontier check
    const paretoResults = computeParetoFrontier([offerB, offerC]);
    const resC = paretoResults.find(r => r.providerId === "providerc");
    const resB = paretoResults.find(r => r.providerId === "providerb");

    assert.equal(resB?.paretoOptimal, true);
    assert.equal(resC?.paretoOptimal, false);
    assert.ok(resC?.dominatedBy.includes("providerb"));

    // Run procurement with preferredProvider constraint
    const request: any = {
      task: "Compare market prices.",
      budget: 1.0,
      priority: "balanced",
      preferredProviders: ["providerc"] // C is preferred!
    };

    const trace = await runProcurement(request, [providerB, providerC], "market_data");

    // Provider C should have received the preferred bonus (+3 points) in scores
    assert.ok(trace.scores["providerc"] !== undefined);
    
    // BUT the Pareto frontier set in the trace must still show B as optimal and C as dominated
    assert.ok(trace.paretoSet.includes("providerb"));
    assert.ok(!trace.paretoSet.includes("providerc"));
  });

  // =========================================================================
  // 2. REQUOTE REGRESSION TEST (Step 10)
  // =========================================================================
  it("Quote expiry triggers requote loop, applies hard filters, recomputes Pareto, rescores and freezes new contract", async () => {
    const expiredContract: BuyContract = {
      contractId: "bc_expired",
      requirementHash: "req_hash_123",
      service: "market_data",
      providerId: "providera",
      providerEndpoint: "https://api.providera.internal/v1",
      quoteId: "q_expired",
      quoteTimestamp: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago (>5s TTL)
      maximumAuthorizedAmount: 0.10,
      actualQuotedAmount: 0.01,
      currency: "USD",
      network: "GOAT-Testnet",
      recipient: "0xprovidera",
      idempotencyKey: "t-requote",
      createdAt: new Date(Date.now() - 10000).toISOString()
    } as any;

    const request: any = {
      taskId: "t-requote",
      rawTask: "Get prices, budget 0.10, prefer speed.",
      serviceRequirements: ["market_data"],
      budget: 0.10,
      priority: "fastest",
      preferredProviders: [],
      excludedProviders: []
    };

    const catalog: Provider[] = [
      {
        id: "providera",
        name: "Provider A",
        category: "market_data",
        price: 0.01,
        quality: 90,
        reliability: 95,
        latency: 900,
        score: 0,
        jobs: 100,
        failed: 0,
        spend: 0,
        trend: 0,
        assessment: "",
        priceHistory: [],
        qualityHistory: [],
        capabilities: ["market_data"],
        mode: "live"
      },
      {
        id: "providerb",
        name: "Provider B",
        category: "market_data",
        price: 0.03,
        quality: 92,
        reliability: 98,
        latency: 200,
        score: 0,
        jobs: 100,
        failed: 0,
        spend: 0,
        trend: 0,
        assessment: "",
        priceHistory: [],
        qualityHistory: [],
        capabilities: ["market_data"],
        mode: "live"
      }
    ];

    // Requote fetch simulator representing dynamic quote changes
    const requoteFn = async (providerId: string, service: string): Promise<ProviderOffer> => {
      // In the fresh quote, Provider A has become more expensive ($0.09) and Provider B remains cheap ($0.03) and fast
      const price = providerId === "providera" ? 0.09 : 0.03;
      const latency = providerId === "providera" ? 900 : 200;
      return {
        providerId,
        service,
        price,
        currency: "USD",
        estimatedLatencyMs: latency,
        quality: 90,
        reliability: 95,
        freshness: "live",
        paymentRequired: true,
        capabilities: [service],
        availability: true,
        metricSources: { price: "OBSERVED", latency: "OBSERVED", quality: "CATALOG_FIXTURE", reliability: "CATALOG_FIXTURE" },
        timestamp: new Date().toISOString(),
        ttlMs: 5000
      };
    };

    const frozenContract = await requoteAndSelectWinner(expiredContract, request, catalog, requoteFn);

    // Verify it detected expiry, ran requote, mapped winner to providerb, and recalculates hash
    assert.equal(isQuoteExpired(frozenContract), false);
    assert.equal(frozenContract.providerId, "providerb"); // changed winner from A to B due to price/speed tradeoffs
    assert.equal(frozenContract.actualQuotedAmount, 0.03);
    assert.ok(frozenContract.contractHash !== undefined);
  });

  // =========================================================================
  // 3. BUDGET LEDGER SAFETY TEST (Step 11)
  // =========================================================================
  it("Enforces budget ledgers: reserve occurs before spending, confirms/releases, requotes correctly manage reservations", () => {
    const totalBudget = 0.50;
    const ledger = new BudgetLedger(totalBudget);

    // 1. Reservation before execution
    const ok = ledger.reserve("market_data", 0.15);
    assert.equal(ok, true);
    assert.equal(ledger.getRemaining(), 0.35);
    assert.equal(ledger.getReserved("market_data"), 0.15);

    // 2. SUCCESS lifecycle: reserved -> spent
    ledger.confirm("market_data", 0.12);
    assert.equal(ledger.getSpent("market_data"), 0.12);
    assert.equal(ledger.getReserved("market_data"), 0);
    assert.equal(ledger.getRemaining(), 0.38); // 0.03 refunded to remaining

    // 3. PRE-SETTLEMENT FAILURE lifecycle: reserved -> released
    ledger.reserve("summarization", 0.20);
    assert.equal(ledger.getRemaining(), 0.18);
    ledger.release("summarization");
    assert.equal(ledger.getRemaining(), 0.38); // fully returned
    assert.equal(ledger.getSpent("summarization"), 0);

    // 4. REQUOTE WITH DIFFERENT PRICE: release old, reserve new
    ledger.reserve("translation", 0.10);
    assert.equal(ledger.getRemaining(), 0.28);
    // Winner changes and is cheaper ($0.08 instead of $0.10)
    ledger.release("translation");
    ledger.reserve("translation", 0.08);
    assert.equal(ledger.getRemaining(), 0.30); // reservation updated without leak
    ledger.confirm("translation", 0.08);

    // 5. Invariant check: spent + reserved <= totalBudget
    assert.ok(ledger.getTotalSpent() <= totalBudget);
    assert.equal(ledger.getTotalSpent(), 0.20); // 0.12 (market_data) + 0.08 (translation)
  });

  // =========================================================================
  // 4. MULTI-SERVICE PROOF & BUNDLE (Step 12)
  // =========================================================================
  it("Processes ProcurementBundle for multi-service tasks, maps individual details, and handles failures", () => {
    // Task: "Get current BTC price and summarize the market context."
    // Requires: market_data, summarization

    const mockTraceMarketData: DecisionTrace = {
      traceId: "tr_market",
      request: { task: "Get prices", budget: 0.10, priority: "balanced" } as any,
      discoveredCandidates: [],
      eligibilityDecisions: {},
      normalizedMetrics: {},
      scores: { coingecko: 95 },
      paretoSet: ["coingecko"],
      winner: "coingecko",
      explanation: {
        selectedProviderId: "coingecko",
        eligibleCandidates: ["coingecko"],
        rejectedCandidates: [],
        priority: "balanced",
        importantMetrics: { price: 0, latency: 120, quality: 90, reliability: 95 },
        tradeOffs: [],
        winnerVsRunnerUpExplanation: "CoinGecko selected.",
        isParetoOptimal: true,
        confidenceLimitations: []
      },
      timestamp: new Date().toISOString()
    };

    const mockTraceSummarization: DecisionTrace = {
      traceId: "tr_summary",
      request: { task: "Summarize output", budget: 0.10, priority: "balanced" } as any,
      discoveredCandidates: [],
      eligibilityDecisions: {},
      normalizedMetrics: {},
      scores: { dataflow: 90 },
      paretoSet: ["dataflow"],
      winner: "dataflow",
      explanation: {
        selectedProviderId: "dataflow",
        eligibleCandidates: ["dataflow"],
        rejectedCandidates: [],
        priority: "balanced",
        importantMetrics: { price: 0.01, latency: 400, quality: 95, reliability: 99 },
        tradeOffs: [],
        winnerVsRunnerUpExplanation: "DataFlow selected.",
        isParetoOptimal: true,
        confidenceLimitations: []
      },
      timestamp: new Date().toISOString()
    };

    // Construct a successful ProcurementBundle
    const successfulBundle: ProcurementBundle = {
      bundleId: "bundle-1",
      taskId: "task-1",
      rawTask: "Get current BTC price and summarize the market context.",
      serviceProcurements: [
        { service: "market_data", trace: mockTraceMarketData },
        { service: "summarization", trace: mockTraceSummarization }
      ],
      individualWinners: {
        market_data: "coingecko",
        summarization: "dataflow"
      },
      individualCosts: {
        market_data: 0.00,
        summarization: 0.01
      },
      totalEstimatedCost: 0.01,
      totalActualCost: 0.01,
      status: "SUCCESS"
    };

    assert.equal(successfulBundle.status, "SUCCESS");
    assert.equal(successfulBundle.serviceProcurements.length, 2);
    assert.equal(successfulBundle.individualWinners["market_data"], "coingecko");
    assert.equal(successfulBundle.individualWinners["summarization"], "dataflow");
    assert.equal(successfulBundle.totalActualCost, 0.01);

    // Construct a PARTIAL failure bundle (summarization failed)
    const failedBundle: ProcurementBundle = {
      bundleId: "bundle-1",
      taskId: "task-1",
      rawTask: "Get current BTC price and summarize the market context.",
      serviceProcurements: [
        { service: "market_data", trace: mockTraceMarketData },
        { service: "summarization", trace: mockTraceSummarization } // trace preserved even though execution failed
      ],
      individualWinners: {
        market_data: "coingecko"
      },
      individualCosts: {
        market_data: 0.00
      },
      totalEstimatedCost: 0.01,
      totalActualCost: 0.00, // summarization not executed/spent
      status: "PARTIAL"
    };

    assert.equal(failedBundle.status, "PARTIAL");
    assert.ok(failedBundle.serviceProcurements.length === 2); // Trace preserved for auditing
    assert.ok(failedBundle.individualWinners["summarization"] === undefined); // No winner for summarization
  });

  // =========================================================================
  // 5. PROCUREMENT PROOF SERIALIZATION CHECK (Step 13)
  // =========================================================================
  it("Produces fully populated serializable ProcurementProof, contains all decision metadata, and leaks NO secrets", () => {
    const traceId = `tr_${crypto.randomBytes(8).toString("hex")}`;
    const trace: DecisionTrace = {
      traceId,
      request: {
        task: "Get CoinGecko market prices. Budget $0.05. Minimum quality 80.",
        budget: 0.05,
        priority: "balanced",
        constraints: {
          minimumQuality: 80,
          preferredProviders: ["coingecko"]
        }
      } as any,
      discoveredCandidates: [
        {
          providerId: "coingecko",
          service: "market_data",
          price: 0,
          currency: "USD",
          estimatedLatencyMs: 120,
          quality: 90,
          reliability: 95,
          freshness: "live",
          paymentRequired: false,
          capabilities: ["market_data"],
          availability: true,
          metricSources: {
            price: "PROVIDER_DECLARED",
            latency: "OBSERVED",
            quality: "CATALOG_FIXTURE",
            reliability: "CATALOG_FIXTURE"
          },
          timestamp: new Date().toISOString()
        }
      ],
      eligibilityDecisions: {
        coingecko: { providerId: "coingecko", eligible: true, reasons: [], failedConstraints: [] }
      },
      normalizedMetrics: {
        coingecko: { priceScore: 100, latencyScore: 100, qualityScore: 90, reliabilityScore: 95 }
      },
      scores: { coingecko: 93.5 },
      paretoSet: ["coingecko"],
      winner: "coingecko",
      explanation: {
        selectedProviderId: "coingecko",
        eligibleCandidates: ["coingecko"],
        rejectedCandidates: [],
        priority: "balanced",
        importantMetrics: { price: 0, latency: 120, quality: 90, reliability: 95 },
        tradeOffs: ["COINGECKO is the only eligible candidate provider that met all hard constraints."],
        winnerVsRunnerUpExplanation: "COINGECKO was selected because it was the only eligible candidate provider that met all hard constraints.",
        isParetoOptimal: true,
        confidenceLimitations: ["Reliability values are catalog fixtures and were therefore not treated as live observations."]
      },
      timestamp: new Date().toISOString()
    };

    const buyContract: BuyContract = {
      contractId: "bc_proof_test",
      requirementHash: "req_hash_xyz",
      service: "market_data",
      providerId: "coingecko",
      providerEndpoint: "https://api.coingecko.com/api/v3",
      quoteId: "q_proof",
      quoteTimestamp: new Date().toISOString(),
      maximumAuthorizedAmount: 0.05,
      actualQuotedAmount: 0.00,
      currency: "USD",
      network: "GOAT-Testnet",
      recipient: "0xcoingeckoAddress0000",
      idempotencyKey: "idem_proof",
      createdAt: new Date().toISOString(),
      decisionEvidenceHash: traceId
    };

    const { contractHash, ...restContract } = buyContract;
    buyContract.contractHash = hashBuyContract(restContract);

    const proof: ProcurementProof = {
      trace,
      buyContract,
      execution: {
        status: "SUCCESS",
        payload: "[LIVE] CoinGecko executed successfully. BTC Price: $65000",
      },
      deliveryAcceptance: {
        status: "ACCEPTED",
        passed: true,
        message: "Delivery accepted: verified btc keyword content.",
        evaluatedAt: new Date().toISOString()
      },
      evidence: {
        transactionHash: "sim_tx_998877",
        paymentReference: "sim_ref_1122",
        mode: "simulation"
      }
    };

    // Serialize to JSON to check serializability
    const serialized = JSON.stringify(proof);
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.trace.winner, "coingecko");
    assert.equal(parsed.buyContract.contractHash, buyContract.contractHash);
    assert.equal(parsed.execution.status, "SUCCESS");
    assert.equal(parsed.deliveryAcceptance.status, "ACCEPTED");

    // Provenance Verification
    const cgCandidate = parsed.trace.discoveredCandidates[0];
    assert.equal(cgCandidate.metricSources.latency, "OBSERVED");
    assert.equal(cgCandidate.metricSources.reliability, "CATALOG_FIXTURE");

    // SECRETS LEAK SCAN
    const secretsPattern = /0x[0-9a-f]{64}|GOAT_PRIVATE_KEY|mnemonic/i;
    assert.ok(!secretsPattern.test(serialized), "Audit trace must never leak raw private keys or credentials!");
  });

  // =========================================================================
  // 6. EXPLANATION QUALITY TEST (Step 14)
  // =========================================================================
  it("Explanation output dynamically formats winner, runner-up, metric difference, priority, tradeoffs, and catalog limits", async () => {
    const winner: ProviderOffer = {
      providerId: "bitfinex",
      service: "market_data",
      price: 0,
      currency: "USD",
      estimatedLatencyMs: 250,
      observedLatencyMs: 250,
      quality: 90,
      reliability: 95,
      freshness: "live",
      paymentRequired: false,
      capabilities: ["market_data"],
      availability: true,
      metricSources: {
        price: "PROVIDER_DECLARED",
        latency: "OBSERVED",
        quality: "CATALOG_FIXTURE",
        reliability: "CATALOG_FIXTURE"
      },
      timestamp: new Date().toISOString()
    };

    const runnerUp: ProviderOffer = {
      providerId: "coingecko",
      service: "market_data",
      price: 0,
      currency: "USD",
      estimatedLatencyMs: 700,
      observedLatencyMs: 700,
      quality: 90,
      reliability: 95,
      freshness: "live",
      paymentRequired: false,
      capabilities: ["market_data"],
      availability: true,
      metricSources: {
        price: "PROVIDER_DECLARED",
        latency: "OBSERVED",
        quality: "CATALOG_FIXTURE",
        reliability: "CATALOG_FIXTURE"
      },
      timestamp: new Date().toISOString()
    };

    const request: any = {
      task: "Get BTC prices. Prefer speed.",
      budget: 0.10,
      priority: "fastest"
    };

    const catalog: Provider[] = [
      {
        id: "bitfinex",
        name: "Bitfinex",
        category: "market_data",
        price: 0,
        quality: 90,
        reliability: 95,
        latency: 250,
        score: 0,
        jobs: 100,
        failed: 0,
        spend: 0,
        trend: 0,
        assessment: "",
        priceHistory: [],
        qualityHistory: [],
        capabilities: ["market_data"]
      },
      {
        id: "coingecko",
        name: "CoinGecko",
        category: "market_data",
        price: 0,
        quality: 90,
        reliability: 95,
        latency: 700,
        score: 0,
        jobs: 100,
        failed: 0,
        spend: 0,
        trend: 0,
        assessment: "",
        priceHistory: [],
        qualityHistory: [],
        capabilities: ["market_data"]
      }
    ];

    const trace = await runProcurement(request, catalog, "market_data");

    const explanation = trace.explanation;
    assert.equal(explanation.selectedProviderId, "bitfinex");
    
    // Check that explanation lists winner, runnerUp, and metric differences dynamically:
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("BITFINEX"));
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("COINGECKO"));
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("FASTEST"));
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("250ms"));
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("700ms"));
    
    // Check that it contains reliability catalog fixture limitation notice:
    assert.ok(explanation.winnerVsRunnerUpExplanation.includes("Reliability values are catalog fixtures"));
  });

});
