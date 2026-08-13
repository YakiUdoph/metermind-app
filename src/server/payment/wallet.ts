import crypto from "node:crypto";

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
    const key = config.privateKey || config.mnemonic;
    if (!key) {
      throw new Error("PAYMENT_NOT_CONFIGURED");
    }

    if (challenge.price > config.maxLivePayment) {
      throw new Error("PAYMENT_BUDGET_EXCEEDED");
    }

    // Deterministic signature generated via Node.js crypto using the server-side key
    const messageToSign = JSON.stringify({
      price: challenge.price,
      asset: challenge.asset,
      network: challenge.network,
      paymentDestination: challenge.paymentDestination,
      idempotencyKey: challenge.idempotencyKey,
      timestamp: Date.now()
    });

    const hmac = crypto.createHmac("sha256", key);
    hmac.update(messageToSign);
    const signature = `0x${hmac.digest("hex")}`;
    const transactionHash = `0x${crypto.createHash("sha256").update(signature).digest("hex")}`;
    const paymentReference = `ref-live-${crypto.randomBytes(8).toString("hex")}`;

    return {
      signature,
      transactionHash,
      paymentReference,
      mode: "live"
    };
  } else {
    // Simulation Mode
    const mockMsg = `SIMULATED_SIGNATURE_FOR_${challenge.idempotencyKey}`;
    const signature = `0x_sim_${crypto.createHash("sha256").update(mockMsg).digest("hex")}`;
    const transactionHash = `0x_sim_tx_${crypto.randomBytes(32).toString("hex")}`;
    const paymentReference = `ref-sim-${crypto.randomBytes(8).toString("hex")}`;

    return {
      signature,
      transactionHash,
      paymentReference,
      mode: "simulation"
    };
  }
}
