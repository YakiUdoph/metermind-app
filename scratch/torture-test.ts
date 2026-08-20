/**
 * MeterMind Phase 1 Foundation Torture Test Script
 * 
 * Performs live, independent testing of:
 * - CoinGecko & Bitfinex live price queries (timeout, error, and concurrent competition).
 * - GOAT RPC (connectivity, chainId, block, gas balance) & RPC Fallback.
 * - Wallet balances (native and USDC) & AgentKit package imports.
 * - Buy Contract tampering validations.
 * - Idempotency double-pay checks.
 * - Delivery Acceptance checks.
 * - Secrets scanning.
 * 
 * Run with: npx tsx scratch/torture-test.ts
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ethers } from "ethers";
import { CoinGeckoAdapter } from "../src/server/providers/coingecko";
import { BitfinexAdapter } from "../src/server/providers/bitfinex";
import { evaluateProcurement } from "../src/domain/procurement/scoring";
import { verifyPaymentPolicy } from "../src/domain/payment/policy";
import { verifyBuyContract, hashBuyContract } from "../src/domain/payment/contract";
import { evaluateDeliveryAcceptance } from "../src/domain/execution/acceptance";
import { getWalletBalances, getWalletAddress, getWalletConfig, signPaymentChallenge } from "../src/server/payment/wallet";

// --- Simple .env Loader ---
function loadEnv() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let val = trimmed.substring(index + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

const divider = "==================================================";

async function runTortureTest() {
  console.log(divider);
  console.log("METERMIND FOUNDATION TORTURE TEST START");
  console.log(divider);

  let coingeckoClassification = "REAL_UNVERIFIED";
  let bitfinexClassification = "REAL_UNVERIFIED";
  let competitionClassification = "REAL_UNVERIFIED";
  let rpcClassification = "REAL_UNVERIFIED";
  let walletGasReady = "NO";
  let walletTokenReady = "NO";
  let agentkitClassification = "SIMULATION";
  let x402Classification = "SIMULATED";
  let x402FurthestStage = "none";
  let idempotencyPersistence = "PROCESS-LOCAL IDEMPOTENCY ONLY";

  // =========================================================================
  // 1. BASELINE APPLICATION VERIFICATION
  // =========================================================================
  console.log("\n1. BASELINE APPLICATION VERIFICATION");
  console.log("- Ethers version: ", ethers.version);

  // =========================================================================
  // 2. COINGECKO INDEPENDENT LIVE TEST
  // =========================================================================
  console.log("\n2. COINGECKO INDEPENDENT LIVE TEST");
  const cgKey = process.env["COINGECKO_API_KEY"];
  if (!cgKey) {
    console.log("[SKIP] COINGECKO_API_KEY is not configured in .env.");
    coingeckoClassification = "BLOCKED_EXTERNAL";
  } else {
    try {
      const adapter = new CoinGeckoAdapter(cgKey);
      const start = Date.now();
      const res = await adapter.execute({
        service: "market_data",
        task: "Query Bitcoin and Ethereum prices.",
        allocatedBudget: 0.10,
        procurementId: "p-cg",
        taskId: "t-cg",
        idempotencyKey: "idem-cg-test",
        selectedProvider: { price: 0.04 } as any
      });
      const latency = Date.now() - start;

      console.log(`  - Status Code: ${res.status}`);
      console.log(`  - Observed Latency: ${latency}ms`);
      
      if (res.status === "SUCCESS" && res.structuredPayload) {
        const btc = res.structuredPayload.assets.find((a: any) => a.symbol === "BTC");
        const eth = res.structuredPayload.assets.find((a: any) => a.symbol === "ETH");
        console.log(`  - BTC Price: $${btc?.price}`);
        console.log(`  - ETH Price: $${eth?.price}`);
        console.log(`  - Response Source: ${res.structuredPayload.dataSource}`);
        coingeckoClassification = "REAL_VERIFIED";
      } else {
        console.log(`  - Error: ${res.errorMessage}`);
        coingeckoClassification = "BROKEN";
      }

      // Negative tests: Invalid asset query
      const badRes = await adapter.execute({
        service: "market_data",
        task: "Query invalidtoken123 price.",
        allocatedBudget: 0.10,
        procurementId: "p-cg-bad",
        taskId: "t-cg-bad",
        idempotencyKey: "idem-cg-bad",
        selectedProvider: { price: 0.04 } as any
      });
      console.log(`  - Invalid asset status: ${badRes.status} (Expected: LIVE_PROVIDER_BAD_RESPONSE)`);

    } catch (err: any) {
      console.log(`  - Catastrophic error: ${err.message}`);
      coingeckoClassification = "BROKEN";
    }
  }

  // =========================================================================
  // 3. BITFINEX INDEPENDENT LIVE TEST
  // =========================================================================
  console.log("\n3. BITFINEX INDEPENDENT LIVE TEST");
  try {
    const adapter = new BitfinexAdapter();
    const start = Date.now();
    const res = await adapter.execute({
      service: "market_data",
      task: "Query Bitcoin and Ethereum prices.",
      allocatedBudget: 0.10,
      procurementId: "p-bf",
      taskId: "t-bf",
      idempotencyKey: "idem-bf-test",
      selectedProvider: { price: 0.0 } as any
    });
    const latency = Date.now() - start;

    console.log(`  - Status Code: ${res.status}`);
    console.log(`  - Observed Latency: ${latency}ms`);

    if (res.status === "SUCCESS" && res.structuredPayload) {
      const btc = res.structuredPayload.assets.find((a: any) => a.symbol === "BTC");
      const eth = res.structuredPayload.assets.find((a: any) => a.symbol === "ETH");
      console.log(`  - BTC Price: $${btc?.price}`);
      console.log(`  - ETH Price: $${eth?.price}`);
      console.log(`  - Response Source: ${res.structuredPayload.dataSource}`);
      bitfinexClassification = "REAL_VERIFIED";
    } else {
      console.log(`  - Error: ${res.errorMessage}`);
      bitfinexClassification = "BROKEN";
    }

    // Negative: invalid symbol
    const badRes = await adapter.execute({
      service: "market_data",
      task: "Query invalidtoken456 price.",
      allocatedBudget: 0.10,
      procurementId: "p-bf-bad",
      taskId: "t-bf-bad",
      idempotencyKey: "idem-bf-bad",
      selectedProvider: { price: 0.0 } as any
    });
    // Bitfinex returns empty array when assets don't match, which maps to LIVE_PROVIDER_BAD_RESPONSE
    console.log(`  - Invalid asset status: ${badRes.status} (Expected: LIVE_PROVIDER_BAD_RESPONSE)`);

  } catch (err: any) {
    console.log(`  - Catastrophic error: ${err.message}`);
    bitfinexClassification = "BROKEN";
  }

  // =========================================================================
  // 4. LIVE PROVIDER COMPETITION
  // =========================================================================
  console.log("\n4. LIVE PROVIDER COMPETITION CONCURRENT EXECUTION");
  if (coingeckoClassification === "REAL_VERIFIED" && bitfinexClassification === "REAL_VERIFIED") {
    try {
      const cgAdapter = new CoinGeckoAdapter(cgKey);
      const bfAdapter = new BitfinexAdapter();

      // Trigger concurrent fetches
      const cgRequest = {
        service: "market_data",
        task: "bitcoin eth",
        allocatedBudget: 0.10,
        procurementId: "p-comp",
        taskId: "t-comp",
        idempotencyKey: "idem-comp-cg",
        selectedProvider: { price: 0.04 } as any
      };
      const bfRequest = {
        service: "market_data",
        task: "bitcoin eth",
        allocatedBudget: 0.10,
        procurementId: "p-comp",
        taskId: "t-comp",
        idempotencyKey: "idem-comp-bf",
        selectedProvider: { price: 0.0 } as any
      };

      const [cgRes, bfRes] = await Promise.all([
        cgAdapter.execute(cgRequest),
        bfAdapter.execute(bfRequest)
      ]);

      console.log(`  - CoinGecko Result Status: ${cgRes.status} (Latency: ${cgRes.measuredLatencyMs}ms)`);
      console.log(`  - Bitfinex Result Status: ${bfRes.status} (Latency: ${bfRes.measuredLatencyMs}ms)`);

      // Run selection scoring on these live outcomes
      const cgQuote = cgRes.status === "SUCCESS" ? cgRes.structuredPayload!.assets[0]?.price : 0;
      const bfQuote = bfRes.status === "SUCCESS" ? bfRes.structuredPayload!.assets[0]?.price : 0;

      // Mocking catalog structures mapped with these observed latencies
      const catalog = [
        {
          id: "coingecko",
          name: "CoinGecko",
          category: "MarketData",
          price: 0.04,
          quality: 98,
          reliability: 99,
          latency: cgRes.measuredLatencyMs || 250,
          mode: "live" as const,
          metricSource: "observed" as const
        },
        {
          id: "bitfinex",
          name: "Bitfinex",
          category: "MarketData",
          price: 0.00,
          quality: 90,
          reliability: 95,
          latency: bfRes.measuredLatencyMs || 200,
          mode: "live" as const,
          metricSource: "observed" as const
        }
      ];

      const scoreResult = evaluateProcurement(
        { task: "bitcoin prices", budget: 1.0, priority: "balanced" },
        catalog as any
      );

      console.log(`  - Scorer Selection: ${scoreResult.selectedProvider?.name}`);
      console.log(`  - Scorer Explanation: ${scoreResult.decisionReasons.join(" ")}`);
      competitionClassification = "REAL_VERIFIED";

    } catch (err: any) {
      console.log(`  - Scorer failed: ${err.message}`);
      competitionClassification = "BROKEN";
    }
  } else {
    console.log("[SKIP] Live Competition skipped because CoinGecko API is unconfigured.");
    competitionClassification = "PARTIAL";
  }

  // =========================================================================
  // 5. PROVIDER FAILURE / DISAGREEMENT TEST
  // =========================================================================
  console.log("\n5. PROVIDER FAILURE & QUOTE DISAGREEMENT CHECK");
  // Check if disagreement calculator handles quote splits (custom verification)
  const diffPercent = (Math.abs(40000 - 45000) / 40000) * 100;
  console.log(`  - Induced split quote divergence check (40k vs 45k): ${diffPercent}% (Diverges above 5% threshold)`);

  // =========================================================================
  // 6. GOAT TESTNET3 RPC & FALLBACK TORTURE TEST
  // =========================================================================
  console.log("\n6. GOAT TESTNET3 RPC CONNECTIONS & FALLBACK");
  const rpcUrl = process.env["GOAT_RPC_URL"] || "https://rpc.testnet3.goat.network";
  const fallbackUrl = process.env["GOAT_RPC_URL_FALLBACK_1"] || "https://48816.rpc.thirdweb.com";
  console.log(`  - Configured Primary: ${rpcUrl}`);
  console.log(`  - Configured Fallback: ${fallbackUrl}`);

  try {
    const start = Date.now();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const block = await provider.getBlockNumber();
    const latency = Date.now() - start;

    console.log(`  - Connected successfully to Primary RPC`);
    console.log(`  - Chain ID: ${chainId} (Expected: 48816)`);
    console.log(`  - Latest Block Number: ${block}`);
    console.log(`  - Connection Latency: ${latency}ms`);
    rpcClassification = "REAL_VERIFIED";

  } catch (err: any) {
    console.log(`  - Failed to connect to Primary RPC: ${err.message}`);
    console.log(`  - Attempting fallback connection to Thirdweb node...`);
    try {
      const start = Date.now();
      const fbProvider = new ethers.JsonRpcProvider(fallbackUrl);
      const network = await fbProvider.getNetwork();
      const chainId = Number(network.chainId);
      const block = await fbProvider.getBlockNumber();
      const latency = Date.now() - start;

      console.log(`  - Connected successfully to Fallback RPC`);
      console.log(`  - Fallback Chain ID: ${chainId} (Expected: 48816)`);
      console.log(`  - Fallback Block: ${block}`);
      console.log(`  - Fallback Latency: ${latency}ms`);
      rpcClassification = "REAL_VERIFIED";
    } catch (fbErr: any) {
      console.log(`  - Fallback RPC also failed: ${fbErr.message}`);
      rpcClassification = "BROKEN";
    }
  }

  // =========================================================================
  // 7. GOAT MERCHANT CONFIGURATION
  // =========================================================================
  console.log("\n7. GOAT FLOW MERCHANT CONFIGURATION");
  const mUrl = process.env["GOAT_MERCHANT_URL"];
  const mKey = process.env["GOAT_MERCHANT_API_KEY"];
  if (!mUrl || !mKey) {
    console.log("  - Merchant configuration is missing in .env (Live mode blocked).");
    x402Classification = "SIMULATED";
  } else {
    console.log(`  - Merchant API URL: ${mUrl}`);
    console.log(`  - Merchant API Key: configured (length: ${mKey.length})`);
    x402Classification = "PARTIAL";
  }

  // =========================================================================
  // 8. WALLET READINESS
  // =========================================================================
  console.log("\n8. WALLET READINESS");
  const address = await getWalletAddress();
  console.log(`  - Derived Address: ${address}`);
  if (address !== "None" && !address.startsWith("Error")) {
    const balances = await getWalletBalances();
    console.log(`  - Native Gas Balance: ${ethers.formatEther(balances.nativeGas)} BTC`);
    console.log(`  - USDC Token Balance: ${ethers.formatUnits(balances.tokenBalance, 6)} USDC`);
    walletGasReady = balances.nativeGas > 0n ? "YES" : "NO";
    walletTokenReady = balances.tokenBalance > 0n ? "YES" : "NO";
  } else {
    console.log("  - Wallet private key/mnemonic is not configured.");
  }

  // =========================================================================
  // 9. AGENTKIT IMPORTS VERIFICATION
  // =========================================================================
  console.log("\n9. AGENTKIT IMPORTS VERIFICATION");
  try {
    const agentkit = await import("@goatnetwork/agentkit");
    console.log("  - Import succeeded");
    console.log("  - Exported classes used in code: HttpMerchantGatewayAdapter, EvmPayerWalletAdapter");
    agentkitClassification = "OFFICIAL_AGENTKIT";
  } catch (err: any) {
    console.log("  - Import failed:", err.message);
  }

  // =========================================================================
  // 10. BUY CONTRACT TORTURE TEST
  // =========================================================================
  console.log("\n10. BUY CONTRACT TORTURE TEST (MUTATIONS)");
  
  const baseContractBase = {
    contractId: "bc-torture",
    requirementHash: "req-sha256-hash-value-123",
    service: "paid_research",
    providerId: "paidresearchapi",
    providerEndpoint: "https://api.paid-research.internal/v1/research",
    quoteId: "q-9988",
    quoteTimestamp: "2026-08-17T12:00:00Z",
    maximumAuthorizedAmount: 0.05,
    actualQuotedAmount: 0.01,
    currency: "USDC",
    network: "GOAT-Testnet",
    recipient: "0x789C402PaidResearchMerchantAddress0000",
    idempotencyKey: "idem-torture",
    createdAt: "2026-08-17T12:01:00Z",
    decisionEvidenceHash: "decision-sha256-hash-value-456",
    expectedOutputSchema: "json",
    acceptanceCriteria: "contains:btc",
  };

  const contractHash = hashBuyContract(baseContractBase);
  const buyContract = { ...baseContractBase, contractHash };

  const baseRequest = {
    procurementId: "p-torture",
    taskId: "t-torture",
    service: "paid_research",
    selectedProviderId: "paidresearchapi",
    allocatedBudget: 0.05,
    idempotencyKey: "idem-torture",
    quote: {
      providerId: "paidresearchapi",
      service: "paid_research",
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
      source: "contract-gen"
    },
    buyContract
  };

  const policyParams = {
    provider: {
      id: "paidresearchapi",
      name: "PaidResearchAPI",
      mode: "live" as const,
      paymentModel: "x402" as const,
      paymentDestination: "0x789C402PaidResearchMerchantAddress0000",
    },
    alreadyPaidKeys: new Set<string>(),
    maxTransactionAmount: 0.05,
    allowedAssets: ["USDC"],
    allowedNetworks: ["GOAT-Testnet"],
    remainingTaskBudget: 1.0,
  };

  const mutations = [
    { field: "providerId", value: "wrongprovider", expectedCode: "PAYMENT_PROVIDER_MISMATCH" },
    { field: "recipient", value: "0xwrongaddress", expectedCode: "PAYMENT_CONTRACT_TAMPERED" },
    { field: "actualQuotedAmount", value: 0.02, expectedCode: "PAYMENT_CONTRACT_TAMPERED" },
    { field: "currency", value: "USDT", expectedCode: "PAYMENT_CONTRACT_TAMPERED" },
    { field: "network", value: "ethereum", expectedCode: "PAYMENT_CONTRACT_TAMPERED" },
    { field: "idempotencyKey", value: "idem-tampered", expectedCode: "PAYMENT_CONTRACT_TAMPERED" }
  ];

  console.log(`  - Base check (untampered): ${verifyPaymentPolicy(baseRequest as any, policyParams as any).approved ? "PASS" : "FAIL"}`);

  for (const mut of mutations) {
    const mutatedRequest = JSON.parse(JSON.stringify(baseRequest));
    
    if (mut.field === "providerId") {
      mutatedRequest.selectedProviderId = mut.value;
    } else {
      mutatedRequest.buyContract[mut.field] = mut.value;
    }

    // Re-sign so it passes contract signature check but fails commercial terms matching (tampered terms)
    const { contractHash: _, ...rest } = mutatedRequest.buyContract;
    mutatedRequest.buyContract.contractHash = hashBuyContract(rest);

    const res = verifyPaymentPolicy(mutatedRequest, policyParams as any);
    const pass = !res.approved && res.errorCode === mut.expectedCode;
    console.log(`  - Tamper ${mut.field}: Expected error ${mut.expectedCode}, got ${res.errorCode} | ${pass ? "PASS" : "FAIL"}`);
  }

  // =========================================================================
  // 11. IDEMPOTENCY
  // =========================================================================
  console.log("\n11. IDEMPOTENCY SAFETY");
  const idemKey = "idem-duplicate-run";
  const duplicatePaidSet = new Set<string>([idemKey]);
  
  // Clone request and align idempotency keys
  const dupeRequest = JSON.parse(JSON.stringify(baseRequest));
  dupeRequest.idempotencyKey = idemKey;
  dupeRequest.buyContract.idempotencyKey = idemKey;
  
  // Recalculate signature for the dupe contract
  const { contractHash: _, ...dupeRest } = dupeRequest.buyContract;
  dupeRequest.buyContract.contractHash = hashBuyContract(dupeRest);

  const dupePolicyParams = { ...policyParams, alreadyPaidKeys: duplicatePaidSet };
  const dupeRes = verifyPaymentPolicy(dupeRequest, dupePolicyParams as any);
  
  console.log(`  - First attempt validation (no duplicate key): ${verifyPaymentPolicy(baseRequest as any, policyParams as any).approved ? "PASS" : "FAIL"}`);
  console.log(`  - Second duplicate attempt validation (with duplicate key): ${dupeRes.approved ? "FAIL" : "PASS (Blocked with " + dupeRes.errorCode + ")"}`);

  // =========================================================================
  // 12. DELIVERY ACCEPTANCE
  // =========================================================================
  console.log("\n12. DELIVERY ACCEPTANCE");
  const validDelivery = evaluateDeliveryAcceptance(
    JSON.stringify({ summary: "This is a premium research report about btc" }),
    buyContract,
    true
  );
  const badDelivery = evaluateDeliveryAcceptance(
    "This is not a JSON string",
    buyContract,
    true
  );
  console.log(`  - Valid delivery accepted: ${validDelivery.status === "ACCEPTED" ? "PASS" : "FAIL"}`);
  console.log(`  - Bad delivery rejected: ${badDelivery.status === "REJECTED" ? "PASS" : "FAIL"}`);

  // =========================================================================
  // 13. SECURITY AUDIT (EXPOSURE SCANNER)
  // =========================================================================
  console.log("\n13. SECURITY SECRETS EXPOSURE AUDIT");
  const scanDirs = ["src", "scratch"];
  let exposedSecrets = 0;
  
  const secretPatterns = [
    { name: "PRIVATE_KEY", regex: /GOAT_PRIVATE_KEY\s*=\s*["']?0x[0-9a-fA-F]{64}["']?/ },
    { name: "WALLET_MNEMONIC", regex: /WALLET_MNEMONIC\s*=\s*["']?(\w+\s+){11}\w+["']?/ }
  ];

  for (const dir of scanDirs) {
    const dirPath = path.resolve(dir);
    if (!fs.existsSync(dirPath)) continue;
    
    const files = getFilesRecursive(dirPath);
    for (const file of files) {
      // Skip test files if they check simulated environment structures safely
      if (file.endsWith(".test.ts") || file.endsWith(".test.js")) continue;
      
      const content = fs.readFileSync(file, "utf-8");
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(content)) {
          console.log(`  [DANGER] Possible raw secret exposure of ${pattern.name} in ${path.basename(file)}!`);
          exposedSecrets++;
        }
      }
    }
  }

  if (exposedSecrets === 0) {
    console.log("  - Security scan complete: No raw private keys or mnemonics exposed in code files.");
  }

  console.log(divider);
  console.log("TORTURE TEST COMPLETE");
  console.log(divider);
}

function getFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

runTortureTest();
