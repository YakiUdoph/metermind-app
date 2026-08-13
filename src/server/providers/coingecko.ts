/**
 * MeterMind Server — CoinGecko Live Market-Data Adapter (Milestone #4)
 *
 * This file MUST remain server-side only. It reads process.env.COINGECKO_API_KEY
 * and performs real HTTP requests to the CoinGecko Demo API.
 *
 * Security rules enforced here:
 *   - API key is read from environment, never from domain code, never from client.
 *   - The key is NEVER included in any response payload or log statement.
 *   - If no key is configured, LIVE_PROVIDER_NOT_CONFIGURED is returned and
 *     the caller falls back to demo mode explicitly (never silently).
 *
 * API contract:
 *   CoinGecko Demo API v3
 *   Base URL: https://api.coingecko.com/api/v3
 *   Endpoint: GET /simple/price
 *   Auth: x-cg-demo-api-key header (Demo API key)
 *   Docs: https://docs.coingecko.com/reference/simple-price
 *
 * Metric source transparency (per Milestone #4 spec):
 *   - "declared" fields (price, quality): NOT attached — no verified historical data yet.
 *   - "observed" fields: measuredLatencyMs, success boolean, fetchedAt — measured per-call.
 *   - Do NOT claim CoinGecko costs "$0.04 per call"; that is a demo fixture value only.
 *
 * Timeout: 8 000 ms via AbortController.
 *
 * Error mapping:
 *   HTTP 401     → LIVE_PROVIDER_AUTH_FAILED
 *   HTTP 403     → LIVE_PROVIDER_AUTH_FAILED
 *   HTTP 429     → LIVE_PROVIDER_RATE_LIMITED
 *   HTTP 5xx     → LIVE_PROVIDER_UNAVAILABLE
 *   Network fail → LIVE_PROVIDER_UNAVAILABLE
 *   Bad JSON     → LIVE_PROVIDER_BAD_RESPONSE
 *   Timeout      → EXECUTION_TIMEOUT
 *   No key       → LIVE_PROVIDER_NOT_CONFIGURED
 */

import type {
  ProviderAdapter,
  ServiceExecutionRequest,
  ServiceExecutionResult,
  LiveMarketDataPayload,
  LiveAssetPrice,
} from "@/domain/execution/types";
import type { ServiceCategory } from "@/domain/planning/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const REQUEST_TIMEOUT_MS = 8_000;

/** Provider ID used in the catalog and registry. */
export const COINGECKO_PROVIDER_ID = "coingecko";
export const COINGECKO_PROVIDER_NAME = "CoinGecko";

/**
 * Asset symbol → CoinGecko coin id mapping.
 * Bounded set as specified in Milestone #4 scope.
 */
const SYMBOL_TO_ID: Record<string, string> = {
  btc:      "bitcoin",
  eth:      "ethereum",
  bitcoin:  "bitcoin",
  ethereum: "ethereum",
};

/**
 * CoinGecko coin id → human display info.
 */
const COIN_META: Record<string, { symbol: string; name: string }> = {
  bitcoin:  { symbol: "BTC", name: "Bitcoin" },
  ethereum: { symbol: "ETH", name: "Ethereum" },
};

// ---------------------------------------------------------------------------
// Asset extraction from task text
// ---------------------------------------------------------------------------

/**
 * Extracts CoinGecko asset IDs from a natural-language task string.
 * Returns at least ["bitcoin", "ethereum"] if no specific assets are mentioned.
 * Scope: BTC and ETH only per Milestone #4 spec.
 */
export function extractAssetsFromTask(task: string): string[] {
  const lower = task.toLowerCase();
  const found = new Set<string>();

  for (const [alias, id] of Object.entries(SYMBOL_TO_ID)) {
    if (lower.includes(alias)) found.add(id);
  }

  // Default: if nothing found, return both supported assets
  if (found.size === 0) {
    return ["bitcoin", "ethereum"];
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// CoinGecko API response shape
// ---------------------------------------------------------------------------

/**
 * Subset of the CoinGecko /simple/price response we use.
 * Full docs: https://docs.coingecko.com/reference/simple-price
 *
 * Shape: { [coinId]: { [currency]: price, [currency]_market_cap, ... } }
 */
interface CoinGeckoSimplePriceResponse {
  [coinId: string]: {
    [currency: string]: number;
    usd_market_cap?: number;
    usd_24h_vol?: number;
    usd_24h_change?: number;
  };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw CoinGecko /simple/price response into MeterMind's
 * LiveMarketDataPayload model. Never exposes raw CoinGecko shape to callers.
 */
function normalizeCoinGeckoResponse(
  raw: CoinGeckoSimplePriceResponse,
  assets: string[],
  currency: string,
  fetchedAt: string,
): LiveMarketDataPayload {
  const assetPrices: LiveAssetPrice[] = assets.map((assetId) => {
    const data = raw[assetId];
    const meta = COIN_META[assetId] ?? { symbol: assetId.toUpperCase(), name: assetId };
    return {
      assetId,
      symbol: meta.symbol,
      name: meta.name,
      currency,
      price: data?.[currency] ?? 0,
      marketCap: data?.["usd_market_cap"] ?? null,
      volume24h: data?.["usd_24h_vol"] ?? null,
      priceChangePercent24h: data?.["usd_24h_change"] ?? null,
    };
  });

  return {
    assets: assetPrices,
    fetchedAt,
    dataSource: "CoinGecko Demo API",
    currency,
  };
}

/**
 * Formats a LiveMarketDataPayload as a human-readable text payload
 * suitable for the ServiceExecutionResult.payload field.
 */
function formatLivePayload(data: LiveMarketDataPayload): string {
  const lines: string[] = [
    `[LIVE] Market Data — Source: ${data.dataSource}`,
    `Fetched at: ${data.fetchedAt}`,
    `Currency: ${data.currency.toUpperCase()}`,
    "",
  ];

  for (const asset of data.assets) {
    lines.push(`${asset.name} (${asset.symbol})`);
    lines.push(`  Price: $${asset.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (asset.marketCap !== null) {
      lines.push(`  Market Cap: $${(asset.marketCap / 1e9).toFixed(2)}B`);
    }
    if (asset.volume24h !== null) {
      lines.push(`  24h Volume: $${(asset.volume24h / 1e9).toFixed(2)}B`);
    }
    if (asset.priceChangePercent24h !== null) {
      const sign = asset.priceChangePercent24h >= 0 ? "+" : "";
      lines.push(`  24h Change: ${sign}${asset.priceChangePercent24h.toFixed(2)}%`);
    }
    lines.push("");
  }

  if (data.assets.length === 2) {
    const [a, b] = data.assets as [LiveAssetPrice, LiveAssetPrice];
    const ratio = a.price > 0 && b.price > 0 ? (a.price / b.price).toFixed(4) : "N/A";
    lines.push(`Comparison: 1 ${a.symbol} = ${ratio} ${b.symbol}`);
  }

  return lines.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// CoinGecko Live Adapter
// ---------------------------------------------------------------------------

/**
 * CoinGeckoAdapter — live adapter for the market_data service category.
 *
 * Metric source transparency:
 *   - declaredCost: taken from the provider catalog (a placeholder, NOT CoinGecko's price).
 *   - measuredLatencyMs: observed at runtime for this specific request.
 *   - executionMode: always "live" (real HTTP call to CoinGecko).
 *
 * If the API key is missing, returns LIVE_PROVIDER_NOT_CONFIGURED immediately.
 * This adapter never silently falls back to demo data.
 */
export class CoinGeckoAdapter implements ProviderAdapter {
  readonly providerId = COINGECKO_PROVIDER_ID;
  readonly providerName = COINGECKO_PROVIDER_NAME;
  readonly supportedCapabilities: readonly ServiceCategory[] = ["market_data"];
  readonly executionMode = "live" as const;

  constructor(private readonly apiKey: string | undefined) {}

  isAvailable(): boolean {
    // Available if the key is configured (we don't ping CoinGecko to check)
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  async execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult> {
    const startedAt = Date.now();

    // ── Validate capability ───────────────────────────────────────────────
    if (request.service !== "market_data") {
      const completedAt = Date.now();
      return {
        status: "SERVICE_NOT_SUPPORTED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage: `CoinGeckoAdapter only supports "market_data"; received "${request.service}".`,
      };
    }

    // ── API key guard ─────────────────────────────────────────────────────
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      const completedAt = Date.now();
      return {
        status: "LIVE_PROVIDER_NOT_CONFIGURED",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage:
          "COINGECKO_API_KEY is not configured. " +
          "Set the environment variable to enable live market data.",
      };
    }

    // ── Build request ─────────────────────────────────────────────────────
    const assets = extractAssetsFromTask(request.task);
    const currency = "usd";
    const idsParam = assets.join(",");

    const url = new URL(`${COINGECKO_BASE_URL}/simple/price`);
    url.searchParams.set("ids", idsParam);
    url.searchParams.set("vs_currencies", currency);
    url.searchParams.set("include_market_cap", "true");
    url.searchParams.set("include_24hr_vol", "true");
    url.searchParams.set("include_24hr_change", "true");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, REQUEST_TIMEOUT_MS);

    // ── Execute HTTP request ──────────────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-cg-demo-api-key": this.apiKey,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const completedAt = Date.now();
      const isTimeout =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
      return {
        status: isTimeout ? "EXECUTION_TIMEOUT" : "LIVE_PROVIDER_UNAVAILABLE",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage: isTimeout
          ? `CoinGecko request timed out after ${REQUEST_TIMEOUT_MS}ms.`
          : `Network error reaching CoinGecko: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // ── Map HTTP error codes ──────────────────────────────────────────────
    if (!response.ok) {
      const completedAt = Date.now();
      const status = response.status;
      let executionStatus: ServiceExecutionResult["status"];
      let errorMessage: string;

      if (status === 401 || status === 403) {
        executionStatus = "LIVE_PROVIDER_AUTH_FAILED";
        errorMessage = `CoinGecko returned ${status}: invalid or unauthorized API key.`;
      } else if (status === 429) {
        executionStatus = "LIVE_PROVIDER_RATE_LIMITED";
        errorMessage = "CoinGecko rate limit exceeded. Try again later.";
      } else if (status >= 500) {
        executionStatus = "LIVE_PROVIDER_UNAVAILABLE";
        errorMessage = `CoinGecko server error (${status}).`;
      } else {
        executionStatus = "LIVE_PROVIDER_UNAVAILABLE";
        errorMessage = `CoinGecko returned unexpected status ${status}.`;
      }

      return {
        status: executionStatus,
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage,
      };
    }

    // ── Parse and normalize ───────────────────────────────────────────────
    let raw: CoinGeckoSimplePriceResponse;
    try {
      raw = await response.json() as CoinGeckoSimplePriceResponse;
    } catch {
      const completedAt = Date.now();
      return {
        status: "LIVE_PROVIDER_BAD_RESPONSE",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage: "CoinGecko returned a response that could not be parsed as JSON.",
      };
    }

    // Validate that at least one expected asset is present
    const hasAnyAsset = assets.some((id) => id in raw);
    if (!hasAnyAsset || typeof raw !== "object" || raw === null) {
      const completedAt = Date.now();
      return {
        status: "LIVE_PROVIDER_BAD_RESPONSE",
        service: request.service,
        providerId: this.providerId,
        providerName: this.providerName,
        executionMode: "live",
        payload: null,
        startedAt,
        completedAt,
        measuredLatencyMs: completedAt - startedAt,
        declaredCost: request.selectedProvider.price,
        allocatedBudget: request.allocatedBudget,
        errorMessage: "CoinGecko response did not contain expected asset data.",
      };
    }

    // ── Build structured payload ──────────────────────────────────────────
    const completedAt = Date.now();
    const fetchedAt = new Date(completedAt).toISOString();
    const structuredPayload = normalizeCoinGeckoResponse(raw, assets, currency, fetchedAt);
    const textPayload = formatLivePayload(structuredPayload);

    return {
      status: "SUCCESS",
      service: request.service,
      providerId: this.providerId,
      providerName: this.providerName,
      executionMode: "live",
      payload: textPayload,
      structuredPayload,
      startedAt,
      completedAt,
      measuredLatencyMs: completedAt - startedAt,
      declaredCost: request.selectedProvider.price,
      allocatedBudget: request.allocatedBudget,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory — reads API key from environment (server-side only)
// ---------------------------------------------------------------------------

/**
 * Creates a CoinGeckoAdapter using the COINGECKO_API_KEY environment variable.
 * Returns null if the key is not configured — callers must handle this explicitly.
 *
 * IMPORTANT: This function must only be called in server-side code (src/server/).
 * Never import this into any client bundle.
 */
export function createCoinGeckoAdapter(): CoinGeckoAdapter {
  // Safely read the environment variable — undefined if not set
  const apiKey =
    typeof process !== "undefined" ? (process.env["COINGECKO_API_KEY"] ?? undefined) : undefined;

  return new CoinGeckoAdapter(apiKey);
}
