# Architectural Decision Log

This document records major architectural decisions, library additions, or testing pattern deviations for MeterMind.

---

## Decision 1: Constructor-Injected isolated fetchFn in Provider Adapters
*   **Date**: 2026-08-20
*   **Category**: Pattern Deviation / Testing Refactor
*   **Context**: The integration test suites (`coingecko.test.ts` and `live-competition.test.ts`) previously mutated `globalThis.fetch` globally to simulate provider API responses. This global mutation caused non-deterministic collisions under concurrent test execution, resulting in flaky test runs.
*   **Decision**: Refactored the `CoinGeckoAdapter` and `BitfinexAdapter` constructors to accept an optional `fetchFn?: typeof fetch` parameter. In production execution, they default to `globalThis.fetch`. In test scenarios, mock handlers are injected locally.
*   **Consequences**:
    - Completely removed global `fetch` mutation and before/after hooks from the test suites.
    - Achieved 100% test isolation, allowing test suites to run safely without race conditions or side-effects.
    - Verified timings run deterministically under high CPU scheduling loads.

---

## Decision 2: Fail-Closed Economic Truthfulness Boundary

* **Date**: 2026-08-20
* **Category**: Security / Integration Boundary
* **Decision**: Controlled paid-research simulation uses demo execution mode plus `SIMULATED` classification. Live GOAT execution requires a frozen Buy Contract, configured receiver, matching commercial fields, and durable idempotency readiness. Missing prerequisites block execution rather than falling back or fabricating evidence.
* **Consequences**: Simulation cannot aggregate as live; the invalid merchant placeholder is no longer used by the live adapter; live payment values derive from the Buy Contract.

## Decision 3: Separate GOAT Responsibilities

* **Date**: 2026-08-20
* **Category**: Integration Architecture
* **Decision**: MeterMind owns procurement/contract/acceptance, ERC-8004 owns trust evidence, AgentKit owns payer and merchant-gateway mechanics, and GoatFlow owns its distinct merchant/order API helpers. AgentKit and GoatFlow are retained but must not be described as one proven end-to-end integration until interoperability is executed and verified.

## Decision 4: Explicit ERC-8004 Provider Mapping

* **Date**: 2026-08-20
* **Category**: Trust Safety
* **Decision**: Never default the paid-research provider to agent ID 1. Missing mapping returns `NOT_CONFIGURED`; fixture trust remains simulation/test-only.

## Decision 5: Explicit Read-Only Trust Injection and Evidence Provenance

* **Date**: 2026-08-20
* **Category**: Trust / Runtime Boundary
* **Decision**: Live ERC-8004 reads use the installed AgentKit actions behind an explicitly injected `TrustDataProvider`. Deterministic flows do not initiate network reads implicitly. On-chain identity, fixture data, missing configuration, and unavailable reads carry distinct provenance. A verified identity may influence highest-trust ranking, but absent feedback never becomes a numeric reputation score.
* **Consequences**: Live failures cannot fall back to fixtures; minimum-reputation policies fail closed without an actual score; feedback preparation is separate from any write authorization.

## Decision 6: GoatFlow-Authoritative Direct Payment Boundary

* **Date**: 2026-08-20
* **Category**: Payment Architecture / Safety
* **Decision**: GoatFlow supplies merchant configuration, order terms, and settlement status. AgentKit may perform payer signing/transfer only after a future authorized phase verifies those terms against a frozen Buy Contract. An atomic filesystem ledger is sufficient for the single controlled local demo and blocks uncertain retries across restart.
* **Consequences**: The legacy AgentKit merchant-intent shape cannot override GoatFlow terms. Phase 3.1C initially remained blocked by zero merchant fee balance and the 0.10-USDC gateway minimum exceeding the then-current 0.05 ceiling; Decision 7 supersedes that ceiling with an explicit 0.10 Testnet3-only policy.

## Decision 7: One-Purchase Testnet Authorization Policy

* **Date**: 2026-08-21
* **Category**: Payment Safety / Commercial Terms
* **Decision**: GOAT Testnet3 chain 48816 is the only live-authorizable network. The demo ceiling is exactly 0.10 USDC, may be lowered but not raised by environment configuration, and authorizes at most one purchase per explicit authorization. Merchant-derived minimum, token, recipient, real order, frozen Buy Contract, balances, and durable idempotency are mandatory. Mainnet remains blocked.
* **Consequences**: User budget and platform ceiling stay independent. Real Testnet3 commercial terms do not reclassify the paid service itself beyond `CONTROLLED_DEMO_SERVICE`. No order is probed while merchant fee funding is known insufficient, and no authorization preview can claim readiness without an order-bound Buy Contract.
