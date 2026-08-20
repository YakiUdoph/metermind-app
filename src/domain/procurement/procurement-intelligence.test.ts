import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  understandTask,
  parseBudget,
  parseLatency,
  parseQuality,
  parseReliability,
  parseExcludedProviders,
  parsePreferredProviders,
  parsePaymentPreference,
  parseFreshness,
  parseNetwork,
  parseDeliveryCriteria,
  extractProcurementRequest
} from "../planning/understanding";
import {
  runProcurement,
  computeParetoFrontier,
  canonicalizeRequest,
  mapProviderToOffer
} from "./scoring";
import { BudgetLedger } from "./budget-ledger";
import { isQuoteExpired, requoteAndSelectWinner } from "./requote";
import type { ProviderOffer } from "./procurement-engine-types";
import type { BuyContract } from "../payment/contract";
import type { Provider } from "@/lib/mock";

describe("MeterMind Phase 2 — Procurement Intelligence Engine Suite", () => {

  describe("1. Intent & Constraint Extraction", () => {
    it("Parses budget expressions correctly", () => {
      assert.equal(parseBudget("under $0.05"), 0.05);
      assert.equal(parseBudget("maximum 2 cents"), 0.02);
      assert.equal(parseBudget("don't spend more than $0.10"), 0.10);
      assert.equal(parseBudget("budget: $0.25"), 0.25);
    });

    it("Parses latency expressions correctly", () => {
      assert.equal(parseLatency("under 2 seconds"), 2000);
      assert.equal(parseLatency("max latency 500ms"), 500);
      assert.equal(parseLatency("maximum 1.5s"), 1500);
    });

    it("Parses quality and reliability constraints correctly", () => {
      assert.equal(parseQuality("minimum quality of 80"), 80);
      assert.equal(parseQuality("quality >= 90"), 90);
      assert.equal(parseReliability("minimum reliability 95%"), 95);
      assert.equal(parseReliability("reliability at least 98"), 98);
    });

    it("Parses provider options (exclusions & preferences)", () => {
      const text = "prefer CoinGecko, exclude Bitfinex, don't use ProviderX";
      assert.deepEqual(parsePreferredProviders(text), ["coingecko"]);
      assert.deepEqual(parseExcludedProviders(text), ["bitfinex", "providerx"]);
    });

    it("Parses payment, freshness, and network preferences", () => {
      const text1 = "free only, live prices, on network: GOAT-Testnet";
      assert.equal(parsePaymentPreference(text1), "free-only");
      assert.equal(parseFreshness(text1), "live");
      assert.equal(parseNetwork(text1), "goat-testnet");

      const text2 = "cached results, do not pay";
      assert.equal(parsePaymentPreference(text2), "free-only");
      assert.equal(parseFreshness(text2), "static");
    });

    it("Parses delivery criteria (contains checks)", () => {
      assert.equal(parseDeliveryCriteria("contains:btc"), "contains:btc");
      assert.equal(parseDeliveryCriteria("must contain report"), "contains:report");
    });

    it("Orchestrates parsing into a structured ProcurementRequest", () => {
      const task = "Get BTC and ETH prices. Maximum $0.05. Prefer speed. Do not use ProviderX. Minimum quality 80.";
      const request = extractProcurementRequest("test-task-1", task, 1.0, "balanced");

      assert.equal(request.taskId, "test-task-1");
      assert.equal(request.budget, 0.05);
      assert.equal(request.priority, "fastest");
      assert.deepEqual(request.excludedProviders, ["providerx"]);
      assert.equal(request.minimumQuality, 80);
      assert.equal(request.freshnessRequirement, "live"); // "prices" triggers live
    });
  });

  describe("2. Hard Filters & Deterministic Scoring Scenarios (A to F)", () => {
    const providerA: Provider = {
      id: "providera",
      name: "Provider A",
      category: "market_data",
      price: 0.01,
      quality: 90,
      reliability: 95,
      latency: 900,
      score: 90,
      jobs: 100,
      failed: 5,
      spend: 1.0,
      trend: 0,
      assessment: "",
      priceHistory: [0.01],
      qualityHistory: [90],
      capabilities: ["market_data"]
    };

    const providerB: Provider = {
      id: "providerb",
      name: "Provider B",
      category: "market_data",
      price: 0.03,
      quality: 92,
      reliability: 98,
      latency: 200,
      score: 95,
      jobs: 100,
      failed: 2,
      spend: 3.0,
      trend: 0,
      assessment: "",
      priceHistory: [0.03],
      qualityHistory: [92],
      capabilities: ["market_data"]
    };

    const catalog = [providerA, providerB];

    it("SCENARIO A — CHEAPEST priority selects Provider A ($0.01)", async () => {
      const trace = await runProcurement(
        { task: "Get prices", budget: 0.05, priority: "CHEAPEST" },
        catalog,
        "market_data"
      );
      assert.equal(trace.winner, "providera");
    });

    it("SCENARIO B — FASTEST priority selects Provider B (200ms)", async () => {
      const trace = await runProcurement(
        { task: "Get prices", budget: 0.05, priority: "FASTEST" },
        catalog,
        "market_data"
      );
      assert.equal(trace.winner, "providerb");
    });

    it("SCENARIO C — BUDGET constraint rejects Provider B ($0.03) when budget is $0.02", async () => {
      const trace = await runProcurement(
        { task: "Get prices. Maximum $0.02.", budget: 0.02, priority: "balanced" },
        catalog,
        "market_data"
      );
      assert.equal(trace.winner, "providera");
      assert.equal(trace.eligibilityDecisions["providerb"]?.eligible, false);
      assert.ok(trace.eligibilityDecisions["providerb"]?.reasons.join("").includes("exceeds budget"));
    });

    it("SCENARIO D — EXCLUSION constraint excludes Provider A", async () => {
      const trace = await runProcurement(
        { task: "Get prices. Do not use Provider A.", budget: 0.05, priority: "balanced", excludedProviders: ["providera"] },
        catalog,
        "market_data"
      );
      assert.equal(trace.winner, "providerb");
      assert.equal(trace.eligibilityDecisions["providera"]?.eligible, false);
    });

    it("SCENARIO E — RELIABILITY constraint filters low reliability", async () => {
      const trace = await runProcurement(
        { task: "Get prices. Minimum reliability 97%.", budget: 0.05, priority: "balanced", minimumReliability: 97 },
        catalog,
        "market_data"
      );
      assert.equal(trace.winner, "providerb");
      assert.equal(trace.eligibilityDecisions["providera"]?.eligible, false);
    });

    it("SCENARIO F — PARETO frontier identifies dominated provider", () => {
      const providerC: ProviderOffer = {
        providerId: "providerc",
        service: "market_data",
        price: 0.04, // dominated by B on all fronts: A is cheaper, B is faster and higher quality
        currency: "USD",
        estimatedLatencyMs: 300, // slower than B
        quality: 91, // lower quality than B
        reliability: 97, // lower reliability than B
        freshness: "live",
        paymentRequired: true,
        capabilities: ["market_data"],
        availability: true,
        metricSources: { price: "CATALOG_FIXTURE", latency: "CATALOG_FIXTURE", quality: "HISTORICAL", reliability: "HISTORICAL" },
        timestamp: new Date().toISOString()
      };

      const offerA = mapProviderToOffer(providerA, "market_data");
      const offerB = mapProviderToOffer(providerB, "market_data");
      
      const paretoResults = computeParetoFrontier([offerA, offerB, providerC]);
      const resC = paretoResults.find(r => r.providerId === "providerc");
      
      assert.equal(resC?.paretoOptimal, false);
      assert.ok(resC?.dominatedBy.includes("providerb"));
    });
  });

  describe("3. Quote Expiration & Requote Loop (Scenario G)", () => {
    it("SCENARIO G — quote expiry triggers requote, winner unchanged or changes", async () => {
      const initialContract: BuyContract = {
        contractId: "c_1",
        requirementHash: "req_hash",
        service: "market_data",
        providerId: "providera",
        providerEndpoint: "https://api.providera.internal/v1",
        quoteId: "q_old",
        quoteTimestamp: new Date(Date.now() - 10000).toISOString(), // expired (>5s)
        maximumAuthorizedAmount: 0.05,
        actualQuotedAmount: 0.01,
        currency: "USD",
        network: "GOAT-Testnet",
        recipient: "0xprovidera",
        idempotencyKey: "idem-123",
        createdAt: new Date().toISOString(),
        decisionEvidenceHash: "ev_old"
      };

      const request = extractProcurementRequest("idem-123", "Get prices. Under $0.05. Prefer speed.", 0.05, "fastest");

      const catalog: Provider[] = [
        {
          id: "providera",
          name: "Provider A",
          category: "market_data",
          price: 0.01,
          quality: 90,
          reliability: 95,
          latency: 900,
          score: 90,
          jobs: 100,
          failed: 5,
          spend: 1.0,
          trend: 0,
          assessment: "",
          priceHistory: [0.01],
          qualityHistory: [90],
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
          score: 95,
          jobs: 100,
          failed: 2,
          spend: 3.0,
          trend: 0,
          assessment: "",
          priceHistory: [0.03],
          qualityHistory: [92],
          capabilities: ["market_data"],
          mode: "live"
        }
      ];

      // Requote function simulating dynamic pricing
      const mockRequote = async (providerId: string, service: string): Promise<ProviderOffer> => {
        return {
          providerId,
          service,
          price: providerId === "providera" ? 0.04 : 0.03, // A got more expensive
          currency: "USD",
          estimatedLatencyMs: providerId === "providera" ? 900 : 200,
          quality: 90,
          reliability: 95,
          freshness: "live",
          paymentRequired: true,
          capabilities: [service],
          availability: true,
          metricSources: { price: "OBSERVED", latency: "OBSERVED", quality: "HISTORICAL", reliability: "HISTORICAL" },
          timestamp: new Date().toISOString()
        };
      };

      // Since Provider A gets more expensive and B is faster and cheaper now, the winner should change to Provider B!
      const updatedContract = await requoteAndSelectWinner(initialContract, request, catalog, mockRequote);
      
      assert.equal(isQuoteExpired(updatedContract), false);
      assert.equal(updatedContract.providerId, "providerb"); // Winner changed from A to B!
    });
  });

  describe("4. Budget Ledger & Invariants", () => {
    it("Enforces budget reservations, confirm, release and invariantspent <= totalBudget", () => {
      const ledger = new BudgetLedger(0.10);

      // Reserve 0.04 for Step 1
      assert.equal(ledger.reserve("step-1", 0.04), true);
      assert.equal(ledger.getRemaining(), 0.06);
      assert.equal(ledger.getReserved("step-1"), 0.04);

      // Attempt to reserve 0.07 (should fail, only 0.06 remaining)
      assert.equal(ledger.reserve("step-2", 0.07), false);

      // Reserve 0.05 for Step 2 (should succeed)
      assert.equal(ledger.reserve("step-2", 0.05), true);
      assert.equal(ledger.getRemaining(), 0.01);

      // Confirm step-1 with actual cost 0.035
      ledger.confirm("step-1", 0.035);
      assert.equal(ledger.getSpent("step-1"), 0.035);
      assert.equal(ledger.getRemaining(), 0.015); // 0.005 returned to remaining

      // Release step-2 (failed execution)
      ledger.release("step-2");
      assert.equal(ledger.getRemaining(), 0.065); // 0.05 returned to remaining

      assert.ok(ledger.getTotalSpent() <= 0.10);
    });
  });
});
