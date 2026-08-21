# Testing and Validation Matrix

Updated: 2026-08-21

## Required Phase 3.1C preflight gates

```bash
npm run validate:foundation
npx tsc --noEmit
npm run build
```

`validate:foundation` contains **195 tests across 17 suites**, including the Phase 3.1C-2 policy suite covering the 0.10-USDC non-escalating Testnet3 ceiling, budget-versus-minimum rejection, one-purchase preview semantics, durable restart duplicate blocking, and unknown-state reconciliation mapping.

AgentKit payment tests use mocked SDK/RPC/merchant behavior. Separately, `scratch/erc8004-live-proof.ts` performs read-only live registry validation; it does not prove or attempt payment.

Phase 3.1B regressions verify explicit trust injection, on-chain versus fixture provenance, identity-only highest-trust influence, fail-closed minimum reputation without feedback, and production feedback preparation without submission.

Repository-wide `npm run lint` includes large pre-existing CRLF/Prettier debt. Phase 3.1A does not authorize a repository-wide formatting rewrite; functional validation uses the three gates above.

## Latest verified result

- `npm run validate:foundation`: PASS, 195/195.
- `npx tsc --noEmit`: PASS, 0 errors.
- `npm run build`: PASS.
- `npx tsx scratch/goat-payment-live-preflight.ts`: PASS as a read-only readiness check; verdict `BLOCKED` only by `MERCHANT_FEE_UNFUNDED`. Merchant/route and payer balances were re-queried at block 16079633. No order, signature, or broadcast occurred because the last authoritative fee result remains $0.00 against $0.05 required.
- `npx tsx scratch/erc8004-live-proof.ts`: PASS (read-only), chain 48816 at block 16071364; both registry bytecodes present; external agent 356 identity verified; metadata/client feedback absent; reputation score unavailable; highest-trust and verified-only scenarios PASS; minimum-reputation scenario BLOCKED as designed; no write/payment.
