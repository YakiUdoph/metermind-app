/**
 * MeterMind Server — Bitfinex Live Market-Data Adapter (Milestone #5)
 *
 * This file is server-side only. It performs real HTTP requests to the
 * Bitfinex Public REST API.
 *
 * Security rules enforced here:
 *   - Public API, no key required.
 *   - Invariant: executionMode is "live".
 *   - Timeout: 8 000 ms via AbortController.
 *
 * Error mapping:
 *   HTTP 429     → LIVE_PROVIDER_RATE_LIMITED
 *   HTTP 5xx     → LIVE_PROVIDER_UNAVAILABLE
 *   Network fail → LIVE_PROVIDER_UNAVAILABLE
 *   Bad JSON     → LIVE_PROVIDER_BAD_RESPONSE
 *   Timeout      → EXECUTION_TIMEOUT
 */

import type {
  ProviderAdapter,
  ServiceExecutionRequest,
  ServiceExecutionResult,
  LiveMarketDataPayload,
  LiveAssetPrice,
} from "@/domain/execution/types";
import type { ServiceCategory } from "@/domain/planning/types";

const BITFINEX_BASE_URL = "https://api-pub.bitfinex.com/v2";
const REQUEST_TIMEOUT_MS = 8_000;

export const BITFINEX_PROVIDER_ID = "bitfinex";
export const BITFINEX_PROVIDER_NAME = "Bitfinex";

/**
 * Symbol mapping.
 * Bitfinex uses symbols prefixed with 't' for trading pairs (e.g. tBTCUSD).
 */
const SYMBOL_TO_PAIR: Record<string, string> = {
  btc: "tBTCUSD",
  eth: "tETHUSD",
  bitcoin: "tBTCUSD",
  ethereum: "tETHUSD",
};

export function extractBitfinexAssetsFromTask(task: string): string[] {
  const lower = task.toLowerCase();
  const found = new Set<string>();

  for (const [alias, pair] of Object.entries(SYMBOL_TO_PAIR)) {
    if (lower.includes(alias)) {
      found.add(pair);
    }
  }

  // Default to both if none specified
  if (found.size === 0) {
    return ["tBTCUSD", "tETHUSD"];
  }
  return [...found];
}

/**
 * Bitfinex Ticker Array format:
 * [
 *   SYMBOL,
 *   BID,
 *   BID_SIZE,
 *   ASK,
 *   ASK_SIZE,
 *   DAILY_CHANGE,
 *   DAILY_CHANGE_RELATIVE,
 *   LAST_PRICE,
 *   VOLUME,
 *   HIGH,
 *   LOW
 * ]
 */
type BitfinexTickerRow = [
  string, // 0: SYMBOL
  number, // 1: BID
  number, // 2: BID_SIZE
  number, // 3: ASK
  number, // 4: ASK_SIZE
  number, // 5: DAILY_CHANGE
  number, // 6: DAILY_CHANGE_RELATIVE
  number, // 7: LAST_PRICE
  number, // 8: VOLUME
  number, // 9: HIGH
  number  // 10: LOW
];

function normalizeBitfinexResponse(
  raw: BitfinexTickerRow[],
  requestedPairs: string[],
  currency: string,
  fetchedAt: string,
): LiveMarketDataPayload {
  const assetPrices: LiveAssetPrice[] = requestedPairs.map((pair) => {
    const row = raw.find((r) => r[0] === pair);
    
    let assetId = "unknown";
    let symbol = "UNKNOWN";
    let name = "Unknown";
    
    if (pair === "tBTCUSD") {
      assetId = "bitcoin";
      symbol = "BTC";
      name = "Bitcoin";
    } else if (pair === "tETHUSD") {
      assetId = "ethereum";
      symbol = "ETH";
      name = "Ethereum";
    }

    const price = row ? row[7] : 0;
    const dailyChangePercent = row ? row[6] * 100 : null; // Bitfinex relative change is fraction (e.g. 0.002 = 0.2%)
    const volume = row ? row[8] : null;

    return {
      assetId,
      symbol,
      name,
      currency,
      price,
      marketCap: null, // Bitfinex ticker does not supply market cap directly
      volume24h: volume,
      priceChangePercent24h: dailyChangePercent,
    };
  });

  return {
    assets: assetPrices,
    fetchedAt,
    dataSource: "Bitfinex Public API",
    currency,
  };
}

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
    if (asset.volume24h !== null) {
      lines.push(`  24h Volume: $${asset.volume24h.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
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

export class BitfinexAdapter implements ProviderAdapter {
  readonly providerId = BITFINEX_PROVIDER_ID;
  readonly providerName = BITFINEX_PROVIDER_NAME;
  readonly supportedCapabilities: readonly ServiceCategory[] = ["market_data"];
  readonly executionMode = "live" as const;

  isAvailable(): boolean {
    return true; // Public unauthenticated API, always available
  }

  async execute(request: ServiceExecutionRequest): Promise<ServiceExecutionResult> {
    const startedAt = Date.now();

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
        errorMessage: `BitfinexAdapter only supports "market_data"; received "${request.service}".`,
      };
    }

    const requestedPairs = extractBitfinexAssetsFromTask(request.task);
    const currency = "usd";
    const symbolsParam = requestedPairs.join(",");

    const url = `${BITFINEX_BASE_URL}/tickers?symbols=${symbolsParam}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
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
          ? `Bitfinex request timed out after ${REQUEST_TIMEOUT_MS}ms.`
          : `Network error reaching Bitfinex: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const completedAt = Date.now();
      const status = response.status;
      let executionStatus: ServiceExecutionResult["status"] = "LIVE_PROVIDER_UNAVAILABLE";
      let errorMessage = `Bitfinex returned unexpected status ${status}.`;

      if (status === 429) {
        executionStatus = "LIVE_PROVIDER_RATE_LIMITED";
        errorMessage = "Bitfinex rate limit exceeded. Try again later.";
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

    let raw: any;
    try {
      raw = await response.json();
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
        errorMessage: "Bitfinex returned a response that could not be parsed as JSON.",
      };
    }

    if (!Array.isArray(raw)) {
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
        errorMessage: "Bitfinex response format is invalid (expected array).",
      };
    }

    const completedAt = Date.now();
    const fetchedAt = new Date(completedAt).toISOString();
    const structuredPayload = normalizeBitfinexResponse(raw as BitfinexTickerRow[], requestedPairs, currency, fetchedAt);
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
