import type { BuyContract } from "../payment/contract";
import { hashBuyContract } from "../payment/contract";
import type { ProcurementRequest, ProviderOffer } from "./procurement-engine-types";
import { runProcurement } from "./scoring";
import type { TrustDataProvider } from "./trust";
import type { Provider } from "@/lib/mock";

/**
 * Checks if a quote has expired based on its quoteExpiry timestamp or a TTL limit.
 */
export function isQuoteExpired(contract: BuyContract, ttlMs: number = 5000): boolean {
  if (contract.quoteExpiry) {
    return new Date(contract.quoteExpiry).getTime() < Date.now();
  }
  const timestamp = new Date(contract.quoteTimestamp).getTime();
  return Date.now() - timestamp > ttlMs;
}

/**
 * Executes quote validation before freezing the Buy Contract:
 * If expired, attempts to fetch new quotes, rescore candidates, select the winner, and freeze the new contract.
 */
export async function requoteAndSelectWinner(
  currentContract: BuyContract,
  request: ProcurementRequest,
  providerCatalog: Provider[],
  requoteFn: (providerId: string, service: string) => Promise<ProviderOffer>,
  maxAttempts = 2,
  trustProvider?: TrustDataProvider,
): Promise<BuyContract> {
  let attempt = 0;
  let contract = { ...currentContract };

  while (attempt < maxAttempts) {
    if (!isQuoteExpired(contract)) {
      return contract;
    }
    
    attempt++;
    
    // Obtain fresh quotes from the catalog
    const freshOffers: ProviderOffer[] = [];
    for (const p of providerCatalog) {
      if (Array.isArray(p.capabilities) && (p.capabilities as string[]).includes(contract.service)) {
        try {
          const fresh = await requoteFn(p.id || p.name.toLowerCase(), contract.service);
          freshOffers.push(fresh);
        } catch {
          // Ignore failed providers in the refresh loop
        }
      }
    }

    if (freshOffers.length === 0) {
      throw new Error(`Requote attempt ${attempt} failed: no offers returned.`);
    }

    // Update catalog prices with fresh offer values for rescoring
    const updatedCatalog = providerCatalog.map((p) => {
      const offer = freshOffers.find(o => o.providerId === (p.id || p.name.toLowerCase()));
      if (offer) {
        return {
          ...p,
          price: offer.price,
          latency: offer.observedLatencyMs || offer.estimatedLatencyMs,
          quality: offer.quality,
          reliability: offer.reliability
        };
      }
      return p;
    });

    // Rescore and confirm winner
    const trace = await runProcurement(request, updatedCatalog, contract.service, trustProvider);
    if (!trace.winner) {
      throw new Error(`Requote attempt ${attempt} failed: no eligible winner found.`);
    }

    const winnerOffer = freshOffers.find(o => o.providerId === trace.winner);
    if (!winnerOffer) {
      throw new Error(`Requote attempt ${attempt} failed: winner offer not found in fresh quotes.`);
    }

    // Build the frozen contract with the new quote details
    const newContract: BuyContract = {
      contractId: contract.contractId,
      requirementHash: contract.requirementHash,
      service: contract.service,
      providerId: winnerOffer.providerId,
      providerEndpoint: `https://api.${winnerOffer.providerId}.internal/v1`,
      quoteId: `q_${Math.random().toString(36).substring(2, 10)}`,
      quoteTimestamp: winnerOffer.timestamp,
      quoteExpiry: new Date(new Date(winnerOffer.timestamp).getTime() + (winnerOffer.ttlMs || 5000)).toISOString(),
      maximumAuthorizedAmount: request.budget,
      actualQuotedAmount: winnerOffer.price,
      currency: winnerOffer.currency,
      network: winnerOffer.network || "GOAT-Testnet",
      recipient: `0x${winnerOffer.providerId}Address0000`,
      idempotencyKey: request.taskId,
      createdAt: new Date().toISOString(),
      decisionEvidenceHash: trace.traceId
    };

    // Calculate contractHash (freeze the contract)
    const { contractHash: _, ...rest } = newContract;
    newContract.contractHash = hashBuyContract(rest);

    contract = newContract;
  }

  // If still expired after max attempts, throw
  if (isQuoteExpired(contract)) {
    throw new Error("Quote expired and all requote attempts failed.");
  }

  return contract;
}
