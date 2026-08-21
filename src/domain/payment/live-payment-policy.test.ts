import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createControlledDemoOffer, createPaymentAuthorizationPreview, LIVE_PAYMENT_POLICY } from "./live-payment-policy";
import { getWalletConfig } from "../../server/payment/wallet";
import { DurablePaymentLedger } from "../../server/payment/durable-idempotency";
import { durableStateForGoatFlowStatus } from "../../server/payment/goatflow-client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const terms = { merchantId: "metermind", enabled: true, receiveMode: "DIRECT", receiver: "0x7bfD3952CcfE46C955dc62E6264357A07cC9144C", chainId: 48816, tokenSymbol: "USDC", tokenContract: "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1", decimals: 6, minimumPayment: 0.1, quoteTimestamp: "2026-08-21T00:00:00.000Z" };

describe("Phase 3.1C-2 live payment readiness policy", () => {
  it("separates a larger user budget from the 0.10 testnet safety ceiling", () => {
    const offer = createControlledDemoOffer(terms, 0.25);
    assert.equal(offer.amount, 0.1);
    assert.equal(LIVE_PAYMENT_POLICY.maxSinglePaymentUsdc, 0.1);
    assert.equal(offer.minimumPaymentSource, "LIVE_MERCHANT_API");
  });

  it("rejects a budget below the live merchant minimum without raising it", () => {
    assert.throws(() => createControlledDemoOffer(terms, 0.05), /BUDGET_TOO_LOW_FOR_PROVIDER_MINIMUM.*0\.10 USDC.*0\.05/);
  });

  it("never lets environment configuration raise the ceiling above 0.10", () => {
    const previous = process.env["MAX_LIVE_PAYMENT_USD"];
    process.env["MAX_LIVE_PAYMENT_USD"] = "100";
    assert.equal(getWalletConfig().maxLivePayment, 0.1);
    if (previous === undefined) delete process.env["MAX_LIVE_PAYMENT_USD"]; else process.env["MAX_LIVE_PAYMENT_USD"] = previous;
  });

  it("creates a one-purchase preview that cannot imply payment was sent", () => {
    const preview = createPaymentAuthorizationPreview({ task: "research", provider: "paidresearchapi", service: "CONTROLLED_DEMO_SERVICE", amount: 0.1, token: "USDC", network: "GOAT Testnet3", payer: "payer", receiver: "receiver", orderId: "order-1", buyContractHash: "hash", budget: 0.25, merchantVerification: true, gasReadiness: true, tokenReadiness: true, feeReadiness: true, idempotencyReadiness: true });
    assert.equal(preview.authorizationScope, "AUTHORIZE ONE TESTNET PURCHASE");
    assert.equal(preview.paymentSent, false);
  });

  it("blocks duplicate and unknown retries across storage restart until reconciliation", () => {
    const directory = mkdtempSync(join(tmpdir(), "metermind-readiness-"));
    try {
      const file = join(directory, "ledger.json");
      const first = new DurablePaymentLedger(file);
      first.reserve("economic-key", "contract-hash");
      first.update("economic-key", "SUBMISSION_UNKNOWN", { orderId: "order-1" });
      const restarted = new DurablePaymentLedger(file);
      assert.equal(restarted.retryRequiresReconciliation("economic-key"), true);
      assert.throws(() => restarted.reserve("economic-key"), /IDEMPOTENCY_RETRY_BLOCKED_SUBMISSION_UNKNOWN/);
      assert.equal(durableStateForGoatFlowStatus("CHECKOUT_VERIFIED"), "ORDER_CREATED");
      assert.equal(durableStateForGoatFlowStatus("PAYMENT_CONFIRMED"), "SETTLED");
      restarted.update("economic-key", durableStateForGoatFlowStatus("PAYMENT_CONFIRMED"));
      assert.equal(new DurablePaymentLedger(file).countSettled(), 1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
