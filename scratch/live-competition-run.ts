import fs from "node:fs";
import path from "node:path";
import { CoinGeckoAdapter } from "../src/server/providers/coingecko";
import { BitfinexAdapter } from "../src/server/providers/bitfinex";
import { runProcurement } from "../src/domain/procurement/scoring";
import type { Provider } from "@/lib/mock";

// Load .env
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
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

async function runLiveCompetition() {
  const cgKey = process.env["COINGECKO_API_KEY"] || "test-key";
  const cgAdapter = new CoinGeckoAdapter(cgKey);
  const bfAdapter = new BitfinexAdapter();

  const task = "Query Bitcoin and Ethereum prices.";
  const allocatedBudget = 0.50;

  console.log("Starting real-time CoinGecko vs Bitfinex live competition query...");

  const cgRequest = {
    service: "market_data",
    task,
    allocatedBudget,
    procurementId: "p-live-cg",
    taskId: "t-live-cg",
    idempotencyKey: "idem-live-cg",
    selectedProvider: { price: 0.04 } as any
  };

  const bfRequest = {
    service: "market_data",
    task,
    allocatedBudget,
    procurementId: "p-live-bf",
    taskId: "t-live-bf",
    idempotencyKey: "idem-live-bf",
    selectedProvider: { price: 0.00 } as any
  };

  const startCg = Date.now();
  const cgRes = await cgAdapter.execute(cgRequest);
  const cgLatency = Date.now() - startCg;

  const startBf = Date.now();
  const bfRes = await bfAdapter.execute(bfRequest);
  const bfLatency = Date.now() - startBf;

  console.log(`CoinGecko execution status: ${cgRes.status} (latency: ${cgLatency}ms)`);
  console.log(`Bitfinex execution status: ${bfRes.status} (latency: ${bfLatency}ms)`);

  const catalog: Provider[] = [
    {
      id: "coingecko",
      name: "CoinGecko",
      category: "market_data",
      price: 0.04, // declared price from catalog
      quality: 98,
      reliability: 99,
      latency: cgRes.status === "SUCCESS" ? cgLatency : 9999,
      score: 0,
      jobs: 100,
      failed: 0,
      spend: 0,
      trend: 0,
      assessment: "",
      priceHistory: [],
      qualityHistory: [],
      capabilities: ["market_data"],
      mode: "live",
      metricSource: cgRes.status === "SUCCESS" ? "observed" : "catalog"
    },
    {
      id: "bitfinex",
      name: "Bitfinex",
      category: "market_data",
      price: 0.00, // free
      quality: 90,
      reliability: 95,
      latency: bfRes.status === "SUCCESS" ? bfLatency : 9999,
      score: 0,
      jobs: 100,
      failed: 0,
      spend: 0,
      trend: 0,
      assessment: "",
      priceHistory: [],
      qualityHistory: [],
      capabilities: ["market_data"],
      mode: "live",
      metricSource: bfRes.status === "SUCCESS" ? "observed" : "catalog"
    }
  ];

  const request = {
    taskId: "t-live-comp",
    task,
    budget: allocatedBudget,
    priority: "balanced" as const
  };

  const trace = runProcurement(request, catalog, "market_data");

  console.log("\n==================================================");
  console.log("DECISION TRACE:");
  console.log(JSON.stringify(trace, null, 2));
  console.log("==================================================");

  process.exit(0);
}

runLiveCompetition().catch((err) => {
  console.error("Live competition execution failed:", err);
  process.exit(1);
});
