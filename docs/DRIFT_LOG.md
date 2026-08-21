# Drift Log

This document records the discovered inconsistencies between expected product design/UI specifications and the actual backend implementation.

---

### Drift Entry 1: Process-Local Idempotency Store
*   **Date of Discovery**: 2026-08-19
*   **Affected Component**: Payment Policy Guard (`policy.ts` / `simulated-x402-client.ts`)
*   **Expected Behavior**: Settled payments and transaction idempotency checks must survive system/process restarts to prevent double-spending in production scenarios.
*   **Actual Behavior**: Idempotency is tracked using a process-local memory Set (`settledPayments` or `alreadyPaidKeys`), meaning that when the Node.js server restarts, the idempotency history is lost.
*   **Root Cause**: Local storage is not wired to a persistent DB (e.g. SQLite/PostgreSQL) yet.
*   **Proposed Fix/Remediation**: Integrate a persistent database table for transaction keys and match them in `verifyPaymentPolicy`.
*   **Regression Test Case**: `payment.test.ts` check 7 & 8.
*   **Status**: Identified (Medium Priority).

---

### Drift Entry 2: Hardcoded Fallback USDC Asset Address
*   **Date of Discovery**: 2026-08-19
*   **Affected Component**: Wallet Balance Adapter (`wallet.ts`)
*   **Expected Behavior**: Bridge token address contracts should be dynamically resolved or configured per network request.
*   **Actual Behavior**: The USDC contract address is hardcoded to `0x3022b87ac063DE95b1570F46f5e470F8B53112D8` in `getWalletBalances` default path.
*   **Root Cause**: Hardcoded shortcut for GOAT Testnet3 bridged USDC.
*   **Proposed Fix/Remediation**: Move address configurations into an environment variable configuration file or dynamically fetch from a registry.
*   **Regression Test Case**: `payment.test.ts` balance validation checks.
*   **Status**: Identified (Low Priority).

---

### Drift Entry 3: Absence of Live RPC Latency Measurement
*   **Date of Discovery**: 2026-08-19
*   **Affected Component**: Procurement Scoring Engine (`scoring.ts`)
*   **Expected Behavior**: Provider latencies must reflect measured live HTTP execution metrics.
*   **Actual Behavior**: Scoring defaults to pre-configured catalog latencies if observed metrics are missing or if providers run in simulation mode.
*   **Root Cause**: Cold start requests have no historical telemetry.
*   **Proposed Fix/Remediation**: Maintain a rolling average of observed execution latencies inside a server-side telemetry store.
*   **Regression Test Case**: `live-competition.test.ts` Milestone 5 checks.
*   **Status**: Identified (Low Priority).

---

### Drift Entry 4: Non-Deterministic Live Competition Timings & Global Fetch Pollution
*   **Date of Discovery**: 2026-08-20
*   **Affected Component**: Live Competition execution tests (`live-competition.test.ts` & `coingecko.test.ts`)
*   **Expected Behavior**: Tests must run deterministically without timing collisions or global test suite state pollution.
*   **Actual Behavior**: Global `globalThis.fetch` mutation caused side-effects and test pollution across concurrent runs. Event-loop scheduling jitter in `setTimeout` occasionally caused preferred providers to lose due to narrow margins (40ms vs 10ms with a 50ms bonus).
*   **Root Cause**: Lack of dependency injection for `fetch` in CoinGecko and Bitfinex adapters, and overly narrow setTimeout timing windows.
*   **Proposed Fix/Remediation**: Added constructor-injected `fetchFn` for adapters, subclassed them locally in test files to inject isolated mock handlers (removing global fetch mutations), and adjusted simulated timing margins to 12ms (CoinGecko) and 2ms (Bitfinex) to guarantee deterministic preference outcomes under CPU scheduling loads.
*   **Regression Test Case**: `live-competition.test.ts` Test 5 ("Preferred live provider wins even if slightly slower").
*   **Status**: Resolved.

---

### Drift Entry 5: Simulated Paid Research Labeled Live
* **Date of Discovery**: 2026-08-20
* **Affected Component**: Simulated paid-research adapter, provider catalog, execution UI
* **Expected Behavior**: Local HTTP routers and `sim_` evidence must be labeled `SIMULATED`/demo.
* **Actual Behavior**: The adapter and catalog declared live execution.
* **Root Cause**: Execution capability was confused with infrastructure classification.
* **Proposed Fix/Remediation**: Use demo execution mode, explicit `SIMULATED` classification, and UI/regression assertions.
* **Regression Test Case**: Payment suite test 30.
* **Current Status**: Resolved in Phase 3.1A.

### Drift Entry 6: Unsafe Default ERC-8004 Agent ID
* **Date of Discovery**: 2026-08-20
* **Affected Component**: `ERC8004TrustProvider`
* **Expected Behavior**: Provider identity must use an explicitly verified mapping.
* **Actual Behavior**: Paid research silently defaulted to agent ID 1.
* **Root Cause**: Demonstration fallback leaked into live lookup logic.
* **Proposed Fix/Remediation**: Return `NOT_CONFIGURED` when no mapping exists.
* **Regression Test Case**: Phase 3 trust profile test.
* **Current Status**: Resolved in Phase 3.1A.

### Drift Entry 7: Live Payment Diverged From Buy Contract
* **Date of Discovery**: 2026-08-20
* **Affected Component**: AgentKit GOAT payment client
* **Expected Behavior**: Provider, amount, currency, token, chain, payer, recipient, quote, and idempotency must match the frozen contract.
* **Actual Behavior**: Amount was hardcoded to 0.01 USDC and live policy used an idempotency lookup that always returned false.
* **Root Cause**: Live-ready scaffolding predated full commercial invariant binding.
* **Proposed Fix/Remediation**: Require the Buy Contract, derive payment values from it, validate merchant intent fields, and fail closed without durable idempotency readiness.
* **Regression Test Case**: Buy Contract tests 4/5 and payment tests 7/24-35.
* **Current Status**: Guard repaired; durable persistence remains `NOT IMPLEMENTED`, so real execution stays blocked.

### Drift Entry 8: Documentation Overstated Integration and SDK
* **Date of Discovery**: 2026-08-20
* **Affected Component**: Reality, architecture, GOAT, trust, validation, and agent-interface documentation
* **Expected Behavior**: Documentation uses repository classifications and describes only executed capabilities.
* **Actual Behavior**: Docs claimed 180 passing tests, real paid research/GOAT integration, completed feedback behavior, and a nonexistent `@metermind/sdk` facade.
* **Root Cause**: Documentation was not reconciled after Phase 3 work began.
* **Proposed Fix/Remediation**: Reclassify capabilities, document the dual GOAT boundary, and mark the SDK as proposed.
* **Regression Test Case**: Phase-close documentation review.
* **Current Status**: Resolved in Phase 3.1A.

### Drift Entry 9: Live Trust Reads Could Fall Back to Fixture Scoring
* **Date of Discovery**: 2026-08-20
* **Affected Component**: ERC-8004 trust provider and procurement scoring
* **Expected Behavior**: Explicit live trust must retain on-chain/unavailable provenance and never inherit fixture reputation.
* **Actual Behavior**: Missing live profile entries could be resolved through the synchronous fixture helper; the provider also used direct contracts, one RPC, and an incorrect client filter for reputation.
* **Root Cause**: Phase 3 fixture behavior and the live adapter shared fallback assumptions.
* **Proposed Fix/Remediation**: Use AgentKit read actions, explicit profiles for every candidate, RPC chain/bytecode validation, timeout/fallback/cache, and no fixture substitution.
* **Regression Test Case**: Phase 3 highest-trust live-like injection and minimum-reputation gate.
* **Current Status**: Resolved in Phase 3.1B.

### Drift Entry 10: Feedback Was Modeled but Not Produced
* **Date of Discovery**: 2026-08-20
* **Affected Component**: Delivery acceptance / reputation feedback boundary
* **Expected Behavior**: Acceptance output should produce a reviewable feedback payload without submitting it.
* **Actual Behavior**: Tests manually constructed feedback objects and no production helper existed.
* **Root Cause**: Feedback preparation and chain submission were treated as one future feature.
* **Proposed Fix/Remediation**: Hash acceptance evidence into `PreparedReputationFeedback`; keep all ERC-8004 writes disabled.
* **Regression Test Case**: Phase 3 delivery acceptance feedback preparation test.
* **Current Status**: Preparation resolved in Phase 3.1B; submission remains `NOT IMPLEMENTED`.

### Drift Entry 11: Contradictory GOAT Merchant Intent Paths
* **Date of Discovery**: 2026-08-20
* **Affected Component**: `goat-client.ts` and `goatflow-client.ts`
* **Expected Behavior**: One authority supplies order terms and settlement state.
* **Actual Behavior**: AgentKit merchant-intent and GoatFlow order clients used different endpoints and schemas.
* **Root Cause**: Two integration experiments lacked a finalized ownership boundary.
* **Proposed Fix/Remediation**: GoatFlow owns merchant/order/status terms; AgentKit is payer-only after contract verification and authorization.
* **Regression Test Case**: Phase 3.1C preflight and durable-ledger restart test.
* **Current Status**: Boundary decided; broadcast wiring remains blocked.

### Drift Entry 12: Gateway Minimum Exceeds Safety Ceiling
* **Date of Discovery**: 2026-08-20
* **Affected Component**: GoatFlow merchant order API and payment policy
* **Expected Behavior**: A merchant-supported amount fits MeterMind's live ceiling.
* **Actual Behavior**: Minimum is 0.1 USDC, the ceiling is 0.05, and merchant fee balance is $0 against $0.05 required.
* **Root Cause**: Live merchant economics had not previously been queried.
* **Proposed Fix/Remediation**: Fund the merchant fee balance, then explicitly authorize any ceiling change to exactly 0.1 USDC.
* **Regression Test Case**: `scratch/goat-payment-live-preflight.ts`.
* **Current Status**: `BLOCKED`; no order, signature, or broadcast.

### Drift Entry 13: Implicit Live Ceiling and Missing Commercial Minimum
* **Date of Discovery**: 2026-08-21
* **Affected Component**: Wallet configuration, paid-research adapter, and payment preview
* **Expected Behavior**: Budget, merchant minimum, and platform safety ceiling are independent constraints with explicit provenance and one-purchase authorization.
* **Actual Behavior**: A hard-coded 0.05 ceiling conflicted with GOAT's 0.10 minimum; merchant minimum/source and an authorization preview were not modeled.
* **Root Cause**: The original safety constant predated live merchant economics.
* **Proposed Fix/Remediation**: Centralize a non-escalating 0.10 Testnet3 policy, model live merchant terms, reject sub-minimum budgets, and require an order-bound frozen Buy Contract before preview.
* **Regression Test Case**: `src/domain/payment/live-payment-policy.test.ts`.
* **Current Status**: Software drift resolved; external merchant fee remains `BLOCKED`.
