import { GoatFlowClient } from "goatflow-sdk-server";
import type { MerchantInfo, Order, OrderProof } from "goatflow-sdk-server";
import { DurablePaymentLedger, type DurablePaymentState } from "./durable-idempotency";

let clientInstance: GoatFlowClient | null = null;

export function getGoatFlowClient(): GoatFlowClient | null {
  if (clientInstance) return clientInstance;

  const url = process.env["GOATX402_API_URL"] || "https://flow-api.testnet3.goat.network";
  const apiKey = process.env["GOATX402_API_KEY"];
  const apiSecret = process.env["GOATX402_API_SECRET"];

  if (!apiKey || !apiSecret) {
    return null;
  }

  clientInstance = new GoatFlowClient({
    baseUrl: url,
    apiKey,
    apiSecret,
  });

  return clientInstance;
}

/**
 * Public endpoint fetch - does not require API keys or signing
 */
export async function getMerchantInfo(merchantId: string): Promise<MerchantInfo | null> {
  const url = process.env["GOATX402_API_URL"] || "https://flow-api.testnet3.goat.network";
  // The SDK supports getMerchant as a public endpoint, but it requires instantiation or a public call.
  // We can call getMerchant via a temporary public client configuration or a direct fetch request
  // to avoid credentials requirement.
  try {
    const response = await fetch(`${url}/merchants/${merchantId}`);
    if (response.status === 200) {
      const data = await response.json();
      return data as MerchantInfo;
    } else {
      console.error(`Failed to fetch merchant details, HTTP code: ${response.status}`);
      return null;
    }
  } catch (err) {
    console.error("Failed to query merchant info from GOAT API:", err);
    return null;
  }
}

/**
 * Creates a payment order for the merchant (requires keys)
 */
export async function createGoatFlowOrder(params: {
  dappOrderId: string;
  chainId: number;
  tokenSymbol: string;
  tokenContract: string;
  fromAddress: string;
  amountWei: string;
}): Promise<Order> {
  const client = getGoatFlowClient();
  if (!client) {
    throw new Error("GoatFlowClient not configured on the server.");
  }
  return await client.createOrder(params);
}

/**
 * Query status of an order (requires keys or matches checkout proof)
 */
export async function getGoatFlowOrderStatus(orderId: string): Promise<OrderProof> {
  const client = getGoatFlowClient();
  if (!client) {
    throw new Error("GoatFlowClient not configured on the server.");
  }
  return await client.getOrderStatus(orderId);
}

export function durableStateForGoatFlowStatus(status: OrderProof["status"]): DurablePaymentState {
  if (status === "PAYMENT_CONFIRMED" || status === "INVOICED") return "SETTLED";
  if (status === "FAILED") return "FAILED";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "CANCELLED") return "CANCELLED";
  return "ORDER_CREATED";
}

export async function reconcileGoatFlowPayment(
  idempotencyKey: string,
  ledger = new DurablePaymentLedger(),
): Promise<DurablePaymentState> {
  const record = ledger.get(idempotencyKey);
  if (!record?.orderId) throw new Error("IDEMPOTENCY_ORDER_ID_MISSING");
  try {
    const order = await getGoatFlowOrderStatus(record.orderId);
    const state = durableStateForGoatFlowStatus(order.status);
    ledger.update(idempotencyKey, state, order.txHash ? { transactionHash: order.txHash } : {});
    return state;
  } catch (error) {
    ledger.update(idempotencyKey, "SUBMISSION_UNKNOWN");
    throw error;
  }
}
