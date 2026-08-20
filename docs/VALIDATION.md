# Testing and Validation Matrix

Updated: 2026-08-20

## Required Phase 3.1B gates

```bash
npm run validate:foundation
npx tsc --noEmit
npm run build
```

`validate:foundation` contains **189 tests** across 16 suites. It covers execution adapters, live market competition, planning, scoring, Buy Contracts, delivery acceptance, payment policy, simulated x402, mocked AgentKit boundaries, RPC fallback, Phase 2 procurement intelligence/proofs, and Phase 3 trust/economic rules.

AgentKit payment tests use mocked SDK/RPC/merchant behavior. Separately, `scratch/erc8004-live-proof.ts` performs read-only live registry validation; it does not prove or attempt payment.

Phase 3.1B regressions verify explicit trust injection, on-chain versus fixture provenance, identity-only highest-trust influence, fail-closed minimum reputation without feedback, and production feedback preparation without submission.

Repository-wide `npm run lint` includes large pre-existing CRLF/Prettier debt. Phase 3.1A does not authorize a repository-wide formatting rewrite; functional validation uses the three gates above.

## Latest verified result

- `npm run validate:foundation`: PASS, 189/189.
- `npx tsc --noEmit`: PASS, 0 errors.
- `npm run build`: PASS.
- `npx tsx scratch/erc8004-live-proof.ts`: PASS (read-only), chain 48816 at block 16071364; both registry bytecodes present; external agent 356 identity verified; metadata/client feedback absent; reputation score unavailable; highest-trust and verified-only scenarios PASS; minimum-reputation scenario BLOCKED as designed; no write/payment.
