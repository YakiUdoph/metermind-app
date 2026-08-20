import fs from "node:fs";
import path from "node:path";
import { getMerchantInfo } from "../src/server/payment/goatflow-client";

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

async function runProbe() {
  console.log("==================================================");
  console.log("METERMIND MERCHANT API PROBE");
  console.log("==================================================");

  const merchantId = process.env.GOATX402_MERCHANT_ID || "metermind";
  console.log("Querying Merchant ID:", merchantId);

  const info = await getMerchantInfo(merchantId);
  if (info) {
    console.log("Merchant Info retrieved successfully:");
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.error("Failed to query merchant info.");
  }
}

runProbe().catch(console.error);
