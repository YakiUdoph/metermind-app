/**
 * MeterMind Planning Domain — Task Understanding
 *
 * Deterministic keyword/pattern classifier. No ML, no external services.
 * Given a natural-language task description, produces a TaskIntent and the
 * corresponding ServiceRequirement array.
 *
 * Pattern rules are ordered by specificity (most specific compound intents first).
 * All matching is substring-based on the lowercased task text.
 */

import type { TaskIntent, TaskIntentCategory, ServiceRequirement } from "./types";
import type { ProcurementRequest } from "../procurement/procurement-engine-types";
import type { ProcurementPriority } from "../procurement/types";

// ---------------------------------------------------------------------------
// Keyword sets
// ---------------------------------------------------------------------------

/** Matches translation-related terms (prefix "translat" catches translate/translation/translated). */
const TRANSLATE_KEYWORDS = [
  "translat",
  "french",
  "spanish",
  "german",
  "japanese",
  "chinese",
  "korean",
  "arabic",
  "portuguese",
  "italian",
  "russian",
  "multilingual",
  "into english",
  "into spanish",
  "into french",
  "into german",
] as const;

/** Matches summarize/summarise/summary requests. Deliberately excludes "compare"/"analysis". */
const SUMMARIZE_KEYWORDS = [
  "summariz",
  "summarise",
  "summary",
  "brief",
  "briefing",
  "digest",
  "overview",
  "tldr",
  "tl;dr",
  "highlight",
  "key points",
  "main points",
  "takeaway",
] as const;

/** Matches analytical output requests (treated as a summarization signal). */
const ANALYZE_KEYWORDS = [
  "analyz",
  "analyse",
  "analysis",
  "competitive analysis",
  "break down",
  "breakdown",
] as const;

/** Matches research / news / current-events signals. */
const RESEARCH_KEYWORDS = [
  "research",
  "news",
  "articles",
  "article",
  "latest",
  "recent",
  "current",
  "today",
  "report",
  "reports",
  "developments",
  "development",
] as const;

/** Matches paid/premium execution signals. */
const PAID_KEYWORDS = [
  "paid",
  "premium",
  "paid_research",
  "paid research",
  "expensive research",
] as const;

/** Matches market / financial / crypto price signals. */
const MARKET_KEYWORDS = [
  "prices",
  "price",
  "bitcoin",
  "ethereum",
  "btc",
  "eth",
  "crypto",
  "cryptocurrency",
  "token",
  "stock",
  "shares",
  "forex",
  "trading",
  "exchange rate",
  "market cap",
  "financial data",
  "market data",
] as const;

/** Matches code-related tasks. */
const CODE_KEYWORDS = [
  "code",
  "program",
  "debug",
  " bug ",
  "refactor",
  "function",
  " class ",
  "algorithm",
  "software",
  "script",
  "repository",
  "commit",
  "pull request",
  "syntax error",
  "review code",
] as const;

/** Matches image / vision tasks. */
const IMAGE_KEYWORDS = [
  "image",
  "photo",
  "picture",
  "vision",
  "visual",
  "screenshot",
  "classify",
  "object detect",
  "ocr",
  "diagram",
] as const;

/** Matches content extraction / scraping tasks. */
const EXTRACT_KEYWORDS = [
  "extract",
  "scrape",
  "crawl",
  "parse webpage",
  "fetch url",
  "webpage content",
  "website content",
  "html content",
] as const;

/** Matches general web search / lookup tasks. */
const SEARCH_KEYWORDS = [
  "search",
  "find",
  "look up",
  "lookup",
  "discover",
  "locate",
  "what is",
  "who is",
  "where is",
  "when did",
  "how to",
  "how do",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findMatches(normalized: string, keywords: readonly string[]): string[] {
  return keywords.filter((kw) => normalized.includes(kw));
}

// ---------------------------------------------------------------------------
// Service requirement definitions per intent
// ---------------------------------------------------------------------------

/**
 * Maps each supported TaskIntentCategory to an ordered array of ServiceRequirements.
 * Services sharing the same executionOrder may run in parallel.
 */
const INTENT_SERVICE_MAP: Record<
  Exclude<TaskIntentCategory, "unsupported">,
  readonly ServiceRequirement[]
> = {
  research_and_summarize: [
    {
      service: "web_search",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Web search is required to find relevant source articles and information.",
      budgetWeight: 0.30,
    },
    {
      service: "content_extraction",
      executionOrder: 2,
      canParallelize: false,
      rationale:
        "Content extraction retrieves the full text from discovered pages for downstream processing.",
      budgetWeight: 0.20,
    },
    {
      service: "summarization",
      executionOrder: 3,
      canParallelize: false,
      rationale:
        "Summarization condenses the extracted content into the requested deliverable.",
      budgetWeight: 0.25,
    },
  ],

  translate_and_summarize: [
    {
      service: "translation",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Translation converts the source content into the target language first.",
      budgetWeight: 0.35,
    },
    {
      service: "summarization",
      executionOrder: 2,
      canParallelize: false,
      rationale:
        "Summarization condenses the translated content into the requested briefing.",
      budgetWeight: 0.25,
    },
  ],

  market_comparison: [
    {
      service: "market_data",
      executionOrder: 1,
      canParallelize: true,
      rationale:
        "Market data providers retrieve real-time or near-real-time pricing from exchanges.",
      budgetWeight: 0.30,
    },
    {
      service: "web_search",
      executionOrder: 1,
      canParallelize: true,
      rationale:
        "Web search supplements market data with news, context, and additional sources.",
      budgetWeight: 0.30,
    },
  ],

  web_search_only: [
    {
      service: "web_search",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "This task requires finding specific information on the web.",
      budgetWeight: 0.30,
    },
  ],

  code_review: [
    {
      service: "code_analysis",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Code analysis models review, debug, and refactor source code.",
      budgetWeight: 0.40,
    },
  ],

  image_analysis_only: [
    {
      service: "image_analysis",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Image analysis models process, classify, and extract information from visual content.",
      budgetWeight: 0.35,
    },
  ],

  content_extraction_only: [
    {
      service: "content_extraction",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Content extraction retrieves structured data from web pages or documents.",
      budgetWeight: 0.20,
    },
  ],

  translate_only: [
    {
      service: "translation",
      executionOrder: 1,
      canParallelize: false,
      rationale:
        "Translation converts content from the source language to the target language.",
      budgetWeight: 0.35,
    },
  ],

  paid_research: [
    {
      service: "paid_research",
      executionOrder: 1,
      canParallelize: false,
      rationale: "Requires paid research on the selected network.",
      budgetWeight: 1.0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a natural-language task into a TaskIntent using ordered keyword rules.
 *
 * Rules are evaluated in precedence order (most specific compound intents first):
 *  1. translate + summarize/analyze → translate_and_summarize
 *  2. research/search + summarize/analyze → research_and_summarize
 *  3. market/price/crypto keywords → market_comparison
 *  4. translate keywords → translate_only
 *  5. code keywords → code_review
 *  6. image/vision keywords → image_analysis_only
 *  7. extract/scrape keywords → content_extraction_only
 *  8. search/find keywords → web_search_only
 *  9. no match → unsupported
 *
 * Output is fully deterministic for a given input string.
 */
export function understandTask(task: string): TaskIntent {
  if (!task || !task.trim()) {
    return {
      originalTask: task,
      category: "unsupported",
      matchedKeywords: [],
      confidence: "low",
    };
  }

  const normalized = ` ${task.toLowerCase()} `;

  const matchedTranslate = findMatches(normalized, TRANSLATE_KEYWORDS);
  const matchedSummarize = findMatches(normalized, [
    ...SUMMARIZE_KEYWORDS,
    ...ANALYZE_KEYWORDS,
  ]);
  const matchedResearch = findMatches(normalized, RESEARCH_KEYWORDS);
  const matchedMarket = findMatches(normalized, MARKET_KEYWORDS);
  const matchedCode = findMatches(normalized, CODE_KEYWORDS);
  const matchedImage = findMatches(normalized, IMAGE_KEYWORDS);
  const matchedExtract = findMatches(normalized, EXTRACT_KEYWORDS);
  const matchedSearch = findMatches(normalized, SEARCH_KEYWORDS);
  const matchedPaid = findMatches(normalized, PAID_KEYWORDS);

  // Rule 0: paid research (extremely specific)
  if (matchedPaid.length > 0) {
    return {
      originalTask: task,
      category: "paid_research",
      matchedKeywords: matchedPaid,
      confidence: "high",
    };
  }

  // Rule 1: translate + summarize/analyze (most specific compound)
  if (matchedTranslate.length > 0 && matchedSummarize.length > 0) {
    return {
      originalTask: task,
      category: "translate_and_summarize",
      matchedKeywords: [...matchedTranslate, ...matchedSummarize],
      confidence: "high",
    };
  }

  // Rule 2: research/search + summarize/analyze
  if (
    (matchedResearch.length > 0 || matchedSearch.length > 0) &&
    matchedSummarize.length > 0
  ) {
    return {
      originalTask: task,
      category: "research_and_summarize",
      matchedKeywords: [
        ...matchedResearch,
        ...matchedSearch,
        ...matchedSummarize,
      ],
      confidence: matchedResearch.length > 0 ? "high" : "medium",
    };
  }

  // Rule 3: market / price / crypto signals
  if (matchedMarket.length > 0) {
    return {
      originalTask: task,
      category: "market_comparison",
      matchedKeywords: matchedMarket,
      confidence: matchedMarket.length >= 2 ? "high" : "medium",
    };
  }

  // Rule 4: translate only (no summarize)
  if (matchedTranslate.length > 0) {
    return {
      originalTask: task,
      category: "translate_only",
      matchedKeywords: matchedTranslate,
      confidence: "medium",
    };
  }

  // Rule 5: code review / analysis
  if (matchedCode.length > 0) {
    return {
      originalTask: task,
      category: "code_review",
      matchedKeywords: matchedCode,
      confidence: matchedCode.length >= 2 ? "high" : "medium",
    };
  }

  // Rule 6: image / vision analysis
  if (matchedImage.length > 0) {
    return {
      originalTask: task,
      category: "image_analysis_only",
      matchedKeywords: matchedImage,
      confidence: "medium",
    };
  }

  // Rule 7: content extraction / scraping
  if (matchedExtract.length > 0) {
    return {
      originalTask: task,
      category: "content_extraction_only",
      matchedKeywords: matchedExtract,
      confidence: "medium",
    };
  }

  // Rule 8: web search / lookup
  if (matchedSearch.length > 0) {
    return {
      originalTask: task,
      category: "web_search_only",
      matchedKeywords: matchedSearch,
      confidence: "medium",
    };
  }

  // Rule 9: unsupported
  return {
    originalTask: task,
    category: "unsupported",
    matchedKeywords: [],
    confidence: "low",
  };
}

/**
 * Returns the ordered ServiceRequirements for a classified intent category.
 * Returns an empty array for "unsupported".
 */
export function getServiceRequirements(
  category: TaskIntentCategory,
  task?: string,
): readonly ServiceRequirement[] {
  if (category === "unsupported") return [];
  
  if (category === "market_comparison" && task) {
    const lower = task.toLowerCase();
    const needsResearch = [
      "news",
      "reason",
      "movement",
      "why",
      "research",
      "latest",
      "development",
      "explain",
      "explanation",
      "web",
      "source",
    ].some((kw) => lower.includes(kw));

    if (!needsResearch) {
      return [
        {
          service: "market_data",
          executionOrder: 1,
          canParallelize: false,
          rationale: "Market data providers retrieve real-time or near-real-time pricing from exchanges.",
          budgetWeight: 1.0,
        },
      ];
    }
  }

  return INTENT_SERVICE_MAP[category];
}

// ---------------------------------------------------------------------------
// Intent & Constraint Extraction Helpers
// ---------------------------------------------------------------------------

export function parseBudget(text: string): number | undefined {
  const lower = text.toLowerCase();
  
  const r3 = /(\d+(?:\.\d+)?)\s*cents?/;
  const m3 = lower.match(r3);
  if (m3 && m3[1]) return parseFloat(m3[1]) / 100;

  const r1 = /(?:under|maximum|max|don't spend more than|budget of)\s*\$?\s*(\d+(?:\.\d+)?)/;
  const m1 = lower.match(r1);
  if (m1 && m1[1]) return parseFloat(m1[1]);

  const r2 = /budget\s*:\s*\$?\s*(\d+(?:\.\d+)?)/;
  const m2 = lower.match(r2);
  if (m2 && m2[1]) return parseFloat(m2[1]);

  const r4 = /max\s+(\d+(?:\.\d+)?)/;
  const m4 = lower.match(r4);
  if (m4 && m4[1]) return parseFloat(m4[1]);

  return undefined;
}

export function parseLatency(text: string): number | undefined {
  const lower = text.toLowerCase();
  
  const r1 = /(?:under|maximum|max|max latency|latency under)\s*(\d+(?:\.\d+)?)\s*(ms|seconds?|sec?|s)/;
  const m1 = lower.match(r1);
  if (m1 && m1[1] && m1[2]) {
    const val = parseFloat(m1[1]);
    const unit = m1[2];
    if (unit.startsWith("ms")) return val;
    return val * 1000;
  }
  
  return undefined;
}

export function parseQuality(text: string): number | undefined {
  const lower = text.toLowerCase();
  
  const r1 = /(?:minimum quality|min quality|quality of|quality >=|quality at least)\s*(\d+)/;
  const m1 = lower.match(r1);
  if (m1 && m1[1]) return parseInt(m1[1], 10);
  
  return undefined;
}

export function parseReliability(text: string): number | undefined {
  const lower = text.toLowerCase();
  
  const r1 = /(?:minimum reliability|min reliability|reliability of|reliability >=|reliability at least)\s*(\d+)%?/;
  const m1 = lower.match(r1);
  if (m1 && m1[1]) return parseInt(m1[1], 10);
  
  return undefined;
}

export function parseExcludedProviders(text: string): string[] {
  const lower = text.toLowerCase();
  const list: string[] = [];
  
  const matches = lower.matchAll(/(?:don't use|do not use|exclude|except)\s+([\w_-]+)/g);
  for (const m of matches) {
    if (m[1]) list.push(m[1].trim());
  }
  
  return list;
}

export function parsePreferredProviders(text: string): string[] {
  const lower = text.toLowerCase();
  const list: string[] = [];
  
  const matches = lower.matchAll(/(?:prefer|preferred provider:?)\s+([\w_-]+)/g);
  for (const m of matches) {
    if (m[1]) list.push(m[1].trim());
  }
  
  return list;
}

export function parsePaymentPreference(text: string): "free-only" | "paid-allowed" | "any" {
  const lower = text.toLowerCase();
  if (
    lower.includes("free only") ||
    lower.includes("do not pay") ||
    lower.includes("free-only") ||
    lower.includes("without payment") ||
    lower.includes("free service") ||
    lower.includes("free only")
  ) {
    return "free-only";
  }
  if (lower.includes("paid allowed") || lower.includes("payment allowed")) {
    return "paid-allowed";
  }
  return "any";
}

export function parseFreshness(text: string): "live" | "static" | "any" {
  const lower = text.toLowerCase();
  if (
    lower.includes("live") ||
    lower.includes("real-time") ||
    lower.includes("realtime") ||
    lower.includes("current") ||
    lower.includes("latest") ||
    lower.includes("prices") ||
    lower.includes("price")
  ) {
    return "live";
  }
  if (lower.includes("static") || lower.includes("historical") || lower.includes("cached")) {
    return "static";
  }
  return "any";
}

export function parseNetwork(text: string): string | undefined {
  const lower = text.toLowerCase();
  
  const r1 = /network\s*:\s*([\w_-]+)/;
  const m1 = lower.match(r1);
  if (m1 && m1[1]) return m1[1].trim();

  const r2 = /on network\s+([\w_-]+)/;
  const m2 = lower.match(r2);
  if (m2 && m2[1]) return m2[1].trim();

  const r3 = /\bon\s+([\w_-]+)/;
  const m3 = lower.match(r3);
  if (m3 && m3[1]) {
    const val = m3[1].trim();
    if (val !== "time" && val !== "budget" && val !== "network") {
      return val;
    }
  }
  
  return undefined;
}

export function parseDeliveryCriteria(text: string): string | undefined {
  const lower = text.toLowerCase();
  
  const r1 = /contains\s*:\s*([\w_-]+)/;
  const m1 = lower.match(r1);
  if (m1 && m1[1]) return `contains:${m1[1]}`;
  
  const r2 = /must contain\s+(\w+)/;
  const m2 = lower.match(r2);
  if (m2 && m2[1]) return `contains:${m2[1]}`;
  
  return undefined;
}

export function parsePriority(text: string, defaultPriority: ProcurementPriority): ProcurementPriority {
  const lower = text.toLowerCase();
  if (lower.includes("cheapest") || lower.includes("lowest cost") || lower.includes("lowest price") || lower.includes("cheap")) {
    return "lowest-cost";
  }
  if (lower.includes("speed") || lower.includes("fastest") || lower.includes("latency")) {
    return "fastest";
  }
  if (lower.includes("highest quality") || lower.includes("best quality") || lower.includes("quality")) {
    return "highest-quality";
  }
  if (lower.includes("most reliable") || lower.includes("reliability")) {
    return "most-reliable";
  }
  return defaultPriority;
}

export function extractProcurementRequest(
  taskId: string,
  rawTask: string,
  defaultBudget: number,
  defaultPriority: ProcurementPriority
): ProcurementRequest {
  const parsedBudget = parseBudget(rawTask);
  const budget = parsedBudget !== undefined ? parsedBudget : defaultBudget;

  const parsedPriority = parsePriority(rawTask, defaultPriority);
  
  const intent = understandTask(rawTask);
  const serviceReqs = getServiceRequirements(intent.category, rawTask);
  const serviceCategories = serviceReqs.map(s => s.service);

  return {
    taskId,
    rawTask,
    serviceRequirements: serviceCategories,
    budget,
    currency: "USD",
    priority: parsedPriority,
    preferredProviders: parsePreferredProviders(rawTask),
    excludedProviders: parseExcludedProviders(rawTask),
    maxLatencyMs: parseLatency(rawTask),
    minimumQuality: parseQuality(rawTask),
    minimumReliability: parseReliability(rawTask),
    freshnessRequirement: parseFreshness(rawTask),
    networkRequirement: parseNetwork(rawTask),
    paymentPreference: parsePaymentPreference(rawTask),
    deliveryCriteria: parseDeliveryCriteria(rawTask)
  };
}
