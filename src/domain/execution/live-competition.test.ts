/**
 * MeterMind Live Provider Competition — Test Suite (Milestone #5)
 *
 * Run with: npx tsx --test src/domain/execution/live-competition.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CoinGeckoAdapter as OriginalCoinGeckoAdapter } from "../../server/providers/coingecko";
import { BitfinexAdapter as OriginalBitfinexAdapter } from "../../server/providers/bitfinex";
import { executePlan } from "./executor";
import { AdapterRegistry } from "./registry";
import { evaluateLiveObservations, calculateQuoteDifference } from "../procurement/live-evaluation";
import type { LiveObservation } from "../procurement/live-evaluation";
import type { EvaluatedProvider } from "../procurement/types";

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

let mockFetchHandler: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null = null;

const localFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (mockFetchHandler) {
    return mockFetchHandler(input, init);
  }
  return new Response(JSON.stringify({}), { status: 404 });
};

class CoinGeckoAdapter extends OriginalCoinGeckoAdapter {
  constructor(apiKey: string | undefined) {
    super(apiKey, localFetch);
  }
}

class BitfinexAdapter extends OriginalBitfinexAdapter {
  constructor() {
    super(localFetch);
  }
}

function createMockResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockGeckoData(btcPrice = 64000, ethPrice = 1900) {
  return {
    bitcoin: { usd: btcPrice, usd_market_cap: 1200000000000, usd_24h_vol: 25000000000, usd_24h_change: 1.2 },
    ethereum: { usd: ethPrice, usd_market_cap: 220000000000, usd_24h_vol: 8000000000, usd_24h_change: -0.5 },
  };
}

function mockBitfinexData(btcPrice = 64000, ethPrice = 1900) {
  return [
    ["tBTCUSD", 63800, 1.2, 63810, 1.5, 100, 0.0015, btcPrice, 25000, 64200, 63500],
    ["tETHUSD", 1890, 100, 1891, 50, -5, -0.0026, ethPrice, 8000, 1920, 1880]
  ];
}

function buildSyntheticPlan(): any {
  return {
    originalTask: "Find current Bitcoin and Ethereum prices and compare them.",
    totalBudget: 2.0,
    totalAllocatedBudget: 2.0,
    estimatedTotalCost: 0,
    estimatedTotalSavings: 0,
    planRationale: "test plan",
    intent: { category: "market_comparison", matchedKeywords: [], confidence: "high", originalTask: "Find price" },
    serviceRequirements: [
      { service: "market_data", executionOrder: 1, rationale: "live market data check", canParallelize: true, budgetWeight: 1.0 },
    ],
    serviceResults: [
      {
        service: "market_data",
        allocatedBudget: 2.0,
        procurementResult: {
          status: "SUCCESS",
          request: {
            task: "Find current Bitcoin and Ethereum prices.",
            budget: 2.0,
            priority: "balanced",
            constraints: {},
          },
          selectedProvider: {
            id: "coingecko",
            name: "CoinGecko",
            price: 0,
            mode: "live",
          } as any,
          decisionReasons: [],
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Milestone #5 — Multi-Provider Live Execution & Selection Competition", () => {

  // 1. Both live providers return valid quotes -> faster one is selected
  it("1. Faster provider wins under balanced/fastest when both are valid", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        // coingecko takes 30ms
        await new Promise(resolve => setTimeout(resolve, 30));
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        // bitfinex takes 5ms (faster)
        await new Promise(resolve => setTimeout(resolve, 5));
        return createMockResponse(mockBitfinexData(64100, 1905));
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    plan.serviceResults[0].procurementResult.request.priority = "fastest";

    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.selectedLiveProvider, "bitfinex");
    assert.ok(res.liveSelectionExplanation?.includes("Bitfinex"));
    assert.ok(res.liveSelectionExplanation?.includes("responded"));
    assert.ok(res.liveObservations !== undefined);
    assert.equal(res.liveObservations.length, 2);
  });

  // 2. Invalid provider loses
  it("2. Invalid provider (e.g. missing asset) loses even if faster", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        await new Promise(resolve => setTimeout(resolve, 20));
        // returns complete data
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        // faster but misses eth row
        return createMockResponse([
          ["tBTCUSD", 63800, 1.2, 63810, 1.5, 100, 0.0015, 64100, 25000, 64200, 63500]
        ]);
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.selectedLiveProvider, "coingecko");
    // Check observation status
    const bitfinexObs = res.liveObservations?.find(o => o.providerId === "bitfinex");
    assert.equal(bitfinexObs?.dataValid, false);
  });

  // 3. Timeout provider loses
  it("3. Timeout provider loses competition", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        throw new Error("fetch aborted");
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.selectedLiveProvider, "coingecko");
    const bitfinexObs = res.liveObservations?.find(o => o.providerId === "bitfinex");
    assert.equal(bitfinexObs?.success, false);
  });

  // 4. Excluded live provider cannot win
  it("4. Excluded live provider cannot win", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        await new Promise(resolve => setTimeout(resolve, 20));
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        return createMockResponse(mockBitfinexData(64000, 1900));
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    // Exclude Bitfinex
    plan.serviceResults[0].procurementResult.request.constraints = {
      excludedProviders: ["Bitfinex"],
    };

    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.selectedLiveProvider, "coingecko");
  });

  // 5. Preferred live provider gets bounded preference
  it("5. Preferred live provider wins even if slightly slower", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        // Preferred but slower (12ms)
        await new Promise(resolve => setTimeout(resolve, 12));
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        // Slower (2ms) but not preferred
        await new Promise(resolve => setTimeout(resolve, 2));
        return createMockResponse(mockBitfinexData(64000, 1900));
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    // Prefer CoinGecko
    plan.serviceResults[0].procurementResult.request.constraints = {
      preferredProviders: ["CoinGecko"],
    };

    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    // With 50ms virtual latency boost, coingecko virtual latency is 12 - 50 = -38ms, defeating bitfinex (2ms)
    assert.equal(res.selectedLiveProvider, "coingecko");
  });

  // 6. One provider unavailable -> other selected
  it("6. One provider unavailable selects the remaining successful provider", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        return new Response("Internal Server Error", { status: 500 });
      } else if (urlStr.includes("bitfinex.com")) {
        return createMockResponse(mockBitfinexData(64000, 1900));
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.selectedLiveProvider, "bitfinex");
  });

  // 7. Both unavailable -> typed failure
  it("7. Both unavailable returns typed failure", async () => {
    mockFetchHandler = async () => new Response("Rate limit", { status: 429 });

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.notEqual(res.status, "SUCCESS");
    assert.equal(res.serviceExecutions.length, 1);
    assert.ok(res.serviceExecutions[0]?.status.includes("RATE_LIMITED") || res.serviceExecutions[0]?.status.includes("UNAVAILABLE"));
  });

  // 8. Normalization
  it("8. Bitfinex response normalization creates standard MeterMind model", async () => {
    const rawData = mockBitfinexData(64250.75, 1895.50);
    const adapter = new BitfinexAdapter();
    const req = {
      service: "market_data" as const,
      task: "Find price",
      priorContext: null,
      allocatedBudget: 1.0,
      selectedProvider: { id: "bitfinex", name: "Bitfinex" } as any,
    };
    mockFetchHandler = async () => createMockResponse(rawData);
    
    const result = await adapter.execute(req);
    assert.equal(result.status, "SUCCESS");
    assert.ok(result.structuredPayload !== undefined);
    assert.equal(result.structuredPayload.dataSource, "Bitfinex Public API");
    
    const btc = result.structuredPayload.assets.find(a => a.assetId === "bitcoin");
    assert.ok(btc !== undefined);
    assert.equal(btc.price, 64250.75);
    assert.equal(btc.symbol, "BTC");

    const eth = result.structuredPayload.assets.find(a => a.assetId === "ethereum");
    assert.ok(eth !== undefined);
    assert.equal(eth.price, 1895.50);
    assert.equal(eth.symbol, "ETH");
  });

  // 9. Quote difference calculation
  it("9. Quote difference calculator computes correct percentages", () => {
    const diff1 = calculateQuoteDifference(100, 102);
    assert.equal(diff1, 0.02); // |100-102| / 100 = 0.02
    
    const diff2 = calculateQuoteDifference(50000, 52000);
    assert.equal(diff2, 0.04); // |2000| / 50000 = 0.04
  });

  // 10. Disagreement threshold warning
  it("10. Disagreement above threshold returns QUOTE_DISAGREEMENT status", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        return createMockResponse(mockGeckoData(60000, 1900)); // BTC is 60k
      } else if (urlStr.includes("bitfinex.com")) {
        return createMockResponse(mockBitfinexData(65000, 1900)); // BTC is 65k (diff is 8.3%, > 5%)
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.equal(res.status, "QUOTE_DISAGREEMENT");
    assert.equal(res.liveObservations?.length, 2);
    assert.ok(res.quoteDifferencePercent! > 0.05);
  });

  // 11. Latency & Success recorded
  it("11. Session latency and success metrics are correctly observed", async () => {
    mockFetchHandler = async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("coingecko.com")) {
        return createMockResponse(mockGeckoData(64000, 1900));
      } else if (urlStr.includes("bitfinex.com")) {
        return createMockResponse(mockBitfinexData(64000, 1900));
      }
      return new Response("Not found", { status: 404 });
    };

    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));
    registry.register(new BitfinexAdapter());

    const plan = buildSyntheticPlan();
    const res = await executePlan(plan, registry);
    assert.equal(res.status, "SUCCESS");
    
    for (const obs of res.liveObservations!) {
      assert.ok(obs.latencyMs >= 0);
      assert.equal(obs.success, true);
      assert.equal(obs.dataValid, true);
    }
  });

  // 12. No fake cost or fake reliability generated
  it("12. Evaluation scorer does not generate fake cost or historical quality metrics", () => {
    const obs: LiveObservation[] = [
      {
        providerId: "coingecko",
        providerName: "CoinGecko",
        capability: "market_data",
        startedAt: 0,
        completedAt: 50,
        latencyMs: 50,
        success: true,
        httpStatus: 200,
        dataValid: true,
        freshness: null,
        errorCode: null,
        payload: "",
        structuredPayload: {},
      },
      {
        providerId: "bitfinex",
        providerName: "Bitfinex",
        capability: "market_data",
        startedAt: 0,
        completedAt: 10,
        latencyMs: 10,
        success: true,
        httpStatus: 200,
        dataValid: true,
        freshness: null,
        errorCode: null,
        payload: "",
        structuredPayload: {},
      }
    ];

    const result = evaluateLiveObservations(obs, "balanced");
    // Selection is made purely on observations
    assert.equal(result.winner?.providerId, "bitfinex");
    // Assert no fake cost / reliability claims in explanation
    assert.ok(!result.explanation.includes("savings"));
    assert.ok(!result.explanation.includes("quality score"));
    assert.ok(result.explanation.includes("OBSERVED SESSION METRICS") || result.explanation.includes("session"));
  });

  // 13. Determinism
  it("13. Identical session observations yield deterministic provider choices", () => {
    const obs = (): LiveObservation[] => [
      {
        providerId: "coingecko",
        providerName: "CoinGecko",
        capability: "market_data",
        startedAt: 0,
        completedAt: 50,
        latencyMs: 50,
        success: true,
        httpStatus: 200,
        dataValid: true,
        freshness: null,
        errorCode: null,
        payload: "",
        structuredPayload: {},
      },
      {
        providerId: "bitfinex",
        providerName: "Bitfinex",
        capability: "market_data",
        startedAt: 0,
        completedAt: 10,
        latencyMs: 10,
        success: true,
        httpStatus: 200,
        dataValid: true,
        freshness: null,
        errorCode: null,
        payload: "",
        structuredPayload: {},
      }
    ];

    const r1 = evaluateLiveObservations(obs(), "balanced");
    const r2 = evaluateLiveObservations(obs(), "balanced");
    assert.deepEqual(r1.winner, r2.winner);
    assert.equal(r1.explanation, r2.explanation);
  });
});
