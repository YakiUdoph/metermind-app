import { Contract, JsonRpcProvider } from "ethers";
import { erc8004GetAgentWalletAction, erc8004GetClientsAction, erc8004GetMetadataAction, erc8004GetReputationAction, getIdentityRegistryAddress, getReputationRegistryAddress } from "@goatnetwork/agentkit/plugins";
import type { ProviderTrustProfile } from "./procurement-engine-types";

const CHAIN_ID = 48816;
const ZERO = "0x0000000000000000000000000000000000000000";
export interface TrustDataProvider { getIdentity(providerId: string): Promise<ProviderTrustProfile>; }

export const TEST_FIXTURE_PROFILES: Record<string, ProviderTrustProfile> = {
  coingecko: { providerId: "coingecko", identity: { status: "UNVERIFIED", source: "PROVIDER_METADATA", provenance: "TEST_FIXTURE", agentURI: "https://api.coingecko.com/api/v3", metadataTimestamp: "2026-08-19T00:00:00.000Z" }, reputation: { status: "UNAVAILABLE", provenance: "TEST_FIXTURE" } },
  bitfinex: { providerId: "bitfinex", identity: { status: "UNVERIFIED", source: "PROVIDER_METADATA", provenance: "TEST_FIXTURE", agentURI: "https://api-pub.bitfinex.com/v2", metadataTimestamp: "2026-08-19T00:00:00.000Z" }, reputation: { status: "UNAVAILABLE", provenance: "TEST_FIXTURE" } },
  paidresearchapi: { providerId: "paidresearchapi", identity: { status: "VERIFIED", source: "ERC8004", provenance: "TEST_FIXTURE", agentId: "agent_paid_research_01", registry: "0x556089008Fc0a60cD09390Eca93477ca254A5522", agentURI: "https://api.paid-research.internal/v1/research", wallet: "0x789C402PaidResearchMerchantAddress0000", metadataTimestamp: "2026-08-19T00:00:00.000Z" }, reputation: { status: "AVAILABLE", score: 95, count: 142, source: "ERC8004", provenance: "TEST_FIXTURE", evidence: "QmEvidenceHashResearch1122", updatedAt: "2026-08-19T00:00:00.000Z" } },
};

const key = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");
const unavailable = (providerId: string, status: "NOT_CONFIGURED" | "UNAVAILABLE"): ProviderTrustProfile => ({ providerId, identity: { status, source: "ERC8004", provenance: status }, reputation: { status: "UNAVAILABLE", provenance: status } });

export class FixtureTrustProvider implements TrustDataProvider {
  constructor(private readonly profiles = TEST_FIXTURE_PROFILES) {}
  async getIdentity(providerId: string): Promise<ProviderTrustProfile> {
    return this.profiles[key(providerId)] ?? { providerId, identity: { status: "UNAVAILABLE", source: "UNKNOWN", provenance: "TEST_FIXTURE" }, reputation: { status: "UNAVAILABLE", provenance: "TEST_FIXTURE" } };
  }
}

export interface ERC8004TrustProviderOptions { rpcUrls?: string[]; network?: string; agentIdMap?: Record<string, string>; timeoutMs?: number; cacheTtlMs?: number; }

/** Read-only AgentKit ERC-8004 adapter. RPC failure never triggers fixture fallback. */
export class ERC8004TrustProvider implements TrustDataProvider {
  private readonly rpcUrls: string[];
  private readonly network: string;
  private readonly agentIdMap: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { expiresAt: number; profile: ProviderTrustProfile }>();

  constructor(rpcOrOptions?: string | ERC8004TrustProviderOptions, network = "goat-testnet", agentIdMap?: Record<string, string>) {
    const options: ERC8004TrustProviderOptions = typeof rpcOrOptions === "string"
      ? { rpcUrls: [rpcOrOptions], network, ...(agentIdMap ? { agentIdMap } : {}) }
      : (rpcOrOptions ?? {});
    const defaults = [process.env["GOAT_RPC_URL"], process.env["GOAT_RPC_URL_FALLBACK_1"], "https://rpc.testnet3.goat.network"];
    this.rpcUrls = [...new Set((options.rpcUrls?.length ? options.rpcUrls : defaults).filter((v): v is string => !!v))];
    this.network = options.network ?? "goat-testnet";
    const configuredId = process.env["GOAT_PAID_RESEARCH_AGENT_ID"]?.trim();
    this.agentIdMap = options.agentIdMap ?? (configuredId ? { paidresearchapi: configuredId } : {});
    this.timeoutMs = options.timeoutMs ?? 7_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000;
  }

  private timeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC_TIMEOUT")), this.timeoutMs))]);
  }

  private async read(provider: JsonRpcProvider, providerId: string, agentId: string): Promise<ProviderTrustProfile> {
    const network = await this.timeout(provider.getNetwork());
    if (Number(network.chainId) !== CHAIN_ID) throw new Error("WRONG_CHAIN");
    const identityRegistry = getIdentityRegistryAddress(this.network);
    const reputationRegistry = getReputationRegistryAddress(this.network);
    const codes = await Promise.all([this.timeout(provider.getCode(identityRegistry)), this.timeout(provider.getCode(reputationRegistry))]);
    if (codes.includes("0x")) throw new Error("REGISTRY_CODE_MISSING");
    const adapter = {
      callContract: async (address: string, abi: readonly string[], functionName: string, args: readonly unknown[]) => this.timeout(new Contract(address, abi, provider)[functionName]!(...args)),
      writeContract: async (): Promise<never> => { throw new Error("READ_ONLY"); },
    };
    const context = { traceId: `erc8004-read-${providerId}`, network: this.network, now: Date.now(), signal: AbortSignal.timeout(this.timeoutMs) };
    const wallet = await erc8004GetAgentWalletAction(adapter as never).execute(context, { agentId });
    if (!wallet.wallet || wallet.wallet.toLowerCase() === ZERO) throw new Error("NO_AGENT_WALLET");
    let agentURI: string | undefined;
    try { const result = await erc8004GetMetadataAction(adapter as never).execute(context, { agentId, metadataKey: "agentURI" }); if (result.metadataValue && result.metadataValue !== "0x") agentURI = result.metadataValue; } catch { /* optional */ }
    let clients: string[] | undefined;
    try { clients = (await erc8004GetClientsAction(adapter as never).execute(context, { agentId })).clients; } catch { /* unknown */ }
    let reputation: ProviderTrustProfile["reputation"] = { status: "UNAVAILABLE", provenance: "UNAVAILABLE" };
    try {
      const result = await erc8004GetReputationAction(adapter as never).execute(context, { agentId, clientAddresses: [], tag1: "", tag2: "" });
      const count = Number(result.count);
      reputation = count > 0 ? { status: "AVAILABLE", score: Number(result.summaryValue) / (10 ** result.summaryValueDecimals), count, source: "ERC8004", provenance: "ERC8004_ONCHAIN", updatedAt: new Date().toISOString() } : { status: "AVAILABLE_WITH_NO_FEEDBACK", count: 0, source: "ERC8004", provenance: "ERC8004_ONCHAIN", updatedAt: new Date().toISOString() };
    } catch { if (clients?.length === 0) reputation = { status: "AVAILABLE_WITH_NO_FEEDBACK", count: 0, source: "ERC8004", provenance: "ERC8004_ONCHAIN", updatedAt: new Date().toISOString() }; }
    return { providerId, identity: { status: "VERIFIED", source: "ERC8004", provenance: "ERC8004_ONCHAIN", agentId, registry: identityRegistry, wallet: wallet.wallet, ...(agentURI ? { agentURI } : {}), metadataTimestamp: new Date().toISOString() }, reputation };
  }

  async getIdentity(providerId: string): Promise<ProviderTrustProfile> {
    const normalized = key(providerId);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.profile;
    const agentId = this.agentIdMap[normalized];
    if (!agentId || !/^\d+$/.test(agentId)) return unavailable(providerId, "NOT_CONFIGURED");
    for (const url of this.rpcUrls) {
      try { const profile = await this.read(new JsonRpcProvider(url, undefined, { staticNetwork: false }), providerId, agentId); this.cache.set(normalized, { profile, expiresAt: Date.now() + this.cacheTtlMs }); return profile; } catch { /* next RPC; never fixtures */ }
    }
    return unavailable(providerId, "UNAVAILABLE");
  }
}

export function getProviderTrustProfile(providerId: string): ProviderTrustProfile {
  return TEST_FIXTURE_PROFILES[key(providerId)] ?? { providerId, identity: { status: "UNAVAILABLE", source: "UNKNOWN", provenance: "TEST_FIXTURE" }, reputation: { status: "UNAVAILABLE", provenance: "TEST_FIXTURE" } };
}
export function registerProviderTrustProfile(profile: ProviderTrustProfile): void { TEST_FIXTURE_PROFILES[key(profile.providerId)] = { ...profile }; }
