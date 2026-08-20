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
