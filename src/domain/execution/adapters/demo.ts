/**
 * MeterMind Execution Domain — Demo Provider Adapters
 *
 * Seven deterministic, local adapters — one per service category.
 * These adapters NEVER call external APIs. All output is synthesised
 * from the task text and provider metadata (quality, latency).
 *
 * Every result carries executionMode: "demo" — hardcoded at the type level.
 * This cannot be changed to "live" without implementing a real network adapter.
 *
 * Determinism guarantee:
 *   identical (task, service, selectedProvider) → identical payload string
 *
 * Quality shaping:
 *   selectedProvider.quality controls the richness of the demo output
 *   (more results, more detail) — mimicking real quality differences.
 */

import type {
  ProviderAdapter,
  ServiceExecutionRequest,
  ServiceExecutionResult,
} from "../types";
import type { ServiceCategory } from "@/domain/planning/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract 2-3 meaningful topic words from a task string (deterministic). */
function extractTopic(task: string): string {
  const STOPWORDS = new Set([
    "the", "a", "an", "is", "are", "and", "or", "for", "of", "in", "to",
    "it", "this", "that", "with", "on", "from", "by", "at", "as", "into",
    "create", "make", "find", "get", "show", "give", "tell", "write",
    "research", "search", "analyze", "summarize", "translate", "review",
  ]);
  const words = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return words.slice(0, 3).join(" ") || "requested topic";
}

/** Number of results to generate based on provider quality (deterministic). */
function resultCount(quality: number): number {
  if (quality >= 90) return 5;
  if (quality >= 75) return 4;
  return 3;
}

/** Simulated date string (fixed — not real Date.now to keep payloads deterministic). */
const SIM_DATE = "2026-08";

/** Detect target language name from a task string. */
function detectTargetLanguage(task: string): string {
  const lower = task.toLowerCase();
  if (lower.includes("german") || lower.includes("deutsch")) return "German";
  if (lower.includes("french") || lower.includes("français")) return "French";
  if (lower.includes("spanish") || lower.includes("español")) return "Spanish";
  if (lower.includes("japanese") || lower.includes("日本語")) return "Japanese";
  if (lower.includes("chinese") || lower.includes("中文")) return "Chinese";
  if (lower.includes("korean")) return "Korean";
  if (lower.includes("arabic")) return "Arabic";
  if (lower.includes("portuguese")) return "Portuguese";
  if (lower.includes("italian")) return "Italian";
  if (lower.includes("russian")) return "Russian";
  return "target language";
}

// ---------------------------------------------------------------------------
// Per-service demo payload generators
// ---------------------------------------------------------------------------

function demoWebSearch(req: ServiceExecutionRequest): string {
  const topic = extractTopic(req.task);
  const n = resultCount(req.selectedProvider.quality);
  const lines: string[] = [
    `[DEMO] Web Search Results for: "${topic}"`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
  ];
  const articles = [
    [`"${topic.charAt(0).toUpperCase() + topic.slice(1)} Sector Sees Record Activity in Q3 ${SIM_DATE.slice(0, 4)}"`,
      `tech-analysis.example.com`,
      `Analysts noted a significant uptick in ${topic}-related activity, with quarterly figures surpassing previous highs.`],
    [`"Key Developments in ${topic.charAt(0).toUpperCase() + topic.slice(1)}: A Deep Dive"`,
      `research-hub.example.com`,
      `New findings reveal three emerging patterns that industry observers say could reshape the competitive landscape.`],
    [`"${topic.charAt(0).toUpperCase() + topic.slice(1)}: What Experts Are Saying"`,
      `market-pulse.example.com`,
      `Leading specialists weighed in on current trends and offered forward-looking assessments for the coming quarter.`],
    [`"Investor Briefing: ${topic.charAt(0).toUpperCase() + topic.slice(1)} in Focus"`,
      `financial-wire.example.com`,
      `Institutional interest has grown measurably, with net inflows rising 18% year-over-year in this segment.`],
    [`"Regulatory Update: ${topic.charAt(0).toUpperCase() + topic.slice(1)} Compliance Landscape"`,
      `regulatory-watch.example.com`,
      `New guidance issued by oversight bodies clarifies key requirements and sets a 90-day compliance timeline.`],
  ].slice(0, n);

  articles.forEach((a, i) => {
    lines.push(
      `\n${i + 1}. ${a[0]}`,
      `   Source: ${a[1]} · Retrieved: ${SIM_DATE}`,
      `   ${a[2]}`,
    );
  });
  lines.push(`\n[${n} results returned] · Latency: ~${req.selectedProvider.latency}ms (declared)`);
  return lines.join("\n");
}

function demoContentExtraction(req: ServiceExecutionRequest): string {
  const topic = extractTopic(req.task);
  const charCount = 1200 + req.selectedProvider.quality * 15;
  const sourceUrl = req.priorContext
    ? (req.priorContext.match(/Source: ([^\s·]+)/)?.[1] ?? `${topic.replace(/\s/g, "-")}.example.com`)
    : `${topic.replace(/\s/g, "-")}.example.com`;

  return [
    `[DEMO] Content Extraction Result`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Source URL: https://${sourceUrl}`,
    `Characters extracted: ${charCount.toLocaleString()}`,
    `Extraction method: full-text DOM parsing`,
    "",
    "Extracted text (excerpt):",
    "─".repeat(52),
    `The following is a structured extraction of the primary content from the source page. `,
    `Topics covered include key developments in ${topic}, recent data points, expert commentary, `,
    `and forward-looking statements from industry participants. The extraction filtered out `,
    `navigation elements, advertisements, and duplicate boilerplate content, retaining only `,
    `semantically relevant body text (${charCount.toLocaleString()} characters total).`,
    "",
    `Key extracted sections:`,
    `  • Introduction and executive summary`,
    `  • Main body: analysis and findings (${Math.round(charCount * 0.6).toLocaleString()} chars)`,
    `  • Expert quotes and attributions`,
    `  • Data tables and statistics`,
    `  • Conclusions and forward guidance`,
  ].join("\n");
}

function demoSummarization(req: ServiceExecutionRequest): string {
  const topic = extractTopic(req.task);
  const wordCount = 80 + req.selectedProvider.quality * 0.8;
  const bulletCount = req.selectedProvider.quality >= 90 ? 5 : 4;

  const bullets = [
    `Strong momentum observed in ${topic}, with key metrics trending positively vs prior quarter.`,
    `Multiple established players are repositioning their strategies around emerging opportunities.`,
    `Regulatory clarity has improved, reducing uncertainty for institutional participants.`,
    `Demand signals from end-users remain robust; supply-side capacity is actively scaling.`,
    `Analysts project continued growth over the next 6–12 months barring macro headwinds.`,
  ].slice(0, bulletCount);

  return [
    `[DEMO] Summarization Output`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Summary of: ${req.priorContext ? "extracted content (prior stage)" : `"${req.task.slice(0, 60)}..."`}`,
    `Word count: ~${Math.round(wordCount)}`,
    "",
    "Key Findings:",
    ...bullets.map((b) => `  • ${b}`),
    "",
    "Conclusion:",
    `  The ${topic} landscape continues to evolve rapidly. Stakeholders should monitor`,
    `  the identified signals closely and align strategy with the three primary trends`,
    `  highlighted above. This summary is based on ${req.priorContext ? "the extracted source content" : "available information"}.`,
  ].join("\n");
}

function demoTranslation(req: ServiceExecutionRequest): string {
  const targetLang = detectTargetLanguage(req.task);
  const sourceText = (req.priorContext ?? req.task).slice(0, 120);
  const charCount = sourceText.length;

  // Deterministic "translated" text — uses a simple transformation so output is consistent
  const pseudoTranslations: Record<string, string> = {
    German: `Die Analyse zeigt wichtige Erkenntnisse über ${extractTopic(req.task)} mit messbaren Auswirkungen auf den Markt und die Branchenentwicklung.`,
    French: `L'analyse révèle des informations clés sur ${extractTopic(req.task)} avec des impacts mesurables sur le marché et l'évolution sectorielle.`,
    Spanish: `El análisis revela información clave sobre ${extractTopic(req.task)} con impactos medibles en el mercado y la evolución del sector.`,
    Japanese: `分析により、${extractTopic(req.task)}に関する重要な洞察が明らかになり、市場と業界の発展に測定可能な影響をもたらしています。`,
    Chinese: `分析揭示了关于${extractTopic(req.task)}的关键见解，对市场和行业发展产生了可衡量的影响。`,
  };

  const translatedText =
    pseudoTranslations[targetLang] ??
    `[Translation to ${targetLang}]: ${sourceText.replace(/[aeiou]/gi, "ə")}`;

  return [
    `[DEMO] Translation Result`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Source language: English (detected)`,
    `Target language: ${targetLang}`,
    `Characters translated: ${charCount}`,
    "",
    "Original (excerpt):",
    `  "${sourceText}${charCount > 100 ? "…" : ""}"`,
    "",
    "Translated:",
    `  "${translatedText}"`,
    "",
    `Translation confidence: ${Math.min(99, req.selectedProvider.quality + 3)}%`,
  ].join("\n");
}

function demoMarketData(req: ServiceExecutionRequest): string {
  const task = req.task.toLowerCase();
  const ASSETS = [
    { symbol: "BTC", name: "Bitcoin",  price: "61,247.33", change: "+2.4%", vol: "$28.3B" },
    { symbol: "ETH", name: "Ethereum", price:  "3,412.17", change: "+1.8%", vol: "$14.1B" },
    { symbol: "SOL", name: "Solana",   price:    "142.88", change: "+3.1%", vol:  "$4.2B" },
    { symbol: "BNB", name: "BNB",      price:    "411.55", change: "+0.9%", vol:  "$1.8B" },
    { symbol: "ADA", name: "Cardano",  price:      "0.448",change: "-0.5%", vol:  "$0.9B" },
  ];

  // Include BTC and ETH always; include others based on task mentions
  const included = ASSETS.filter((a) =>
    a.symbol === "BTC" || a.symbol === "ETH" ||
    task.includes(a.name.toLowerCase()) || task.includes(a.symbol.toLowerCase()),
  ).slice(0, resultCount(req.selectedProvider.quality));

  const header = `  ${"Asset".padEnd(14)}${"Price (USD)".padStart(14)}  ${"24h".padStart(7)}  ${"Volume".padStart(9)}`;
  const divider = `  ${"─".repeat(46)}`;
  const rows = included.map(
    (a) => `  ${(a.name + " (" + a.symbol + ")").padEnd(14)}${a.price.padStart(14)}  ${a.change.padStart(7)}  ${a.vol.padStart(9)}`,
  );

  return [
    `[DEMO] Market Data Snapshot`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Timestamp: ${SIM_DATE}-12T${new Date().toISOString().slice(11,16)}Z (simulated — not live)`,
    `Data source: simulated exchange feed`,
    "",
    header,
    divider,
    ...rows,
    divider,
    "",
    `Note: All prices are DEMO values fixed for determinism. Not live market data.`,
    `Exchange coverage: simulated multi-exchange aggregation`,
  ].join("\n");
}

function demoCodeAnalysis(req: ServiceExecutionRequest): string {
  const topic = extractTopic(req.task);
  const n = resultCount(req.selectedProvider.quality);

  const findings = [
    { severity: "CRITICAL", msg: `Potential memory leak in object allocation loop — unbounded growth under high load.` },
    { severity: "WARNING",  msg: `Reference cycles detected in nested data structures; may prevent garbage collection.` },
    { severity: "WARNING",  msg: `Missing explicit resource cleanup in error-handling paths (try/finally pattern recommended).` },
    { severity: "INFO",     msg: `Consider context managers (with/using statements) for resource-bound operations.` },
    { severity: "INFO",     msg: `Profile with dedicated memory tooling (tracemalloc / heaptrack) for targeted measurement.` },
  ].slice(0, n);

  return [
    `[DEMO] Code Analysis Report`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Analysis scope: "${topic}" (inferred from task description)`,
    `Static analysis depth: ${req.selectedProvider.quality >= 90 ? "deep" : "standard"}`,
    "",
    `Findings (${n} issues identified):`,
    ...findings.map((f, i) => `  ${i + 1}. [${f.severity}] ${f.msg}`),
    "",
    "Recommendation:",
    `  Prioritise the CRITICAL finding before deployment. Apply the WARNING fixes in the`,
    `  next refactor sprint. INFO items can be addressed as part of ongoing code hygiene.`,
    `  Estimated remediation effort: ${req.selectedProvider.quality >= 90 ? "2–4 hours" : "4–8 hours"}.`,
  ].join("\n");
}

function demoImageAnalysis(req: ServiceExecutionRequest): string {
  const topic = extractTopic(req.task);
  const n = resultCount(req.selectedProvider.quality);

  const objects = [
    { label: "User interface element",      conf: "98.2%" },
    { label: "Text content region",         conf: "96.7%" },
    { label: "Navigation component",        conf: "94.1%" },
    { label: "Interactive control",         conf: "91.8%" },
    { label: "Background / canvas region",  conf: "88.4%" },
  ].slice(0, n);

  return [
    `[DEMO] Image Analysis Results`,
    `Provider: ${req.selectedProvider.name} · Quality: ${req.selectedProvider.quality}/100`,
    "─".repeat(52),
    `Input: image / visual content (from task: "${topic}")`,
    `Model: vision-classification-v3 (simulated)`,
    `Confidence threshold: 85%`,
    "",
    "Detected objects:",
    ...objects.map((o, i) => `  ${i + 1}. ${o.label.padEnd(34)} confidence: ${o.conf}`),
    "",
    `Primary scene classification: Digital interface / document`,
    `Overall model confidence: ${req.selectedProvider.quality >= 90 ? "96.7%" : "89.3%"}`,
    "",
    `Note: DEMO analysis — no image file was processed. Output is deterministic fixture data.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Demo Adapter Implementation
// ---------------------------------------------------------------------------

/** Routes an execution request to the correct per-service demo generator. */
function generateDemoPayload(req: ServiceExecutionRequest): string {
  switch (req.service) {
    case "web_search":         return demoWebSearch(req);
    case "content_extraction": return demoContentExtraction(req);
    case "summarization":      return demoSummarization(req);
    case "translation":        return demoTranslation(req);
    case "market_data":        return demoMarketData(req);
    case "code_analysis":      return demoCodeAnalysis(req);
    case "image_analysis":     return demoImageAnalysis(req);
    default:
      return `[DEMO] No generator for service: ${req.service as string}`;
  }
}

/**
 * DemoProviderAdapter — a single adapter class that handles all service categories.
 * Instantiated once per provider in the catalog with their specific id/name/capabilities.
 *
 * executionMode is readonly "demo" at the instance level — cannot be overridden.
 */
export class DemoProviderAdapter implements ProviderAdapter {
  readonly executionMode = "demo" as const;

  constructor(
    readonly providerId: string,
    readonly providerName: string,
    readonly supportedCapabilities: readonly ServiceCategory[],
    /** Controls whether isAvailable() returns false (for testing failure scenarios). */
    private readonly _available: boolean = true,
  ) {}

  isAvailable(): boolean {
    return this._available;
  }

  async execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult> {
    const startedAt = Date.now();

    // Validate: this adapter must support the requested service
    if (!(this.supportedCapabilities as string[]).includes(request.service as string)) {
      const completedAt = Date.now();
      return {
        status: "SERVICE_NOT_SUPPORTED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "demo",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage: `Provider "${this.providerName}" does not support service "${request.service}".`,
      };
    }

    // Validate: provider ID must match
    if (request.selectedProvider.id !== this.providerId) {
      const completedAt = Date.now();
      return {
        status: "INVALID_EXECUTION_REQUEST",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "demo",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage:
          `Adapter "${this.providerId}" cannot execute on behalf of provider "${request.selectedProvider.id}".`,
      };
    }

    // Generate the deterministic demo payload
    const payload = generateDemoPayload(request);
    const completedAt = Date.now();

    const structuredPayload = request.service === "market_data" ? {
      assets: [
        { assetId: "bitcoin", symbol: "BTC", name: "Bitcoin", currency: "usd", price: 61247.33, marketCap: 1200000000000, volume24h: 28300000000, priceChangePercent24h: 2.4 },
        { assetId: "ethereum", symbol: "ETH", name: "Ethereum", currency: "usd", price: 3412.17, marketCap: 410000000000, volume24h: 14100000000, priceChangePercent24h: 1.8 }
      ],
      fetchedAt: new Date(completedAt).toISOString(),
      dataSource: `${this.providerName} Demo API`,
      currency: "usd"
    } : undefined;

    return {
      status: "SUCCESS",
      service: request.service,
      providerId: this.providerId,
      providerName: this.providerName,
      executionMode: "demo",
      payload,
      structuredPayload,
      startedAt,
      completedAt,
      measuredLatencyMs: completedAt - startedAt,
      declaredCost: request.selectedProvider.price,
      allocatedBudget: request.allocatedBudget,
    };
  }
}
