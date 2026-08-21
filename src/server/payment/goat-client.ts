import { verifyPaymentPolicy } from "../../domain/payment/policy";
import { createPaymentAudit } from "../../domain/payment/audit";
import { getWalletConfig, getWalletAddress } from "./wallet";
import type { PaymentRequest, PaymentQuote, PaymentResult, PaymentAudit } from "../../domain/payment/types";
import type { BuyContract } from "../../domain/payment/contract";
import { HttpMerchantGatewayAdapter, EvmPayerWalletAdapter } from "@goatnetwork/agentkit";
import { ethers } from "ethers";

export interface GoatExecutionRequest {
  url: string;
  procurementId: string;
  taskId: string;
  service: string;
  allocatedBudget: number;
  idempotencyKey: string;
  selectedProviderId: string;
  buyContract?: BuyContract | undefined;
  provider: {
    id: string;
    name: string;
    mode: "live" | "demo";
    paymentModel?: "free" | "x402";
    paymentDestination?: string;
    isExcluded?: boolean;
  };
  policyParams: {
    maxTransactionAmount: number;
    allowedAssets: string[];
    allowedNetworks: string[];
    remainingTaskBudget: number;
  };
}

export interface GoatExecutionResult {
  status: "SUCCESS" | "FAILED" | "PAID_BUT_DELIVERY_FAILED";
  paymentResult?: PaymentResult | undefined;
  audit: PaymentAudit;
  payload?: string | undefined;
  errorCode?: string | undefined;
  errorMessageSafe?: string | undefined;
}

/**
 * Legacy broadcast executor retained behind fail-closed readiness policy.
 * GoatFlow is the canonical merchant quote/order/status authority; AgentKit is
 * only the eventual payer signing/transfer mechanism in an authorized phase.
 */
export async function executeGoatPayment(
  req: GoatExecutionRequest
): Promise<GoatExecutionResult> {
  const startedAt = Date.now();

  // 1. Check Payer Wallet Configuration
  const config = getWalletConfig();
  const key = config.privateKey || config.mnemonic;
  if (!key) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "live-wallet-check"
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "WALLET_CONFIGURED", passed: false, message: "Payer wallet is not configured on the server." }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Live wallet config is missing." }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_NOT_CONFIGURED",
      errorMessageSafe: "Live wallet is not configured."
    };
  }

  // 2. Check Merchant Configuration Truthfulness
  const merchantUrl = process.env["GOAT_MERCHANT_URL"];
  const merchantApiKey = process.env["GOAT_MERCHANT_API_KEY"];
  if (!merchantUrl || !merchantApiKey) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "live-merchant-check"
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "MERCHANT_CONFIGURED", passed: false, message: "Real GOAT Merchant is not configured." }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Real GOAT merchant is not configured." }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "LIVE_PAYMENT_BLOCKED",
      errorMessageSafe: "LIVE PAYMENT BLOCKED — REAL GOAT MERCHANT NOT CONFIGURED"
    };
  }

  if (!req.buyContract) {
    const quote: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0,
      asset: "NOT_CONFIGURED",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "NOT_CONFIGURED",
      source: "buy-contract-check",
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: [{ rule: "BUY_CONTRACT_REQUIRED", passed: false, message: "Live payment requires a frozen Buy Contract." }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Frozen Buy Contract is missing." },
    });
    return { status: "FAILED", audit, errorCode: "PAYMENT_CONTRACT_INVALID", errorMessageSafe: "Live payment blocked: frozen Buy Contract is required." };
  }

  const buyContract = req.buyContract;
  if (!req.provider.paymentDestination) {
    const quote: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: buyContract.actualQuotedAmount,
      asset: buyContract.currency,
      network: buyContract.network,
      paymentDestination: "NOT_CONFIGURED",
      source: "merchant-receiver-check",
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: [{ rule: "MERCHANT_RECEIVER_CONFIGURED", passed: false, message: "Real merchant receiver is not configured." }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Merchant receiver is not configured." },
    });
    return { status: "FAILED", audit, errorCode: "LIVE_PAYMENT_BLOCKED", errorMessageSafe: "Live payment blocked: merchant receiver is not configured." };
  }

  // 3. Connect to RPC and Validate Chain ID (GOAT Testnet3 / 48816)
  let chainId: number = 0;
  let signer: any;
  let provider: ethers.JsonRpcProvider | null = null;
  let lastRpcError: Error | null = null;

  const primaryRpc = process.env["GOAT_RPC_URL"] || "https://rpc.testnet3.goat.network";
  const fallbackRpc = process.env["GOAT_RPC_URL_FALLBACK_1"] || "https://48816.rpc.thirdweb.com";
  const rpcList = [primaryRpc, fallbackRpc];

  for (const rpcUrl of rpcList) {
    try {
      provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const getNetworkPromise = provider.getNetwork();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC_TIMEOUT")), 5000)
      );
      
      const network = await Promise.race([getNetworkPromise, timeoutPromise]);
      chainId = Number(network.chainId);
      
      if (chainId !== 48816) {
        throw new Error(`Unsupported chain ID: ${chainId}. Only GOAT Testnet3 (48816) is supported.`);
      }

      if (config.privateKey) {
        signer = new ethers.Wallet(config.privateKey, provider);
      } else {
        signer = ethers.Wallet.fromPhrase(config.mnemonic!, provider);
      }
      break; // Successfully connected
    } catch (err: any) {
      lastRpcError = err;
      provider = null;
      // Connection failed on this RPC, try fallback
      continue;
    }
  }

  if (!provider) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "rpc-connection-check"
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "RPC_CONNECTED", passed: false, message: `Failed to connect to GOAT Network: ${lastRpcError?.message}` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `RPC failure: ${lastRpcError?.message}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: `Failed to connect to GOAT RPC: ${lastRpcError?.message}`
    };
  }

  if (chainId !== 48816) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "chain-id-validation"
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "CHAIN_ID_VALIDATED", passed: false, message: `Unsupported chain ID: ${chainId}. Only GOAT Testnet3 (48816) is supported.` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Unsupported mainnet or custom chain ID." }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: `Chain ID ${chainId} is not supported. Must be GOAT Testnet3 (48816).`
    };
  }

  // Initialize official adapters
  const walletAdapter = new EvmPayerWalletAdapter(signer);
  const merchantAdapter = new HttpMerchantGatewayAdapter(merchantUrl, {
    headers: {
      Authorization: `Bearer ${merchantApiKey}`,
      "X-Idempotency-Key": req.idempotencyKey,
    }
  });

  // 4. Create official payment request
  let paymentIntent: any;
  try {
    paymentIntent = await merchantAdapter.createPaymentIntent({
      amount: String(buyContract.actualQuotedAmount),
      asset: buyContract.currency,
      to: buyContract.recipient,
      idempotencyKey: buyContract.idempotencyKey,
    });
  } catch (err: any) {
    const quoteMock: PaymentQuote = {
      providerId: req.provider.id,
      service: req.service,
      amount: 0.01,
      asset: "USDC",
      network: "GOAT-Testnet",
      paymentDestination: req.provider.paymentDestination || "0xunknown",
      source: "create-payment-intent-api"
    };
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote: quoteMock,
      policyChecks: [{ rule: "CREATE_PAYMENT_INTENT", passed: false, message: `Create payment intent failed: ${err.message}` }],
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Merchant error: ${err.message}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: `Merchant API create order failed: ${err.message}`
    };
  }

  const quote: PaymentQuote = {
    providerId: req.provider.id,
    service: req.service,
    amount: buyContract.actualQuotedAmount,
    asset: buyContract.currency,
    network: buyContract.network,
    paymentDestination: paymentIntent.payToAddress || req.provider.paymentDestination || "",
    quoteId: buyContract.quoteId,
    tokenContractAddress: paymentIntent.tokenAddress,
    chainId,
    payerAddress: await getWalletAddress(),
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    source: "merchant-create-intent",
    raw: paymentIntent.raw,
  };

  // 5. Verify local budget policy guard before proceeding to sign
  const paymentRequest: PaymentRequest & { buyContract: BuyContract } = {
    procurementId: req.procurementId,
    taskId: req.taskId,
    service: req.service,
    selectedProviderId: req.selectedProviderId,
    allocatedBudget: req.allocatedBudget,
    quote,
    idempotencyKey: req.idempotencyKey,
    buyContract,
  };

  const policyCheckResult = verifyPaymentPolicy(paymentRequest, {
    provider: req.provider,
    alreadyPaidKeys: new Set<string>(),
    idempotencyStoreReady: process.env["GOAT_DURABLE_IDEMPOTENCY_READY"] === "true",
    maxTransactionAmount: req.policyParams.maxTransactionAmount,
    allowedAssets: req.policyParams.allowedAssets,
    allowedNetworks: req.policyParams.allowedNetworks,
    remainingTaskBudget: req.policyParams.remainingTaskBudget,
  });

  if (!policyCheckResult.approved) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: false,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Policy guard rejected: ${policyCheckResult.errorMessageSafe}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: policyCheckResult.errorCode,
      errorMessageSafe: policyCheckResult.errorMessageSafe
    };
  }

  // 6. Sign authorization data
  let signature: string;
  try {
    if (!paymentIntent.calldataSignRequest) {
      throw new Error("No calldataSignRequest returned from merchant.");
    }
    signature = await walletAdapter.signCalldataTypedData(paymentIntent.calldataSignRequest);
  } catch (err: any) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Signing failed: ${err.message}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SIGNATURE_FAILED",
      errorMessageSafe: `Failed to sign payment payload: ${err.message}`
    };
  }

  // 7. Submit signature to merchant
  let authResult: any;
  try {
    authResult = await merchantAdapter.submitPaymentAuthorization(paymentIntent.paymentId, signature);
  } catch (err: any) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Submit signature failed: ${err.message}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: `Failed to submit signed proof to merchant: ${err.message}`
    };
  }

  if (authResult.status === "failed") {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Merchant rejected transaction signature." }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_REJECTED",
      errorMessageSafe: "Merchant rejected the transaction signature."
    };
  }

  // 8. Transfer token (execute payer token transfer)
  let transferResult: any;
  try {
    transferResult = await walletAdapter.transferToken({
      tokenAddress: paymentIntent.tokenAddress,
      to: paymentIntent.payToAddress,
      amount: ethers.parseUnits(
        String(buyContract.actualQuotedAmount),
        Number(paymentIntent.tokenDecimals ?? 6),
      ).toString(),
    });
  } catch (err: any) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: `Transfer token failed: ${err.message}` }
    });
    return {
      status: "FAILED",
      audit,
      errorCode: "PAYMENT_SUBMISSION_FAILED",
      errorMessageSafe: `Payer token transfer failed: ${err.message}`
    };
  }

  // 9. Poll payment status to confirm settlement
  let statusResult: any;
  let settled = false;
  let pollAttempts = 0;
  while (!settled && pollAttempts < 5) {
    try {
      statusResult = await merchantAdapter.getPaymentStatus(paymentIntent.paymentId);
      if (statusResult.status === "settled" || statusResult.status === "completed") {
        settled = true;
      }
    } catch {
      // ignore transient poll error
    }
    if (!settled) {
      pollAttempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const paymentResult: PaymentResult = {
    status: settled ? "SUCCESS" : "FAILED",
    providerId: req.provider.id,
    amount: buyContract.actualQuotedAmount,
    asset: buyContract.currency,
    network: buyContract.network,
    transactionHash: transferResult.txHash,
    paymentReference: paymentIntent.paymentId,
    startedAt,
    completedAt: Date.now(),
    settlementStatus: settled ? "SETTLED" : "UNKNOWN",
    executionLinked: true,
  };

  if (!settled) {
    const audit = createPaymentAudit({
      procurementId: req.procurementId,
      taskId: req.taskId,
      selectedProviderId: req.provider.id,
      quote,
      policyChecks: policyCheckResult.checks,
      approvalDecision: true,
      paymentResult,
      startedAt,
      serviceDeliveryResult: { status: "FAILED", errorMessage: "Payment settlement status could not be verified." }
    });
    return {
      status: "FAILED",
      paymentResult,
      audit,
      errorCode: "PAYMENT_REJECTED",
      errorMessageSafe: "Payment settlement timed out."
    };
  }

  // 10. Execute merchant API request to deliver content
  let servicePayload: string = "";
  let isDeliverySuccess = false;
  try {
    const response = await fetch(`${merchantUrl}/v1/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Id": paymentIntent.paymentId,
        "X-Transaction-Hash": transferResult.txHash,
        Authorization: `Bearer ${merchantApiKey}`,
      },
      body: JSON.stringify({
        procurementId: req.procurementId,
        taskId: req.taskId,
        service: req.service,
      }),
    });
    if (response.status === 200) {
      const data = await response.json();
      servicePayload = data.payload || JSON.stringify(data);
      isDeliverySuccess = !!(servicePayload && !servicePayload.includes("delivery-failed"));
    } else {
      servicePayload = `Error delivery status code: ${response.status}`;
    }
  } catch (err: any) {
    servicePayload = `Delivery connection failed: ${err.message}`;
  }

  const deliveryStatus = isDeliverySuccess ? "SUCCESS" : "PAID_BUT_DELIVERY_FAILED";

  const audit = createPaymentAudit({
    procurementId: req.procurementId,
    taskId: req.taskId,
    selectedProviderId: req.provider.id,
    quote,
    policyChecks: policyCheckResult.checks,
    approvalDecision: true,
    paymentResult,
    startedAt,
    serviceDeliveryResult: {
      status: deliveryStatus,
      payload: servicePayload,
      errorMessage: isDeliverySuccess ? undefined : "Paid service failed to deliver content payload."
    }
  });

  return {
    status: deliveryStatus,
    paymentResult,
    audit,
    payload: servicePayload
  };
}
