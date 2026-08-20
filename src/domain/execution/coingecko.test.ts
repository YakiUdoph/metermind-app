/**
 * MeterMind Live Provider Execution — CoinGecko Test Suite (Milestone #4)
 *
 * Run with: npx tsx --test src/domain/execution/coingecko.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CoinGeckoAdapter as OriginalCoinGeckoAdapter } from "../../server/providers/coingecko";
import { executePlan } from "./executor";
import { AdapterRegistry, createDefaultRegistry } from "./registry";
import { planTask } from "../planning/planner";
import { COINGECKO_PROVIDER_ENTRY, planningProviders } from "../../lib/mock";
import type { ServiceExecutionRequest } from "./types";
import type { EvaluatedProvider } from "@/domain/procurement/types";

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

function createMockResponse(body: any, status = 200, statusText = "OK"): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function syntheticEvaluatedProvider(): EvaluatedProvider {
  return {
    id: "coingecko",
    name: "CoinGecko",
    category: "market-data",
    price: 0,
    quality: 90,
    reliability: 95,
    latency: 120,
    score: 92,
    jobs: 100,
    failed: 1,
    spend: 0,
    trend: 0,
    assessment: "Test live metadata",
    priceHistory: [0],
    qualityHistory: [90],
    priceScore: 100,
    qualityScore: 90,
    reliabilityScore: 95,
    latencyScore: 90,
    totalScore: 93,
    isWinner: true,
    isQualified: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CoinGecko Live Adapter & Execution Pipeline", () => {
  const dummyRequest: ServiceExecutionRequest = {
    service: "market_data",
    task: "Find current Bitcoin and Ethereum prices.",
    priorContext: null,
    allocatedBudget: 1.0,
    selectedProvider: syntheticEvaluatedProvider(),
  };

  // 1. CoinGecko adapter success
  it("1. CoinGecko adapter success with valid API key and mocked response", async () => {
    const mockData = {
      bitcoin: { usd: 67120.5, usd_market_cap: 1320000000000, usd_24h_vol: 28000000000, usd_24h_change: 2.5 },
      ethereum: { usd: 3450.2, usd_market_cap: 410000000000, usd_24h_vol: 14000000000, usd_24h_change: -1.2 },
    };
    mockFetchHandler = async (url, init) => {
      // Confirm auth header exists and matches key
      assert.equal((init?.headers as any)?.["x-cg-demo-api-key"], "test-key-123");
      return createMockResponse(mockData);
    };

    const adapter = new CoinGeckoAdapter("test-key-123");
    const result = await adapter.execute(dummyRequest);

    assert.equal(result.status, "SUCCESS");
    assert.equal(result.executionMode, "live");
    assert.ok(result.payload !== null);
    assert.ok(result.payload.includes("[LIVE]"));
    assert.ok(result.payload.includes("67,120.5"));
    assert.ok(result.payload.includes("3,450.2"));
    assert.ok(result.measuredLatencyMs >= 0);
  });

  // 2. Normalized Bitcoin response
  it("2. Normalized Bitcoin response returns correct symbol, name, and usd price", async () => {
    const mockData = {
      bitcoin: { usd: 65000.0, usd_market_cap: 1200000000000, usd_24h_vol: 25000000000, usd_24h_change: 1.2 },
    };
    mockFetchHandler = async () => createMockResponse(mockData);

    const adapter = new CoinGeckoAdapter("test-key");
    const req: ServiceExecutionRequest = {
      ...dummyRequest,
      task: "Find current Bitcoin price.",
    };
    const result = await adapter.execute(req);

    assert.equal(result.status, "SUCCESS");
    assert.ok(result.structuredPayload !== undefined);
    const btc = result.structuredPayload.assets.find(a => a.assetId === "bitcoin");
    assert.ok(btc !== undefined);
    assert.equal(btc.symbol, "BTC");
    assert.equal(btc.name, "Bitcoin");
    assert.equal(btc.price, 65000.0);
    assert.equal(btc.marketCap, 1200000000000);
  });

  // 3. Normalized Ethereum response
  it("3. Normalized Ethereum response returns correct symbol, name, and usd price", async () => {
    const mockData = {
      ethereum: { usd: 3300.0, usd_market_cap: 390000000000, usd_24h_vol: 12000000000, usd_24h_change: -0.5 },
    };
    mockFetchHandler = async () => createMockResponse(mockData);

    const adapter = new CoinGeckoAdapter("test-key");
    const req: ServiceExecutionRequest = {
      ...dummyRequest,
      task: "Find ETH price.",
    };
    const result = await adapter.execute(req);

    assert.equal(result.status, "SUCCESS");
    assert.ok(result.structuredPayload !== undefined);
    const eth = result.structuredPayload.assets.find(a => a.assetId === "ethereum");
    assert.ok(eth !== undefined);
    assert.equal(eth.symbol, "ETH");
    assert.equal(eth.name, "Ethereum");
    assert.equal(eth.price, 3300.0);
  });

  // 4. Multiple assets
  it("4. Multiple assets extracts and requests all mentioned tokens", async () => {
    const mockData = {
      bitcoin: { usd: 66000.0 },
      ethereum: { usd: 3400.0 },
    };
    mockFetchHandler = async (url) => {
      // Verify query params
      const urlStr = typeof url === "string" ? url : (url as URL).toString();
      assert.ok(urlStr.includes("bitcoin") && urlStr.includes("ethereum"));
      return createMockResponse(mockData);
    };

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.structuredPayload?.assets.length, 2);
  });

  // 5. API key missing
  it("5. API key missing returns LIVE_PROVIDER_NOT_CONFIGURED status", async () => {
    const adapter = new CoinGeckoAdapter("");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "LIVE_PROVIDER_NOT_CONFIGURED");
    assert.equal(result.payload, null);
    assert.ok(result.errorMessage?.includes("not configured"));
  });

  // 6. 401 auth failure
  it("6. 401 unauthorized HTTP error code maps to LIVE_PROVIDER_AUTH_FAILED", async () => {
    mockFetchHandler = async () => new Response(JSON.stringify({ error: "Invalid API Key" }), { status: 401 });

    const adapter = new CoinGeckoAdapter("invalid-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "LIVE_PROVIDER_AUTH_FAILED");
    assert.equal(result.payload, null);
    assert.ok(result.errorMessage?.includes("unauthorized"));
  });

  // 7. 429 rate limit
  it("7. 429 HTTP code maps to LIVE_PROVIDER_RATE_LIMITED status", async () => {
    mockFetchHandler = async () => new Response("Rate limit exceeded", { status: 429 });

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "LIVE_PROVIDER_RATE_LIMITED");
    assert.ok(result.errorMessage?.includes("rate limit"));
  });

  // 8. 500 provider failure
  it("8. 500 HTTP code maps to LIVE_PROVIDER_UNAVAILABLE status", async () => {
    mockFetchHandler = async () => new Response("Server error", { status: 500 });

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "LIVE_PROVIDER_UNAVAILABLE");
    assert.ok(result.errorMessage?.includes("server error"));
  });

  // 9. Malformed response
  it("9. Non-JSON response maps to LIVE_PROVIDER_BAD_RESPONSE", async () => {
    mockFetchHandler = async () => new Response("Internal server error plain text", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "LIVE_PROVIDER_BAD_RESPONSE");
    assert.ok(result.errorMessage?.includes("parsed as JSON"));
  });

  // 10. Timeout
  it("10. Fetch timeout AbortError maps to EXECUTION_TIMEOUT status", async () => {
    mockFetchHandler = async () => {
      // Simulate timeout abort
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      throw err;
    };

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "EXECUTION_TIMEOUT");
    assert.ok(result.errorMessage?.includes("timed out"));
  });

  // 11. Measured latency included
  it("11. Measured latency is recorded correctly as positive number on execution result", async () => {
    mockFetchHandler = async () => {
      // add a small mock delay
      await new Promise(resolve => setTimeout(resolve, 5));
      return createMockResponse({ bitcoin: { usd: 65000 } });
    };

    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.status, "SUCCESS");
    assert.ok(result.measuredLatencyMs >= 5);
  });

  // 12. Live mode clearly labelled
  it("12. Successful live execution carries executionMode: 'live'", async () => {
    mockFetchHandler = async () => createMockResponse({ bitcoin: { usd: 65000 } });
    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute(dummyRequest);
    assert.equal(result.executionMode, "live");
  });

  // 13. Demo mode remains demo
  it("13. Demo executions remain fully demo and do not bleed into live mode", async () => {
    // Calling standard demo adapter directly
    const { DemoProviderAdapter } = await import("./adapters/demo");
    const demoAdapter = new DemoProviderAdapter("dataflow", "DataFlow", ["market_data"]);
    const res = await demoAdapter.execute({
      ...dummyRequest,
      selectedProvider: { ...dummyRequest.selectedProvider, id: "dataflow" },
    });
    assert.equal(res.executionMode, "demo");
    assert.ok(res.payload?.includes("[DEMO]"));
  });

  // 14. Secrets never included in result
  it("14. Environment secrets / API keys are never included in result error messages or payloads", async () => {
    mockFetchHandler = async () => new Response("Unauthorized error", { status: 401 });
    const apiKey = "secret_coingecko_api_key_xyz_123";
    const adapter = new CoinGeckoAdapter(apiKey);
    const result = await adapter.execute(dummyRequest);

    assert.notEqual(result.status, "SUCCESS");
    assert.ok(result.errorMessage !== undefined);
    assert.ok(!result.errorMessage.includes(apiKey));
    assert.ok(result.payload === null);
  });

  // 15. Adapter supports only MARKET_DATA
  it("15. CoinGecko live adapter supports only market_data service category", () => {
    const adapter = new CoinGeckoAdapter("test-key");
    assert.deepEqual(adapter.supportedCapabilities, ["market_data"]);
  });

  // 16. Unsupported capability rejected
  it("16. CoinGecko live adapter rejects non-market_data requests with SERVICE_NOT_SUPPORTED", async () => {
    const adapter = new CoinGeckoAdapter("test-key");
    const result = await adapter.execute({
      ...dummyRequest,
      service: "web_search", // not supported
    });
    assert.equal(result.status, "SERVICE_NOT_SUPPORTED");
  });

  // 17. Executor can await async adapter
  it("17. Orchestrator executor successfully awaits async live CoinGecko adapter and compiles audit", async () => {
    mockFetchHandler = async () => createMockResponse({
      bitcoin: { usd: 68000 },
      ethereum: { usd: 3400 }
    });
    const registry = createDefaultRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));

    // We need both web_search (from demo providers) and market_data (from CoinGecko)
    // because market_comparison intent plans both services.
    const testCatalog = [...planningProviders, COINGECKO_PROVIDER_ENTRY];

    const plan = planTask(
      { task: "Find current Bitcoin and Ethereum prices and latest news.", totalBudget: 2.0, priority: "balanced" },
      testCatalog,
    );
    assert.equal(plan.status, "SUCCESS");

    const execResult = await executePlan(plan.plan!, registry);
    assert.equal(execResult.status, "SUCCESS");
    assert.equal(execResult.overallExecutionMode, "hybrid"); // hybrid because web_search was run as demo and market_data as live
    assert.ok(execResult.liveMarketData !== undefined);
    
    const btc = execResult.liveMarketData.assets.find(a => a.assetId === "bitcoin");
    assert.ok(btc !== undefined);
    assert.equal(btc.price, 68000);
  });

  // 18. Sequential execution remains correct after async conversion
  it("18. Sequential execution order is respected and awaits preceding pipeline stages", async () => {
    let callOrder: string[] = [];
    class MockGenericAdapter {
      readonly providerId: string;
      readonly providerName: string;
      readonly supportedCapabilities: string[];
      readonly executionMode = "live" as const;
      constructor(id: string, caps: string[]) {
        this.providerId = id;
        this.providerName = id;
        this.supportedCapabilities = caps;
      }
      isAvailable() { return true; }
      async execute(req: any) {
        callOrder.push(req.service);
        // simulated latency
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          status: "SUCCESS" as const,
          service: req.service,
          providerId: this.providerId,
          providerName: this.providerName,
          executionMode: "live" as const,
          payload: `Result of ${req.service}`,
          startedAt: Date.now(),
          completedAt: Date.now(),
          measuredLatencyMs: 5,
          declaredCost: 0,
          allocatedBudget: 1.0,
        };
      }
    }

    const registry = new AdapterRegistry();
    registry.register(new MockGenericAdapter("coingecko", ["market_data"]) as any);
    registry.register(new MockGenericAdapter("dataflow", ["web_search", "summarization"]) as any);

    // Multi-stage plan with ordering: web_search (order 1), market_data (order 1), summarization (order 2)
    // Both 1s should run before order 2.
    const plan = {
      originalTask: "Find price and summarize.",
      totalBudget: 3.0,
      totalAllocatedBudget: 3.0,
      estimatedTotalCost: 0.1,
      estimatedTotalSavings: 0,
      planRationale: "test rationale",
      intent: { category: "market_comparison" as const, matchedKeywords: ["price"], confidence: "high" as const, originalTask: "Find price and summarize." },
      serviceRequirements: [
        { service: "web_search" as const, executionOrder: 1, rationale: "search", canParallelize: true, budgetWeight: 0.5 },
        { service: "market_data" as const, executionOrder: 1, rationale: "data", canParallelize: true, budgetWeight: 1.0 },
        { service: "summarization" as const, executionOrder: 2, rationale: "summary", canParallelize: false, budgetWeight: 1.0 },
      ],
      serviceResults: [
        { service: "web_search" as const, allocatedBudget: 1.0, procurementResult: { selectedProvider: { id: "dataflow", name: "DataFlow", price: 0 } as any, decisionReasons: [] } },
        { service: "market_data" as const, allocatedBudget: 1.0, procurementResult: { selectedProvider: { id: "coingecko", name: "CoinGecko", price: 0 } as any, decisionReasons: [] } },
        { service: "summarization" as const, allocatedBudget: 1.0, procurementResult: { selectedProvider: { id: "dataflow", name: "DataFlow", price: 0 } as any, decisionReasons: [] } },
      ],
    };

    const execResult = await executePlan(plan as any, registry);
    assert.equal(execResult.status, "SUCCESS");
    assert.equal(callOrder.length, 3);
    // Order 2 (summarization) must be executed last
    assert.equal(callOrder[2], "summarization");
  });

  // 19. Existing budget guards remain intact
  it("19. Budget guard still blocks execution if selected provider price exceeds allocation", async () => {
    const registry = new AdapterRegistry();
    registry.register(new CoinGeckoAdapter("test-key"));

    const plan = {
      originalTask: "Find bitcoin price.",
      totalBudget: 1.0,
      totalAllocatedBudget: 1.0,
      estimatedTotalCost: 0,
      estimatedTotalSavings: 0,
      planRationale: "test",
      intent: { category: "market_comparison" as const, matchedKeywords: [], confidence: "high" as const, originalTask: "Find bitcoin price." },
      serviceRequirements: [
        { service: "market_data" as const, executionOrder: 1, rationale: "test", canParallelize: false, budgetWeight: 1.0 },
      ],
      serviceResults: [
        {
          service: "market_data" as const,
          allocatedBudget: 0.05, // very low allocation
          procurementResult: {
            selectedProvider: {
              id: "coingecko",
              name: "CoinGecko",
              price: 0.1, // provider cost exceeds allocation
            } as any,
            decisionReasons: [],
          },
        },
      ],
    };

    const execResult = await executePlan(plan as any, registry);
    assert.equal(execResult.status, "EXECUTION_BUDGET_EXCEEDED");
    assert.equal(execResult.serviceExecutions.length, 1);
    assert.equal(execResult.serviceExecutions[0]?.status, "EXECUTION_BUDGET_EXCEEDED");
  });

  // 20. Planner remains unchanged
  it("20. Core planning rules remain unchanged and planning works normally", () => {
    const result = planTask(
      { task: "Translate this French document to English.", totalBudget: 1.0, priority: "balanced" },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.plan?.intent.category, "translate_only");
    assert.equal(result.plan?.serviceRequirements[0]?.service, "translation");
  });
});
