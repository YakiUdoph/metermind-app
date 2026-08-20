import crypto from "node:crypto";
import { Wallet, JsonRpcProvider, Contract } from "ethers";

export interface WalletSignerConfig {
  privateKey?: string | undefined;
  mnemonic?: string | undefined;
  paymentMode: "simulation" | "live";
  maxLivePayment: number;
}
 
export function getWalletConfig(): WalletSignerConfig {
  const privateKey = process.env["GOAT_PRIVATE_KEY"] || process.env["WALLET_PRIVATE_KEY"];
  const mnemonic = process.env["WALLET_MNEMONIC"];
  const paymentMode = (process.env["PAYMENT_MODE"] === "live" ? "live" : "simulation") as "simulation" | "live";
  
  // Hard maximum live limit of 0.05
  const envLimit = process.env["MAX_LIVE_PAYMENT_USD"] ? parseFloat(process.env["MAX_LIVE_PAYMENT_USD"]) : 0.05;
  const maxLivePayment = isNaN(envLimit) ? 0.05 : Math.min(envLimit, 0.05);
 
  return {
    privateKey,
    mnemonic,
    paymentMode,
    maxLivePayment,
  };
}

export function isWalletConfigured(): boolean {
  const config = getWalletConfig();
  if (config.paymentMode === "simulation") {
    return true; // Simulation wallet is always ready
  }
  return !!(config.privateKey || config.mnemonic);
}

export async function getWalletAddress(): Promise<string> {
  const config = getWalletConfig();
  if (!config.privateKey && !config.mnemonic) {
    return "None";
  }
  try {
    if (config.privateKey) {
      const wallet = new Wallet(config.privateKey);
      return wallet.address;
    } else if (config.mnemonic) {
      const wallet = Wallet.fromPhrase(config.mnemonic);
      return wallet.address;
    }
  } catch (err) {
    return "Error deriving address";
  }
  return "None";
}

export async function getWalletBalances(tokenAddress?: string): Promise<{ nativeGas: bigint; tokenBalance: bigint }> {
  const config = getWalletConfig();
  const address = await getWalletAddress();
  if (address === "None" || address.startsWith("Error")) {
    return { nativeGas: 0n, tokenBalance: 0n };
  }

  // Fallback RPC list
  const primaryRpc = process.env["GOAT_RPC_URL"] || "https://rpc.testnet3.goat.network";
  const fallbackRpc = process.env["GOAT_RPC_URL_FALLBACK_1"] || "https://48816.rpc.thirdweb.com";
  const rpcList = [primaryRpc, fallbackRpc];

  for (const rpcUrl of rpcList) {
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      
      // Bounded timeout for RPC response
      const getBalancePromise = provider.getBalance(address);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC_TIMEOUT")), 5000)
      );
      
      const nativeGas = await Promise.race([getBalancePromise, timeoutPromise]);

      const usdcAddress = tokenAddress || "0x3022b87ac063DE95b1570F46f5e470F8B53112D8";
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const contract = new Contract(usdcAddress, abi, provider);
      
      const getBalanceTokenPromise = (contract as any).balanceOf(address);
      const tokenBalance = await Promise.race([getBalanceTokenPromise, timeoutPromise]);

      return { nativeGas, tokenBalance };
    } catch (e) {
      // Network failure on this RPC, try fallback
      continue;
    }
  }

  return { nativeGas: 0n, tokenBalance: 0n };
}

export interface SignatureResult {
  signature: string;
  transactionHash: string;
  paymentReference: string;
  mode: "simulation" | "live";
}

/**
 * Signs an x402 payment challenge.
 * This runs strictly server-side and does not expose wallet details to client responses.
 */
export function signPaymentChallenge(
  challenge: {
    price: number;
    asset: string;
    network: string;
    paymentDestination: string;
    idempotencyKey: string;
  }
): SignatureResult {
  const config = getWalletConfig();

  if (config.paymentMode === "live") {
    throw new Error("LIVE_SIGNING_REQUIRES_AGENTKIT");
  } else {
    // Simulation Mode - deterministic prefixed fake references that do not mimic real tx hashes
    const mockMsg = `SIMULATED_SIGNATURE_FOR_${challenge.idempotencyKey}`;
    const signature = `sim_sig_${crypto.createHash("sha256").update(mockMsg).digest("hex")}`;
    const transactionHash = `sim_tx_${crypto.createHash("sha256").update(mockMsg + "_tx").digest("hex")}`;
    const paymentReference = `sim_ref_${challenge.idempotencyKey}`;

    return {
      signature,
      transactionHash,
      paymentReference,
      mode: "simulation"
    };
  }
}
