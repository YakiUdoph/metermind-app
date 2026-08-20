import fs from "node:fs";
import path from "node:path";
import { createGoatFlowOrder } from "../src/server/payment/goatflow-client";

// Load .env manually
try {
  const envContent = fs.readFileSync(path.resolve(".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=");
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
} catch (e: any) {
  console.log("No .env found or failed to read:", e.message);
}

async function runOrderPreview() {
  console.log("==================================================");
  console.log("METERMIND GOAT FLOW ORDER PREVIEW");
  console.log("==================================================");

  const dappOrderId = "dapp_preview_" + Date.now();
  console.log("Generating dappOrderId:", dappOrderId);

  try {
    const order = await createGoatFlowOrder({
      dappOrderId,
      chainId: 48816,
      tokenSymbol: "USDC",
      tokenContract: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1",
      fromAddress: "0x2C79D76790596a3F1BD6D58C82869B86Bea6e798",
      amountWei: "100000" // 0.10 USDC (6 decimals)
    });

    console.log("Order created successfully:");
    console.log(JSON.stringify(order, null, 2));
  } catch (e: any) {
    console.error("Order creation blocked/failed:");
    console.error(e.message || e);
  }
}

runOrderPreview().catch(console.error);
