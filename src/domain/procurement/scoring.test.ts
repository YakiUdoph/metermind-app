import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateProcurement } from "./scoring";
import { demoProviders } from "@/lib/mock";
import type { Provider } from "@/lib/mock";

describe("MeterMind Dynamic Procurement Engine Hardening Suite", () => {
  const baseTask = "Research today's AI market news and create a short competitive analysis.";

  it("1. Balanced priority selects best overall value (DataFlow)", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "DataFlow");
    assert.ok(result.decisionReasons.length > 0);
  });

  it("2. Lowest Cost priority selects cheapest qualified provider (QuickSearch)", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "lowest-cost" },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "QuickSearch");
    assert.equal(result.selectedCost, 0.02);
  });

  it("3. Highest Quality priority selects highest quality provider (SearchX)", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "highest-quality" },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "SearchX");
    assert.equal(result.selectedProvider?.quality, 96);
  });

  it("4. Fastest priority selects lowest latency provider (QuickSearch)", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "fastest" },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "QuickSearch");
    assert.equal(result.selectedProvider?.latency, 310);
  });

  it("5. Reliability constraint (>=95%) rejects QuickSearch (88.2%)", () => {
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 2.0,
        priority: "lowest-cost",
        constraints: { minimumReliability: 95 },
      },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.notEqual(result.selectedProvider?.name, "QuickSearch");
    assert.equal(result.selectedProvider?.name, "DataFlow");
    assert.ok(result.rejectedProviders.some((p) => p.name === "QuickSearch"));
  });

  it("6. Budget constraint ($0.03) rejects providers above budget", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 0.03, priority: "balanced" },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "QuickSearch");
    assert.equal(result.rejectedProviders.length, 3);
  });

  it("7. Excluded provider (DataFlow) cannot win", () => {
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 2.0,
        priority: "balanced",
        constraints: { excludedProviders: ["DataFlow"] },
      },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.notEqual(result.selectedProvider?.name, "DataFlow");
    assert.ok(result.rejectedProviders.some((p) => p.name === "DataFlow"));
  });

  it("8. No compatible providers returns typed failure", () => {
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 0.01,
        priority: "balanced",
      },
      demoProviders,
    );
    assert.equal(result.status, "BUDGET_TOO_LOW");
    assert.equal(result.selectedProvider, null);
    assert.ok(result.errorMessage !== undefined);
  });

  it("9. Savings calculation is mathematically correct", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    assert.ok(result.estimatedSavings! >= 0);
    assert.equal(
      result.estimatedSavings,
      Math.max(0, Number((result.estimatedComparableCost - result.selectedCost!).toFixed(3))),
    );
  });

  it("10. Ranking is 100% deterministic", () => {
    const result1 = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    const result2 = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    assert.deepEqual(
      result1.rankedProviders.map((p) => p.name),
      result2.rankedProviders.map((p) => p.name),
    );
  });

  it("11. Ranking does not change merely because budget increases when candidate set remains identical", () => {
    const resLowBudget = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    const resHighBudget = evaluateProcurement(
      { task: baseTask, budget: 10.0, priority: "balanced" },
      demoProviders,
    );
    assert.deepEqual(
      resLowBudget.rankedProviders.map((p) => p.name),
      resHighBudget.rankedProviders.map((p) => p.name),
    );
    assert.equal(resLowBudget.selectedProvider?.name, resHighBudget.selectedProvider?.name);
  });

  it("12. Equal-price providers do not produce NaN or divide-by-zero", () => {
    const equalPriceCatalog: Provider[] = [
      { id: "p1", name: "Provider 1", category: "Search", price: 0.05, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [90] },
      { id: "p2", name: "Provider 2", category: "Search", price: 0.05, quality: 85, reliability: 95, latency: 450, score: 85, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [85] },
    ];
    const result = evaluateProcurement(
      { task: baseTask, budget: 1.0, priority: "balanced" },
      equalPriceCatalog,
    );
    assert.equal(result.status, "SUCCESS");
    assert.ok(!Number.isNaN(result.rankedProviders[0]?.priceScore));
    assert.equal(result.rankedProviders[0]?.priceScore, 100);
    assert.equal(result.rankedProviders[1]?.priceScore, 100);
  });

  it("13. Equal-latency providers do not produce NaN or divide-by-zero", () => {
    const equalLatencyCatalog: Provider[] = [
      { id: "p1", name: "Provider 1", category: "Search", price: 0.04, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.04], qualityHistory: [90] },
      { id: "p2", name: "Provider 2", category: "Search", price: 0.05, quality: 85, reliability: 95, latency: 400, score: 85, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [85] },
    ];
    const result = evaluateProcurement(
      { task: baseTask, budget: 1.0, priority: "fastest" },
      equalLatencyCatalog,
    );
    assert.equal(result.status, "SUCCESS");
    assert.ok(!Number.isNaN(result.rankedProviders[0]?.latencyScore));
    assert.equal(result.rankedProviders[0]?.latencyScore, 100);
    assert.equal(result.rankedProviders[1]?.latencyScore, 100);
  });

  it("14. Preferred provider receives bounded soft preference (+3 points)", () => {
    const catalog: Provider[] = [
      { id: "p1", name: "Provider A", category: "Search", price: 0.05, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [90] },
      { id: "p2", name: "Provider B", category: "Search", price: 0.05, quality: 89, reliability: 98, latency: 400, score: 89, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [89] },
    ];
    // Provider B has slightly lower quality (89 vs 90), but preferred status gives +3 bonus so Provider B wins
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 1.0,
        priority: "balanced",
        constraints: { preferredProviders: ["p2"] },
      },
      catalog,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.id, "p2");
  });

  it("15. Preferred provider still loses if materially worse under chosen priority", () => {
    const catalog: Provider[] = [
      { id: "p1", name: "Provider High", category: "Search", price: 0.05, quality: 98, reliability: 99, latency: 400, score: 98, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [98] },
      { id: "p2", name: "Provider Low", category: "Search", price: 0.05, quality: 70, reliability: 80, latency: 400, score: 70, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [70] },
    ];
    // Provider Low is preferred (+3), but its quality (70 vs 98) is materially worse so High Quality priority picks Provider High
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 1.0,
        priority: "highest-quality",
        constraints: { preferredProviders: ["p2"] },
      },
      catalog,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.id, "p1");
  });

  it("16. Comparable cost uses best qualified alternative, not simply most expensive provider", () => {
    const result = evaluateProcurement(
      { task: baseTask, budget: 2.0, priority: "balanced" },
      demoProviders,
    );
    // DataFlow ($0.04) wins under Balanced. Next-best qualified alternative in ranked list is SearchX ($0.08) or ResearchAPI ($0.06).
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "DataFlow");
    assert.ok(result.comparisonProvider !== undefined);
    assert.equal(result.estimatedComparableCost, result.rankedProviders[1]?.price);
  });

  it("17. Single qualified provider returns zero estimated savings", () => {
    const singleCatalog: Provider[] = [
      { id: "only", name: "SoloProvider", category: "Search", price: 0.05, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [90] },
    ];
    const result = evaluateProcurement(
      { task: baseTask, budget: 1.0, priority: "balanced" },
      singleCatalog,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.selectedProvider?.name, "SoloProvider");
    assert.equal(result.comparisonProvider, undefined);
    assert.equal(result.estimatedSavings, 0);
    assert.equal(result.estimatedComparableCost, 0.05);
  });

  it("18. Tie-breaking is 100% deterministic across identical score objects", () => {
    const identicalCatalog: Provider[] = [
      { id: "beta", name: "Beta Corp", category: "Search", price: 0.05, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [90] },
      { id: "alpha", name: "Alpha Corp", category: "Search", price: 0.05, quality: 90, reliability: 98, latency: 400, score: 90, jobs: 100, failed: 1, spend: 5, trend: 0, assessment: "", priceHistory: [0.05], qualityHistory: [90] },
    ];
    const result = evaluateProcurement(
      { task: baseTask, budget: 1.0, priority: "balanced" },
      identicalCatalog,
    );
    assert.equal(result.status, "SUCCESS");
    // Tie breaker stage 6 (alphabetical id) picks alpha before beta
    assert.equal(result.selectedProvider?.id, "alpha");
  });

  it("19. INVALID_REQUEST is explicitly tested", () => {
    const resEmptyTask = evaluateProcurement({ task: "", budget: 1.0, priority: "balanced" }, demoProviders);
    assert.equal(resEmptyTask.status, "INVALID_REQUEST");
    assert.ok(resEmptyTask.errorMessage !== undefined);

    const resBadBudget = evaluateProcurement({ task: baseTask, budget: -5, priority: "balanced" }, demoProviders);
    assert.equal(resBadBudget.status, "BUDGET_TOO_LOW");
  });

  it("20. Minimum quality constraint is explicitly tested", () => {
    const result = evaluateProcurement(
      {
        task: baseTask,
        budget: 2.0,
        priority: "lowest-cost",
        constraints: { minimumQuality: 95 },
      },
      demoProviders,
    );
    assert.equal(result.status, "SUCCESS");
    // SearchX is Q96. DataFlow is Q94, QuickSearch is Q71, ResearchAPI is Q91. So SearchX wins!
    assert.equal(result.selectedProvider?.name, "SearchX");
    assert.ok(result.rejectedProviders.some((p) => p.name === "DataFlow"));
    assert.ok(result.rejectedProviders.some((p) => p.name === "QuickSearch"));
  });
});
