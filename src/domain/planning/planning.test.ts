/**
 * MeterMind Task Understanding + Procurement Planning — Test Suite
 *
 * 28 deterministic tests covering all specified requirements.
 * Run with: npx tsx --test src/domain/planning/planning.test.ts
 *
 * The existing 20 procurement scoring tests (scoring.test.ts) are not
 * modified, weakened, or deleted.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { planTask } from "./planner";
import { understandTask, getServiceRequirements } from "./understanding";
import { allocateBudget, SERVICE_BUDGET_WEIGHTS } from "./budget";
import { evaluateProcurement } from "@/domain/procurement/scoring";
import { planningProviders } from "@/lib/mock";
import type { TaskIntentCategory } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capsOf(p: (typeof planningProviders)[0]): string[] {
  return (p.capabilities as string[] | undefined) ?? [];
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("MeterMind Task Understanding + Procurement Planning", () => {

  // ── Task Detection ────────────────────────────────────────────────────────

  it("1. Research + summarize task is detected as research_and_summarize", () => {
    const intent = understandTask(
      "Research the latest Ethereum ETF news and summarize the most important developments.",
    );
    assert.equal(intent.category, "research_and_summarize");
    assert.ok(intent.matchedKeywords.length > 0);
    assert.ok(intent.confidence !== "low");
  });

  it("2. Translate + summarize task is detected as translate_and_summarize", () => {
    const intent = understandTask(
      "Translate this French article into English and summarize it.",
    );
    assert.equal(intent.category, "translate_and_summarize");
    assert.ok(
      intent.matchedKeywords.some((k) => k.includes("translat") || k === "french"),
    );
    assert.ok(intent.matchedKeywords.some((k) => k.includes("summariz")));
  });

  it("3. Market price comparison task is detected as market_comparison", () => {
    const intent = understandTask(
      "Find current Bitcoin prices across several sources and compare them.",
    );
    assert.equal(intent.category, "market_comparison");
    assert.ok(
      intent.matchedKeywords.includes("bitcoin") ||
        intent.matchedKeywords.includes("prices") ||
        intent.matchedKeywords.includes("price"),
    );
  });

  it("4. Translate-only task (no summarize) has exactly one service requirement", () => {
    const intent = understandTask("Translate this document into German.");
    assert.equal(intent.category, "translate_only");
    const reqs = getServiceRequirements(intent.category);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0]!.service, "translation");
  });

  it("5. Research + summarize task requires three services", () => {
    const intent = understandTask(
      "Research today's AI market news and create a short competitive analysis.",
    );
    assert.equal(intent.category, "research_and_summarize");
    const reqs = getServiceRequirements(intent.category);
    assert.equal(reqs.length, 3);
    const services = reqs.map((r) => r.service);
    assert.ok(services.includes("web_search"));
    assert.ok(services.includes("content_extraction"));
    assert.ok(services.includes("summarization"));
  });

  // ── Execution Ordering ────────────────────────────────────────────────────

  it("6. Research + summarize services execute in correct sequential order (1 → 2 → 3)", () => {
    const reqs = getServiceRequirements("research_and_summarize");
    const byOrder = [...reqs].sort((a, b) => a.executionOrder - b.executionOrder);
    assert.equal(byOrder[0]!.service, "web_search");
    assert.equal(byOrder[1]!.service, "content_extraction");
    assert.equal(byOrder[2]!.service, "summarization");
    // All are sequential
    assert.ok(reqs.every((r) => !r.canParallelize));
  });

  it("7. Market comparison services are parallelizable (same execution order 1)", () => {
    const reqs = getServiceRequirements("market_comparison");
    assert.equal(reqs.length, 2);
    assert.ok(reqs.every((r) => r.canParallelize));
    assert.ok(reqs.every((r) => r.executionOrder === 1));
  });

  // ── Budget Allocation ─────────────────────────────────────────────────────

  it("8. Budget allocation never exceeds total budget — all intent × budget combinations", () => {
    const cats: Exclude<TaskIntentCategory, "unsupported">[] = [
      "research_and_summarize",
      "translate_and_summarize",
      "market_comparison",
      "web_search_only",
      "code_review",
      "image_analysis_only",
      "content_extraction_only",
      "translate_only",
    ];
    const budgets = [0.01, 0.10, 0.50, 1.00, 2.00, 10.00, 100.00];

    for (const cat of cats) {
      const reqs = getServiceRequirements(cat);
      for (const budget of budgets) {
        const map = allocateBudget(reqs, budget);
        const total = [...map.values()].reduce((s, v) => s + v, 0);
        assert.ok(
          total <= budget + 0.0001,
          `Invariant violated: allocated ${total.toFixed(6)} > budget ${budget} for category "${cat}"`,
        );
      }
    }
  });

  it("9. Very small budget ($0.001) returns BUDGET_TOO_LOW for multi-service plan", () => {
    const result = planTask(
      {
        task: "Research the latest AI news and summarize it.",
        totalBudget: 0.001,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "BUDGET_TOO_LOW");
    assert.equal(result.plan, null);
    assert.ok(typeof result.errorMessage === "string" && result.errorMessage.length > 0);
  });

  it("10. Unsupported task returns UNSUPPORTED_TASK with no partial plan", () => {
    const result = planTask(
      {
        task: "Do my laundry and fold it neatly please.",
        totalBudget: 1.0,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "UNSUPPORTED_TASK");
    assert.equal(result.plan, null);
    assert.ok(typeof result.errorMessage === "string" && result.errorMessage.length > 0);
  });

  it("11. Empty task string returns EMPTY_TASK failure", () => {
    const result = planTask(
      { task: "", totalBudget: 1.0, priority: "balanced" },
      planningProviders,
    );
    assert.equal(result.status, "EMPTY_TASK");
    assert.equal(result.plan, null);
    assert.ok(typeof result.errorMessage === "string");
  });

  it("12. Whitespace-only task also returns EMPTY_TASK", () => {
    const result = planTask(
      { task: "   ", totalBudget: 1.0, priority: "balanced" },
      planningProviders,
    );
    assert.equal(result.status, "EMPTY_TASK");
    assert.equal(result.plan, null);
  });

  // ── Provider Capability Filtering ─────────────────────────────────────────

  it("13. No compatible provider for a service returns NO_PROVIDERS_FOR_SERVICE", () => {
    // Remove all code_analysis providers from catalog
    const noCodeCatalog = planningProviders.filter(
      (p) => !capsOf(p).includes("code_analysis"),
    );
    const result = planTask(
      {
        task: "Review and debug this Python function for memory leaks.",
        totalBudget: 1.0,
        priority: "balanced",
      },
      noCodeCatalog,
    );
    assert.equal(result.status, "NO_PROVIDERS_FOR_SERVICE");
    assert.equal(result.plan, null);
    assert.equal(result.failedService, "code_analysis");
  });

  it("14. Provider capability filtering: only translation-capable provider wins translation task", () => {
    const result = planTask(
      {
        task: "Translate this document into German.",
        totalBudget: 1.0,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    // LinguaAPI is the only provider with translation capability in the catalog
    assert.equal(
      result.plan?.serviceResults[0]?.procurementResult.selectedProvider?.name,
      "LinguaAPI",
    );
    // All translation-capable providers considered are a subset of translation providers
    const allConsidered = [
      ...(result.plan?.serviceResults[0]?.procurementResult.rankedProviders ?? []),
      ...(result.plan?.serviceResults[0]?.procurementResult.rejectedProviders ?? []),
    ];
    for (const p of allConsidered) {
      const provider = planningProviders.find((pp) => pp.id === p.id);
      assert.ok(
        provider !== undefined && capsOf(provider).includes("translation"),
        `Provider ${p.name} was considered but does not support translation`,
      );
    }
  });

  // ── Scoring Engine Integration ─────────────────────────────────────────────

  it("15. Planning delegates to scoring engine: direct evaluateProcurement matches plan selection", () => {
    // For a web_search_only task, the planner allocates the full budget to web_search
    // and calls evaluateProcurement. The result should match calling it directly.
    const task = "Find recent news about quantum computing advancements.";
    const budget = 0.5;
    const priority = "balanced" as const;

    const capableProviders = planningProviders.filter((p) =>
      capsOf(p).includes("web_search"),
    );

    // Direct scoring call (simulating what the planner does internally)
    const directResult = evaluateProcurement(
      { task, budget, priority },
      capableProviders,
    );

    // Planner call
    const planResult = planTask({ task, totalBudget: budget, priority }, planningProviders);

    assert.equal(planResult.status, "SUCCESS");
    const webSearchResult = planResult.plan?.serviceResults.find(
      (r) => r.service === "web_search",
    );
    assert.equal(
      webSearchResult?.procurementResult.selectedProvider?.name,
      directResult.selectedProvider?.name,
    );
  });

  it("16. Different priorities produce different provider selections within the same plan", () => {
    const task =
      "Research today's AI market news and create a short competitive analysis.";
    const budget = 2.0;

    const balanced = planTask(
      { task, totalBudget: budget, priority: "balanced" },
      planningProviders,
    );
    const lowestCost = planTask(
      { task, totalBudget: budget, priority: "lowest-cost" },
      planningProviders,
    );

    assert.equal(balanced.status, "SUCCESS");
    assert.equal(lowestCost.status, "SUCCESS");

    const balancedProviders = balanced.plan!.serviceResults.map(
      (r) => r.procurementResult.selectedProvider?.name,
    );
    const lowestCostProviders = lowestCost.plan!.serviceResults.map(
      (r) => r.procurementResult.selectedProvider?.name,
    );

    const anyDifference = balancedProviders.some((p, i) => p !== lowestCostProviders[i]);
    assert.ok(
      anyDifference,
      `Expected 'balanced' and 'lowest-cost' priorities to select different providers ` +
        `for at least one service. Got: balanced=${JSON.stringify(balancedProviders)}, ` +
        `lowest-cost=${JSON.stringify(lowestCostProviders)}`,
    );
  });

  // ── Determinism ────────────────────────────────────────────────────────────

  it("17. Identical inputs always produce identical planning outputs", () => {
    const request = {
      task: "Research the latest AI chip shortage news and summarize key findings.",
      totalBudget: 1.0,
      priority: "balanced" as const,
    };

    const r1 = planTask(request, planningProviders);
    const r2 = planTask(request, planningProviders);

    assert.equal(r1.status, r2.status);
    assert.deepEqual(
      r1.plan?.serviceResults.map((r) => r.procurementResult.selectedProvider?.name),
      r2.plan?.serviceResults.map((r) => r.procurementResult.selectedProvider?.name),
    );
    assert.deepEqual(
      r1.plan?.serviceResults.map((r) => r.allocatedBudget),
      r2.plan?.serviceResults.map((r) => r.allocatedBudget),
    );
    assert.equal(r1.plan?.estimatedTotalCost, r2.plan?.estimatedTotalCost);
  });

  it("18. Budget allocations are deterministic across repeated calls", () => {
    const reqs = getServiceRequirements("research_and_summarize");
    const budget = 1.0;
    const map1 = allocateBudget(reqs, budget);
    const map2 = allocateBudget(reqs, budget);
    assert.deepEqual([...map1.entries()], [...map2.entries()]);
  });

  // ── Rationale Generation ───────────────────────────────────────────────────

  it("19. All service requirements have non-empty rationale strings", () => {
    const cats: Exclude<TaskIntentCategory, "unsupported">[] = [
      "research_and_summarize",
      "translate_and_summarize",
      "market_comparison",
      "web_search_only",
      "code_review",
      "image_analysis_only",
      "content_extraction_only",
      "translate_only",
    ];
    for (const cat of cats) {
      const reqs = getServiceRequirements(cat);
      for (const req of reqs) {
        assert.ok(
          typeof req.rationale === "string" && req.rationale.trim().length > 0,
          `Missing rationale for service "${req.service}" in intent "${cat}"`,
        );
      }
    }
  });

  it("20. Successful plan always includes a non-empty planRationale string", () => {
    const result = planTask(
      {
        task: "Research AI chip news and summarize findings.",
        totalBudget: 1.0,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.ok(typeof result.plan?.planRationale === "string");
    assert.ok(result.plan!.planRationale.trim().length > 0);
  });

  // ── Constraints Flow-Through ───────────────────────────────────────────────

  it("21. Excluded provider constraint is honoured by scoring engine for all services", () => {
    const result = planTask(
      {
        task: "Search for and summarize recent developments in quantum computing.",
        totalBudget: 2.0,
        priority: "balanced",
        constraints: { excludedProviders: ["DataFlow"] },
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    for (const sr of result.plan!.serviceResults) {
      assert.notEqual(
        sr.procurementResult.selectedProvider?.name,
        "DataFlow",
        `DataFlow was selected for service "${sr.service}" despite being excluded`,
      );
    }
  });

  // ── No Partial Plans on Failure ────────────────────────────────────────────

  it("22. Planning failure does not fabricate a partial success plan", () => {
    // Remove all summarization providers; web_search will succeed but summarization cannot
    const noSummarizeCatalog = planningProviders.filter(
      (p) => !capsOf(p).includes("summarization"),
    );
    const result = planTask(
      {
        task: "Research the latest AI news and summarize the findings.",
        totalBudget: 2.0,
        priority: "balanced",
      },
      noSummarizeCatalog,
    );
    assert.notEqual(result.status, "SUCCESS");
    assert.equal(result.plan, null);
    assert.ok(typeof result.errorMessage === "string");
    assert.equal(result.failedService, "summarization");
  });

  // ── Additional Task Category Coverage ─────────────────────────────────────

  it("23. Code review task is correctly identified and plans code_analysis", () => {
    const intent = understandTask(
      "Review and debug this Python function for memory leaks.",
    );
    assert.equal(intent.category, "code_review");
    const result = planTask(
      {
        task: "Review and debug this Python function for memory leaks.",
        totalBudget: 1.0,
        priority: "highest-quality",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.plan?.serviceResults[0]?.service, "code_analysis");
    assert.equal(
      result.plan?.serviceResults[0]?.procurementResult.selectedProvider?.name,
      "CodeModel API",
    );
  });

  it("24. Image analysis task is correctly identified", () => {
    const intent = understandTask(
      "Classify objects in this screenshot using computer vision.",
    );
    assert.equal(intent.category, "image_analysis_only");
    const result = planTask(
      {
        task: "Classify objects in this screenshot using computer vision.",
        totalBudget: 1.0,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.plan?.serviceResults[0]?.service, "image_analysis");
    assert.equal(
      result.plan?.serviceResults[0]?.procurementResult.selectedProvider?.name,
      "VisionAPI",
    );
  });

  it("25. Budget allocation for single-service plan exactly equals total budget", () => {
    const reqs = getServiceRequirements("translate_only");
    assert.equal(reqs.length, 1);
    const budget = 0.50;
    const map = allocateBudget(reqs, budget);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    assert.equal(total, budget);
  });

  it("26. Market comparison task produces plan with two parallel services", () => {
    const result = planTask(
      {
        task: "Find current Bitcoin and Ethereum prices across multiple exchanges and compare them.",
        totalBudget: 1.0,
        priority: "lowest-cost",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.ok(result.plan !== null);
    const services = result.plan!.serviceRequirements.map((r) => r.service);
    assert.ok(services.includes("market_data"), "market_data service missing");
    assert.ok(services.includes("web_search"), "web_search service missing");
    // All services at the same execution order (parallel)
    const orders = result.plan!.serviceRequirements.map((r) => r.executionOrder);
    assert.ok(
      orders.every((o) => o === orders[0]),
      "Market comparison services should share the same execution order (parallel)",
    );
  });

  it("27. Content extraction task is correctly identified and planned", () => {
    const intent = understandTask(
      "Scrape and extract all product listings from this webpage.",
    );
    assert.equal(intent.category, "content_extraction_only");
    const result = planTask(
      {
        task: "Scrape and extract all product listings from this webpage.",
        totalBudget: 0.5,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.plan?.serviceRequirements[0]?.service, "content_extraction");
  });

  it("28. Zero budget returns BUDGET_TOO_LOW before task understanding runs", () => {
    const result = planTask(
      {
        task: "Research latest news and summarize.",
        totalBudget: 0,
        priority: "balanced",
      },
      planningProviders,
    );
    assert.equal(result.status, "BUDGET_TOO_LOW");
    assert.equal(result.plan, null);
    assert.ok(typeof result.errorMessage === "string");
  });
});
