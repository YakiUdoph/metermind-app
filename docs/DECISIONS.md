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
