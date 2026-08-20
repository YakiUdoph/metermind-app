// Mock data layer for MeterMind — autonomous procurement intelligence for AI agents.
// Shaped like an API response so it can be swapped for real fetches later.

export type ProcurementStatus = "COMPLETE" | "EXECUTING" | "SELECTED" | "BLOCKED";

export interface Provider {
  id: string;
  name: string;
  category: string;
  price?: number | undefined;
  quality: number;
  reliability: number;
  latency: number;
  score: number;
  jobs: number;
  failed: number;
  spend: number;
  trend: number; // percent change, negative = cheaper
  assessment: string;
  priceHistory: number[];
  qualityHistory: number[];
  /**
   * Service capabilities for the planning domain.
   * Uses string[] (not ServiceCategory) to avoid a circular import
   * between mock.ts ↔ planning/types.ts.
   * Populated only on planningProviders; undefined on providers/demoProviders.
   */
  capabilities?: readonly string[] | undefined;
  /**
   * Metric source transparency (Milestone #4).
   * "fixture"  — invented demo value
   * "declared" — stated by provider documentation
   * "observed" — measured by MeterMind at runtime
   * "unknown"  — not yet determined
   */
  metricSource?: "fixture" | "declared" | "observed" | "unknown" | undefined;
  /**
   * Execution mode for this provider.
   * "demo" — local simulation only (default for all existing providers)
   * "live" — real external API calls
   */
  mode?: "demo" | "live" | undefined;
  paymentModel?: "free" | "x402" | undefined;
  paymentDestination?: string | undefined;
}

export interface Procurement {
  id: string;
  time: string;
  agent: string;
  task: string;
  provider: string;
  paid: number;
  comparable: number;
  status: ProcurementStatus;
  rail: string;
  quality: number;
  reliability: number;
  why: string;
  considered: { name: string; price: number; score: number }[];
}

export interface Agent {
  id: string;
  name: string;
  status: "Active" | "Paused";
  budget: number;
  spent: number;
  saved: number;
  priority: "Lowest Cost" | "Balanced" | "Highest Quality" | "Fastest";
  rules: { label: string; value: string }[];
}

/* ------------------------------------------------------------- metrics */

export const metrics = {
  totalSaved: 312.84,
  totalSpend: 211.16,
  estimatedWithout: 524.0,
  procurements: 1482,
  successRate: 98.7,
  providersUsed: 18,
};

/** Actual MeterMind spend vs. what the same work would have cost without it. */
export const spendVsEstimate = [
  { day: "Jul 14", actual: 12.4, estimated: 29.8 },
  { day: "Jul 16", actual: 14.1, estimated: 33.2 },
  { day: "Jul 18", actual: 11.2, estimated: 27.4 },
  { day: "Jul 20", actual: 18.6, estimated: 44.1 },
  { day: "Jul 22", actual: 16.2, estimated: 39.6 },
  { day: "Jul 24", actual: 21.4, estimated: 52.0 },
  { day: "Jul 26", actual: 17.8, estimated: 43.5 },
  { day: "Jul 28", actual: 23.9, estimated: 58.7 },
  { day: "Jul 30", actual: 20.4, estimated: 50.2 },
  { day: "Aug 01", actual: 25.6, estimated: 63.1 },
  { day: "Aug 03", actual: 12.8, estimated: 32.4 },
  { day: "Aug 05", actual: 16.76, estimated: 50.0 },
];

export const spendByCategory = [
  { name: "Search & research", amount: 68.42 },
  { name: "Inference", amount: 52.18 },
  { name: "Voice / TTS", amount: 31.06 },
  { name: "Code analysis", amount: 24.9 },
  { name: "Translation", amount: 18.4 },
  { name: "Vision", amount: 16.2 },
];

/* ----------------------------------------------------------- providers */

export const providers: Provider[] = [
  {
    id: "dataflow",
    name: "DataFlow",
    category: "Search",
    price: 0.04,
    quality: 94,
    reliability: 98.9,
    latency: 420,
    score: 94,
    jobs: 1281,
    failed: 7,
    spend: 147.82,
    trend: -8,
    assessment:
      "Highly reliable provider offering excellent price-to-quality performance. Preferred for balanced workloads.",
    priceHistory: [0.05, 0.05, 0.048, 0.046, 0.044, 0.042, 0.04],
    qualityHistory: [91, 92, 92, 93, 94, 94, 94],
  },
  {
    id: "searchx",
    name: "SearchX",
    category: "Search",
    price: 0.08,
    quality: 96,
    reliability: 99.1,
    latency: 510,
    score: 92,
    jobs: 3104,
    failed: 24,
    spend: 212.4,
    trend: 38,
    assessment:
      "Top-tier quality, but a recent 38% price increase pushed it below DataFlow on value for balanced tasks.",
    priceHistory: [0.058, 0.058, 0.06, 0.062, 0.07, 0.076, 0.08],
    qualityHistory: [95, 96, 96, 96, 96, 96, 96],
  },
  {
    id: "quicksearch",
    name: "QuickSearch",
    category: "Search",
    price: 0.02,
    quality: 71,
    reliability: 88.2,
    latency: 310,
    score: 69,
    jobs: 426,
    failed: 41,
    spend: 8.52,
    trend: -3,
    assessment:
      "Cheapest search route available, but reliability falls below most quality thresholds. Used only for low-stakes lookups.",
    priceHistory: [0.021, 0.021, 0.02, 0.02, 0.02, 0.02, 0.02],
    qualityHistory: [73, 72, 72, 71, 71, 71, 71],
  },
  {
    id: "researchapi",
    name: "ResearchAPI",
    category: "Search",
    price: 0.06,
    quality: 91,
    reliability: 97.4,
    latency: 460,
    score: 90,
    jobs: 902,
    failed: 12,
    spend: 54.12,
    trend: 2,
    assessment: "Consistent research-grade results at a mid-market price. A dependable second choice.",
    priceHistory: [0.058, 0.058, 0.059, 0.059, 0.06, 0.06, 0.06],
    qualityHistory: [90, 90, 91, 91, 91, 91, 91],
  },
  {
    id: "insightai",
    name: "InsightAI",
    category: "Search",
    price: 0.03,
    quality: 72,
    reliability: 91.4,
    latency: 380,
    score: 74,
    jobs: 318,
    failed: 18,
    spend: 9.54,
    trend: -5,
    assessment: "Inexpensive summarization layer. Acceptable for drafts, not for published analysis.",
    priceHistory: [0.034, 0.033, 0.032, 0.031, 0.03, 0.03, 0.03],
    qualityHistory: [70, 71, 71, 72, 72, 72, 72],
  },
  {
    id: "voiceflow",
    name: "VoiceFlow",
    category: "Voice",
    price: 0.11,
    quality: 93,
    reliability: 98.2,
    latency: 640,
    score: 93,
    jobs: 612,
    failed: 9,
    spend: 67.32,
    trend: -11,
    assessment: "Best value voice synthesis for long-form narration. Latency is higher but quality holds.",
    priceHistory: [0.128, 0.126, 0.122, 0.118, 0.114, 0.112, 0.11],
    qualityHistory: [91, 92, 92, 93, 93, 93, 93],
  },
  {
    id: "codemodel",
    name: "CodeModel API",
    category: "Code",
    price: 0.18,
    quality: 95,
    reliability: 99.3,
    latency: 720,
    score: 95,
    jobs: 488,
    failed: 3,
    spend: 87.84,
    trend: -4,
    assessment: "Highest measured accuracy on code review workloads. Worth the premium on critical repos.",
    priceHistory: [0.19, 0.19, 0.188, 0.185, 0.182, 0.18, 0.18],
    qualityHistory: [93, 94, 94, 95, 95, 95, 95],
  },
  {
    id: "linguaapi",
    name: "LinguaAPI",
    category: "Translation",
    price: 0.05,
    quality: 92,
    reliability: 97.8,
    latency: 350,
    score: 93,
    jobs: 744,
    failed: 11,
    spend: 37.2,
    trend: -41,
    assessment: "Comparable quality to TranslatePro at 41% lower cost. Now the default translation route.",
    priceHistory: [0.085, 0.082, 0.078, 0.07, 0.062, 0.056, 0.05],
    qualityHistory: [90, 91, 91, 92, 92, 92, 92],
  },
  {
    id: "visionapi",
    name: "VisionAPI",
    category: "Vision",
    price: 0.09,
    quality: 94,
    reliability: 99.0,
    latency: 540,
    score: 94,
    jobs: 356,
    failed: 4,
    spend: 32.04,
    trend: 0,
    assessment:
      "Retained despite a 12% cheaper alternative — the challenger failed the 97% reliability threshold.",
    priceHistory: [0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09],
    qualityHistory: [93, 93, 94, 94, 94, 94, 94],
  },
  {
    id: "paidresearchapi",
    name: "MeterMind Controlled Research Service",
    category: "Paid Research",
    price: 0.01,
    quality: 98,
    reliability: 99.9,
    latency: 350,
    score: 98,
    jobs: 1500,
    failed: 1,
    spend: 15.00,
    trend: 0,
    assessment: "MeterMind Controlled Research Service. Simulated premium service for payment loop testing.",
    priceHistory: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    qualityHistory: [98, 98, 98, 98, 98, 98, 98],
    paymentModel: "x402" as const,
    paymentDestination: "sim_merchant_paidresearchapi"
  }
];

/** The four providers evaluated in the hero + live procurement demo. */
export const demoProviders: Provider[] = [
  {
    id: "searchx",
    name: "SearchX",
    category: "Search",
    price: 0.08,
    quality: 96,
    reliability: 99.1,
    latency: 510,
    score: 92,
    jobs: 3104,
    failed: 24,
    spend: 212.4,
    trend: 38,
    assessment: "Top-tier search quality and maximum reliability across multi-hop research tasks.",
    priceHistory: [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
    qualityHistory: [96, 96, 96, 96, 96, 96, 96],
  },
  {
    id: "dataflow",
    name: "DataFlow",
    category: "Search",
    price: 0.04,
    quality: 94,
    reliability: 98.9,
    latency: 420,
    score: 94,
    jobs: 1281,
    failed: 7,
    spend: 147.82,
    trend: -8,
    assessment: "Highly reliable provider. Delivering comparable quality at 50% lower cost than SearchX.",
    priceHistory: [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04],
    qualityHistory: [94, 94, 94, 94, 94, 94, 94],
  },
  {
    id: "quicksearch",
    name: "QuickSearch",
    category: "Search",
    price: 0.02,
    quality: 71,
    reliability: 88.2,
    latency: 310,
    score: 69,
    jobs: 426,
    failed: 41,
    spend: 8.52,
    trend: -3,
    assessment: "Cheapest search route. Fastest latency but lower quality and reliability.",
    priceHistory: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
    qualityHistory: [71, 71, 71, 71, 71, 71, 71],
  },
  {
    id: "researchapi",
    name: "ResearchAPI",
    category: "Search",
    price: 0.06,
    quality: 91,
    reliability: 97.4,
    latency: 460,
    score: 90,
    jobs: 902,
    failed: 12,
    spend: 54.12,
    trend: 2,
    assessment: "Consistent research-grade endpoint with solid overall value.",
    priceHistory: [0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
    qualityHistory: [91, 91, 91, 91, 91, 91, 91],
  },
];

export const WINNER = "DataFlow";

/* --------------------------------------------------------- procurements */

export const procurements: Procurement[] = [
  {
    id: "MM-2841",
    time: "14:32:08",
    agent: "Research Agent",
    task: "Web research",
    provider: "DataFlow",
    paid: 0.04,
    comparable: 0.08,
    status: "COMPLETE",
    rail: "x402",
    quality: 94,
    reliability: 98.9,
    why: "DataFlow delivered comparable quality to SearchX at 50% lower cost while remaining above your reliability threshold.",
    considered: [
      { name: "SearchX", price: 0.08, score: 92 },
      { name: "DataFlow", price: 0.04, score: 94 },
      { name: "QuickSearch", price: 0.02, score: 69 },
      { name: "ResearchAPI", price: 0.06, score: 90 },
    ],
  },
  {
    id: "MM-2840",
    time: "14:28:51",
    agent: "Marketing Agent",
    task: "Text-to-speech",
    provider: "VoiceFlow",
    paid: 0.11,
    comparable: 0.18,
    status: "COMPLETE",
    rail: "x402",
    quality: 93,
    reliability: 98.2,
    why: "VoiceFlow matched the incumbent's voice quality at 39% lower cost with acceptable latency for narration.",
    considered: [
      { name: "VoiceFlow", price: 0.11, score: 93 },
      { name: "SpeakLabs", price: 0.18, score: 92 },
      { name: "TinyTTS", price: 0.05, score: 64 },
    ],
  },
  {
    id: "MM-2839",
    time: "14:22:17",
    agent: "Coding Agent",
    task: "Code analysis",
    provider: "CodeModel API",
    paid: 0.18,
    comparable: 0.23,
    status: "COMPLETE",
    rail: "card",
    quality: 95,
    reliability: 99.3,
    why: "Highest accuracy on review workloads. A cheaper model scored 74 and was rejected under your Highest Quality priority.",
    considered: [
      { name: "CodeModel API", price: 0.18, score: 95 },
      { name: "DevLLM", price: 0.23, score: 93 },
      { name: "PatchBot", price: 0.09, score: 74 },
    ],
  },
  {
    id: "MM-2838",
    time: "14:15:03",
    agent: "Data Agent",
    task: "Document translation",
    provider: "LinguaAPI",
    paid: 0.05,
    comparable: 0.085,
    status: "COMPLETE",
    rail: "x402",
    quality: 92,
    reliability: 97.8,
    why: "LinguaAPI reached comparable quality to TranslatePro at 41% lower cost, so MeterMind switched the default route.",
    considered: [
      { name: "LinguaAPI", price: 0.05, score: 93 },
      { name: "TranslatePro", price: 0.085, score: 92 },
    ],
  },
  {
    id: "MM-2837",
    time: "14:09:44",
    agent: "Support Agent",
    task: "Image classification",
    provider: "VisionAPI",
    paid: 0.09,
    comparable: 0.09,
    status: "COMPLETE",
    rail: "card",
    quality: 94,
    reliability: 99.0,
    why: "A 12% cheaper alternative was found but failed the 97% reliability threshold, so VisionAPI was retained.",
    considered: [
      { name: "VisionAPI", price: 0.09, score: 94 },
      { name: "PixelLite", price: 0.079, score: 71 },
    ],
  },
  {
    id: "MM-2836",
    time: "14:02:31",
    agent: "Research Agent",
    task: "Market summary",
    provider: "ResearchAPI",
    paid: 0.06,
    comparable: 0.08,
    status: "EXECUTING",
    rail: "x402",
    quality: 91,
    reliability: 97.4,
    why: "DataFlow was rate-limited at request time; ResearchAPI was the next best value above the quality floor.",
    considered: [
      { name: "ResearchAPI", price: 0.06, score: 90 },
      { name: "SearchX", price: 0.08, score: 92 },
    ],
  },
  {
    id: "MM-2835",
    time: "13:56:12",
    agent: "Marketing Agent",
    task: "Long-form narration",
    provider: "—",
    paid: 0,
    comparable: 0.94,
    status: "BLOCKED",
    rail: "—",
    quality: 0,
    reliability: 0,
    why: "No provider met the task within the $0.50 maximum single-purchase limit. Purchase held for review.",
    considered: [
      { name: "SpeakLabs", price: 0.94, score: 92 },
      { name: "VoiceFlow", price: 0.62, score: 93 },
    ],
  },
];

/* -------------------------------------------------------- optimizations */

export const optimizations = [
  {
    id: "opt-1",
    from: "SearchX",
    to: "DataFlow",
    title: "SearchX → DataFlow",
    body: "SearchX increased its price by 38%. MeterMind automatically identified DataFlow as a comparable alternative.",
    monthly: 47.2,
    status: "SWITCHED" as const,
  },
  {
    id: "opt-2",
    from: "TranslatePro",
    to: "LinguaAPI",
    title: "TranslatePro → LinguaAPI",
    body: "Comparable quality detected at 41% lower cost.",
    monthly: 28.4,
    status: "SWITCHED" as const,
  },
  {
    id: "opt-3",
    from: "VisionAPI",
    to: "VisionAPI",
    title: "VisionAPI retained",
    body: "Alternative provider was 12% cheaper but failed the required reliability threshold.",
    monthly: 0,
    status: "QUALITY PROTECTED" as const,
  },
];

export const savingsInsights = [
  { label: "Provider switching", value: 420, detail: "Two high-volume routes moved to comparable, cheaper providers" },
  { label: "Price changes detected", value: 310, detail: "Price increases caught within hours and re-sourced" },
  { label: "Better-value providers discovered", value: 184, detail: "New entrants scored above incumbents on value" },
  { label: "Routing optimization", value: 370, detail: "Regional and cached routes selected automatically" },
];

export const potentialMonthly = savingsInsights.reduce((s, i) => s + i.value, 0); // 1284

/* -------------------------------------------------------------- agents */

export const agents: Agent[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    status: "Active",
    budget: 1000,
    spent: 438.22,
    saved: 587.41,
    priority: "Balanced",
    rules: [
      { label: "Priority", value: "Balanced" },
      { label: "Minimum reliability", value: "95%" },
      { label: "Maximum single purchase", value: "$50" },
      { label: "Auto-switch providers", value: "Enabled" },
    ],
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    status: "Active",
    budget: 750,
    spent: 302.66,
    saved: 151.18,
    priority: "Highest Quality",
    rules: [
      { label: "Priority", value: "Highest quality" },
      { label: "Minimum quality", value: "90/100" },
      { label: "Maximum single purchase", value: "$40" },
      { label: "Auto-switch providers", value: "Enabled" },
    ],
  },
  {
    id: "marketing-agent",
    name: "Marketing Agent",
    status: "Paused",
    budget: 500,
    spent: 214.9,
    saved: 122.04,
    priority: "Balanced",
    rules: [
      { label: "Priority", value: "Balanced" },
      { label: "Minimum reliability", value: "97%" },
      { label: "Maximum single purchase", value: "$0.50" },
      { label: "Auto-switch providers", value: "Requires review" },
    ],
  },
  {
    id: "data-agent",
    name: "Data Agent",
    status: "Active",
    budget: 1200,
    spent: 688.4,
    saved: 243.22,
    priority: "Lowest Cost",
    rules: [
      { label: "Priority", value: "Lowest cost" },
      { label: "Minimum reliability", value: "96%" },
      { label: "Maximum single purchase", value: "$120" },
      { label: "Auto-switch providers", value: "Enabled" },
    ],
  },
];

/* ------------------------------------------------------------ formatting */

export const currency = (n: number, decimals = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const providerById = (id: string) => providers.find((p) => p.id === id);

/* -------------------------------------------------- planning providers */

/**
 * Full provider catalog with service capabilities annotated.
 * Used exclusively by the planning domain (src/domain/planning/).
 *
 * Capabilities are keyed by provider id and map to the ServiceCategory
 * string-union values defined in src/domain/planning/types.ts.
 *
 * Existing providers / demoProviders remain unchanged so all
 * Milestone #1 scoring tests continue to pass without modification.
 */
const PROVIDER_CAPABILITIES: Record<string, readonly string[]> = {
  dataflow:    ["web_search", "content_extraction", "summarization", "market_data"],
  searchx:     ["web_search", "content_extraction", "market_data"],
  quicksearch: ["web_search", "market_data"],
  researchapi: ["web_search", "content_extraction", "summarization", "market_data"],
  insightai:   ["web_search", "summarization", "market_data"],
  voiceflow:   [],
  codemodel:   ["code_analysis"],
  linguaapi:   ["translation"],
  visionapi:   ["image_analysis"],
  coingecko:   ["market_data"],
  paidresearchapi: ["paid_research"],
};

export const planningProviders: Provider[] = providers.map((p) => ({
  ...p,
  capabilities: PROVIDER_CAPABILITIES[p.id] ?? [],
  metricSource: "fixture" as const,
  mode: "demo" as const,
}));

/**
 * CoinGecko live provider metadata entry.
 *
 * Price model (Milestone #4.1):
 * - price is undefined/omitted entirely to represent that the per-call price is unknown/not applicable.
 *
 * Metrics (Milestone #4):
 * - quality / reliability / latency are 0 ("unknown" metric source).
 */
export const COINGECKO_PROVIDER_ENTRY: Provider = {
  id: "coingecko",
  name: "CoinGecko",
  category: "market-data",
  // price is omitted (unknown)
  quality: 0,
  reliability: 0,
  latency: 0,
  score: 0,
  jobs: 0,
  failed: 0,
  spend: 0,
  trend: 0,
  assessment: "Live CoinGecko Demo API. Metrics are not yet observed — do not use for scoring.",
  priceHistory: [],
  qualityHistory: [],
  capabilities: ["market_data"],
  metricSource: "unknown" as const,
  mode: "live" as const,
};

export const BITFINEX_PROVIDER_ENTRY: Provider = {
  id: "bitfinex",
  name: "Bitfinex",
  category: "market-data",
  // price is omitted (unknown)
  quality: 0,
  reliability: 0,
  latency: 0,
  score: 0,
  jobs: 0,
  failed: 0,
  spend: 0,
  trend: 0,
  assessment: "Live Bitfinex Public API. Metrics are not yet observed — do not use for scoring.",
  priceHistory: [],
  qualityHistory: [],
  capabilities: ["market_data"],
  metricSource: "unknown" as const,
  mode: "live" as const,
};

export const PAID_RESEARCH_PROVIDER_ENTRY: Provider = {
  id: "paidresearchapi",
  name: "MeterMind Controlled Research Service",
  category: "Paid Research",
  price: 0.01,
  quality: 98,
  reliability: 99.9,
  latency: 350,
  score: 98,
  jobs: 1500,
  failed: 1,
  spend: 15.00,
  trend: 0,
  assessment: "MeterMind Controlled Research Service. Simulated premium service for payment loop testing.",
  priceHistory: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
  qualityHistory: [98, 98, 98, 98, 98, 98, 98],
  capabilities: ["paid_research"],
  metricSource: "declared" as const,
  mode: "demo" as const,
  paymentModel: "x402" as const,
  paymentDestination: "sim_merchant_paidresearchapi"
};


