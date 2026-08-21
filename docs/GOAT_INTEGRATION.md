# GOAT Economic Integration Boundary

Updated: 2026-08-20

No live GOAT payment was executed during Phase 3.1A or Phase 3.1B. Phase 3.1B performed read-only registry calls only.

## Component ownership

1. **MeterMind procurement (`REAL`)**: understands intent, qualifies providers, scores candidates, selects a winner, and freezes the Buy Contract.
2. **ERC-8004 (`PARTIAL`)**: AgentKit read integration is proven on GOAT Testnet3. External agent 356 produced verified identity and no-feedback evidence, but no reputation score. It does not own payment.
3. **GOAT AgentKit (`BLOCKED`)**: wraps payer signing/token transfer and the merchant-gateway intent/status API in `goat-client.ts`. This is the current settle-to-deliver execution path, but it fails closed until all prerequisites exist.
4. **GoatFlow/x402 SDK (`PARTIAL`)**: `goatflow-client.ts` provides merchant lookup and order helpers using `GOATX402_*` credentials. It is not silently interchangeable with the AgentKit merchant adapter and is not yet joined to the production execution path.

## Intended lifecycle boundary

```text
MeterMind procure
  -> MeterMind freeze Buy Contract
  -> merchant/GoatFlow or AgentKit create intent/order (boundary not yet finalized)
  -> AgentKit wallet authorize/pay
  -> merchant/GoatFlow verify settlement
  -> merchant delivers
  -> MeterMind verifies acceptance
  -> MeterMind prepares reputation feedback (implemented; no submission)
```

## Live payment truthfulness gate

The live path must fail unless it has a valid frozen Buy Contract, configured merchant URL/key, configured real receiver, GOAT Testnet3 chain ID, payer address, token contract, matching quote ID, matching idempotency key, and durable idempotency readiness. Payment amount/currency/recipient come from the Buy Contract and are checked against merchant intent data. The controlled simulated path uses `sim_merchant_*`, `sim_tx_*`, and demo execution mode.

The exact AgentKit/GoatFlow interoperability boundary must be verified against a real merchant contract before any live economic phase. Code presence, ERC-8004 reads, and mocked tests are not evidence of settlement.

## Phase 3.1C preflight result

GoatFlow is now the canonical authority for merchant discovery, order terms, and settlement status. AgentKit is limited to a future explicitly authorized payer signing/transfer step and cannot override GoatFlow commercial terms.

The configured merchant is enabled in `DIRECT` mode on GOAT Testnet3. Its authenticated API last reported a minimum order of 100000 atomic USDC (0.10 USDC) and rejected creation because the merchant fee balance is $0.00 while $0.05 is required. The public merchant-discovery response does not contain fee balance or minimum-price fields, so MeterMind does not create probe orders while that external blocker remains.

MeterMind's explicit Testnet3 demo policy has a non-escalating 0.10-USDC maximum, one authorized live purchase, mainnet blocked, and mandatory merchant/balance/recipient/Buy Contract/idempotency checks. This is a testnet demo safety limit, not a production spending policy. The user procurement budget remains separate: a 0.25-USDC budget permits at most 0.10, while a 0.05-USDC budget fails with `BUDGET_TOO_LOW_FOR_PROVIDER_MINIMUM`.

The commercial offer uses `X402 / GOAT_FLOW`, with amount from `LIVE_MERCHANT_REQUIREMENT` and token/recipient from `LIVE_MERCHANT_CONFIG`. Those payment terms are `REAL` Testnet3 terms; the underlying service remains `CONTROLLED_DEMO_SERVICE`. A real Buy Contract and `PaymentAuthorizationPreview` can only be frozen after a real unpaid order supplies its order ID and expiry. The preview authorizes one testnet purchase only and never enables generic live mode.

Atomic durable records live outside Git under `.metermind/`. `ORDER_CREATED` and `SUBMISSION_UNKNOWN` block retries across restarts until GoatFlow `getOrderStatus` reconciliation produces a terminal state.
