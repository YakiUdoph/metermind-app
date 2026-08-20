import fs from "node:fs";
import path from "node:path";
import { JsonRpcProvider, Contract, Wallet, formatUnits } from "ethers";

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

async function checkReadiness() {
  console.log("==================================================");
  console.log("METERMIND GOAT ECONOMIC READINESS CHECK");
  console.log("==================================================");

  const privateKey = process.env.GOAT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("GOAT_PRIVATE_KEY is not set in env.");
    return;
  }

  const provider = new JsonRpcProvider("https://rpc.testnet3.goat.network");
  const wallet = new Wallet(privateKey, provider);
  console.log("Payer Public Address:", wallet.address);

  // 1. Native Gas BTC Balance
  try {
    const gasBalance = await provider.getBalance(wallet.address);
    console.log(`Native BTC Balance: ${formatUnits(gasBalance, 18)} BTC (${gasBalance.toString()} wei)`);
    console.log(`GAS SUFFICIENT: ${gasBalance > 0n ? "YES" : "NO"}`);
  } catch (e: any) {
    console.error("Failed to query BTC balance:", e.message);
  }

  // 2. Real USDC Balance
  const realUsdcAddress = "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1";
  const usdcAbi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
  const usdcContract = new Contract(realUsdcAddress, usdcAbi, provider);

  try {
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const decimals = await usdcContract.decimals();
    console.log(`Real USDC Balance (${realUsdcAddress}): ${formatUnits(usdcBalance, decimals)} USDC (${usdcBalance.toString()} raw)`);
    console.log(`TOKEN SUFFICIENT: ${usdcBalance > 0n ? "YES" : "NO"}`);
  } catch (e: any) {
    console.error("Failed to query Real USDC balance:", e.message);
  }

  // 3. Real TUSDT Balance
  const realTusdtAddress = "0x030B2C744Fa080D97c0033214dEF6384f763aB21";
  const tusdtContract = new Contract(realTusdtAddress, usdcAbi, provider);

  try {
    const tusdtBalance = await tusdtContract.balanceOf(wallet.address);
    const decimals = await tusdtContract.decimals();
    console.log(`Real TUSDT Balance (${realTusdtAddress}): ${formatUnits(tusdtBalance, decimals)} TUSDT (${tusdtBalance.toString()} raw)`);
  } catch (e: any) {
    console.error("Failed to query Real TUSDT balance:", e.message);
  }

  // 4. Merchant details
  console.log("Merchant ID:", process.env.GOATX402_MERCHANT_ID || "not set");
}

checkReadiness().catch(console.error);
