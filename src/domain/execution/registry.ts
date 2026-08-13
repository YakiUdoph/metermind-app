/**
 * MeterMind Execution Domain — Adapter Registry
 *
 * The AdapterRegistry maps provider IDs to ProviderAdapter instances.
 * It is the single lookup table used by the executor to find the right
 * adapter for each selected provider.
 *
 * Separation of concerns:
 *   - The registry does NOT select providers (that is the scoring engine's job).
 *   - The registry does NOT validate the plan (that is the executor's job).
 *   - The registry only answers: "given provider X, what adapter can run service Y?"
 *
 * createDefaultRegistry() pre-loads all built-in demo adapters and is the
 * default used by executePlan(). Tests may pass a custom registry.
 */

import type { ProviderAdapter, ExecutionStatusResult } from "./types";
import type { ServiceCategory } from "@/domain/planning/types";
import { DemoProviderAdapter } from "./adapters/demo";

// ---------------------------------------------------------------------------
// Capability map (mirrors PROVIDER_CAPABILITIES in mock.ts)
// ---------------------------------------------------------------------------

const DEMO_PROVIDER_CAPABILITIES: Record<string, readonly ServiceCategory[]> = {
  dataflow:    ["web_search", "content_extraction", "summarization", "market_data"],
  searchx:     ["web_search", "content_extraction", "market_data"],
  quicksearch: ["web_search", "market_data"],
  researchapi: ["web_search", "content_extraction", "summarization", "market_data"],
  insightai:   ["web_search", "summarization", "market_data"],
  voiceflow:   [],
  codemodel:   ["code_analysis"],
  linguaapi:   ["translation"],
  visionapi:   ["image_analysis"],
};

const DEMO_PROVIDER_NAMES: Record<string, string> = {
  dataflow:    "DataFlow",
  searchx:     "SearchX",
  quicksearch: "QuickSearch",
  researchapi: "ResearchAPI",
  insightai:   "InsightAI",
  voiceflow:   "VoiceFlow",
  codemodel:   "CodeModel API",
  linguaapi:   "LinguaAPI",
  visionapi:   "VisionAPI",
};

// ---------------------------------------------------------------------------
// AdapterRegistry
// ---------------------------------------------------------------------------

/** Resolution result — either the adapter, or a typed failure code. */
export type ResolveResult =
  | { ok: true; adapter: ProviderAdapter }
  | { ok: false; status: Extract<ExecutionStatusResult, "PROVIDER_ADAPTER_NOT_FOUND" | "SERVICE_NOT_SUPPORTED" | "PROVIDER_UNAVAILABLE"> };

export class AdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  /** Register a provider adapter. Overwrites any existing adapter with the same providerId. */
  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  /** Number of registered adapters. */
  get size(): number {
    return this.adapters.size;
  }

  /** Returns true if an adapter is registered for the given provider id. */
  has(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  /**
   * Resolves the adapter for the given provider and service.
   *
   * Failure reasons (in check order):
   *   PROVIDER_ADAPTER_NOT_FOUND — no adapter registered for this provider id
   *   SERVICE_NOT_SUPPORTED      — adapter exists but does not support this service
   *   PROVIDER_UNAVAILABLE       — adapter exists and supports service, but isAvailable() === false
   */
  resolve(providerId: string, service: ServiceCategory): ResolveResult {
    const adapter = this.adapters.get(providerId);

    if (!adapter) {
      return { ok: false, status: "PROVIDER_ADAPTER_NOT_FOUND" };
    }

    if (!(adapter.supportedCapabilities as string[]).includes(service as string)) {
      return { ok: false, status: "SERVICE_NOT_SUPPORTED" };
    }

    if (!adapter.isAvailable()) {
      return { ok: false, status: "PROVIDER_UNAVAILABLE" };
    }

    return { ok: true, adapter };
  }
}

// ---------------------------------------------------------------------------
// Default registry factory
// ---------------------------------------------------------------------------

/**
 * Creates and returns an AdapterRegistry pre-loaded with DemoProviderAdapter
 * instances for all nine providers in the planning catalog.
 *
 * This is the default registry used by executePlan(). Tests that need to
 * simulate failures (unavailable providers, missing adapters) should construct
 * a custom registry instead of overriding this one.
 */
export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();

  for (const [id, caps] of Object.entries(DEMO_PROVIDER_CAPABILITIES)) {
    registry.register(
      new DemoProviderAdapter(id, DEMO_PROVIDER_NAMES[id] ?? id, caps),
    );
  }

  return registry;
}
