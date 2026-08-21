import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits, isAddress } from "ethers";
import { createControlledDemoOffer, LIVE_PAYMENT_POLICY } from "../src/domain/payment/live-payment-policy";

const CHAIN_ID = 48816;
const DEMO_BUDGET_USDC = 0.25;
const LAST_VERIFIED_MERCHANT_FEE_USD = 0;
const REQUIRED_MERCHANT_FEE_USD = 0.05;
const LIVE_MINIMUM_PAYMENT_USDC = 0.1;

function loadEnvironment(): void {
  try {
    for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[2] === undefined || process.env[match[1]!]) continue;
      process.env[match[1]!] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch { /* Missing local env is reported below. */ }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 20_000): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("RPC_TIMEOUT")), timeoutMs))]);
}

async function connectRpc(): Promise<{ provider: JsonRpcProvider; endpoint: string; blockNumber: number }> {
  const candidates = [process.env["GOAT_RPC_URL"], process.env["GOAT_RPC_URL_FALLBACK_1"], "https://rpc.testnet3.goat.network"]
    .filter((value, index, values): value is string => !!value && values.indexOf(value) === index);
  for (const endpoint of candidates) {
    try {
      const provider = new JsonRpcProvider(endpoint, undefined, { staticNetwork: false });
      if (Number((await withTimeout(provider.getNetwork())).chainId) !== CHAIN_ID) continue;
      return { provider, endpoint: new URL(endpoint).origin, blockNumber: await withTimeout(provider.getBlockNumber()) };
    } catch { /* Try next configured endpoint. */ }
  }
  throw new Error("NO_GOAT_TESTNET3_RPC_AVAILABLE");
}

async function main(): Promise<void> {
  loadEnvironment();
  const merchantId = process.env["GOATX402_MERCHANT_ID"]?.trim();
  const apiUrl = (process.env["GOATX402_API_URL"] || "https://flow-api.testnet3.goat.network").replace(/\/$/, "");
  const privateKey = process.env["GOAT_PRIVATE_KEY"];
  if (!merchantId || !privateKey) throw new Error("LIVE_PREFLIGHT_CONFIGURATION_MISSING");

  const payer = new Wallet(privateKey).address;
  const response = await fetch(`${apiUrl}/merchants/${encodeURIComponent(merchantId)}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`MERCHANT_LOOKUP_HTTP_${response.status}`);
  const merchant = await response.json() as any;
  const route = merchant.wallets?.find((candidate: any) => Number(candidate.chain_id) === CHAIN_ID && candidate.token_symbol === "USDC");
  if (!route || !isAddress(route.address) || !isAddress(route.token_contract)) throw new Error("GOAT_TESTNET3_USDC_ROUTE_INVALID");

  const rpc = await connectRpc();
  const token = new Contract(route.token_contract, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], rpc.provider);
  const [nativeBalance, tokenBalance, chainDecimals] = await Promise.all([
    withTimeout(rpc.provider.getBalance(payer)),
    withTimeout(token["balanceOf"]!(payer)) as Promise<bigint>,
    withTimeout(token["decimals"]!()) as Promise<bigint>,
  ]);
  const decimals = Number(chainDecimals);
  const receiver = String(route.address);
  const feeSufficient = LAST_VERIFIED_MERCHANT_FEE_USD >= REQUIRED_MERCHANT_FEE_USD;
  const offer = createControlledDemoOffer({ merchantId, enabled: merchant.enabled === true, receiveMode: merchant.receive_type, receiver, chainId: CHAIN_ID, tokenSymbol: "USDC", tokenContract: route.token_contract, decimals, minimumPayment: LIVE_MINIMUM_PAYMENT_USDC, quoteTimestamp: new Date().toISOString() }, DEMO_BUDGET_USDC);

  // No create-order probe while the last authoritative authenticated fee check is insufficient.
  // Public merchant discovery does not expose fee balance; verify/fund it in the Merchant Portal.
  const externalBlockers = feeSufficient ? [] : ["MERCHANT_FEE_UNFUNDED"];
  const softwareBlockers: string[] = [];
  if (payer.toLowerCase() === receiver.toLowerCase()) softwareBlockers.push("PAYER_EQUALS_RECEIVER");
  if (decimals !== Number(route.decimals)) softwareBlockers.push("TOKEN_DECIMALS_MISMATCH");
  if (nativeBalance === 0n) softwareBlockers.push("PAYER_GAS_UNFUNDED");
  if (tokenBalance < BigInt(Math.round(offer.amount * 10 ** decimals))) softwareBlockers.push("PAYER_TOKEN_UNFUNDED");

  console.log(JSON.stringify({
    proofType: "PHASE 3.1C-2 FINAL NO-BROADCAST READINESS",
    verdict: externalBlockers.length ? "BLOCKED" : softwareBlockers.length ? "PARTIAL" : "READY",
    noSignature: true, noBroadcast: true, orderCreationAttempted: false,
    merchant: { id: merchant.merchant_id, enabled: merchant.enabled === true, receiveMode: merchant.receive_type, receiver,
      feeBalanceUsd: LAST_VERIFIED_MERCHANT_FEE_USD, feeRequiredUsd: REQUIRED_MERCHANT_FEE_USD, feeSufficient,
      feeEvidence: "LAST_AUTHENTICATED_GOATFLOW_ORDER_API_RESPONSE; PUBLIC_MERCHANT_API_HAS_NO_FEE_BALANCE_FIELD" },
    payer: { address: payer, distinctFromReceiver: payer.toLowerCase() !== receiver.toLowerCase(), nativeGas: `${formatEther(nativeBalance)} BTC`, tokenBalance: `${formatUnits(tokenBalance, decimals)} USDC` },
    chain: { id: CHAIN_ID, name: "GOAT Testnet3", blockNumber: rpc.blockNumber, rpc: rpc.endpoint },
    token: { symbol: "USDC", contract: route.token_contract, decimals }, commercialOffer: offer,
    paymentPolicy: LIVE_PAYMENT_POLICY,
    order: { created: false, reason: feeSufficient ? "NOT_REQUESTED_BY_THIS_NO_BROADCAST_RUN" : "BLOCKED_MERCHANT_FEE_UNFUNDED" },
    buyContract: { created: false, reason: "REQUIRES_REAL_ORDER_ID_AND_EXPIRY" },
    authorizationPreview: { created: false, reason: "REQUIRES_REAL_ORDER_AND_FROZEN_BUY_CONTRACT" },
    externalBlockers, softwareBlockers,
    safeToAuthorizeOneTestnetPayment: externalBlockers.length === 0 && softwareBlockers.length === 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ proofType: "PHASE 3.1C-2 FINAL NO-BROADCAST READINESS", verdict: "BLOCKED", noSignature: true, noBroadcast: true, error: error instanceof Error ? error.message : "UNKNOWN" }, null, 2));
  process.exitCode = 1;
});
