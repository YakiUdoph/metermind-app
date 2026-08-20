# MeterMind Notion Master Doc

## One-line statement
MeterMind is an autonomous procurement layer for AI agents that discovers, qualifies, selects, purchases, and verifies machine services.

---

## Executive Summary
MeterMind acts as a programmatic decision-making and reconciliation shield for autonomous agents. By separating selection constraints (budget, quality, reliability) from transactional settlement, it ensures agents spend cryptocurrency only on validated services that meet their acceptance criteria.

---

## The Problem
Agents are gaining the ability to pay for services, but payment capability alone does not answer:
- Which provider actually supports the required task?
- Is the cheapest option actually viable under current policies?
- Did the provider deliver the expected output or did it fail silently?
- How can developers verify, audit, and reconcile these transactions?

---

## What We Observed

### Observed & Tested (Facts)
- **Deterministic Scorer**: The utility selection logic in `scoring.ts` filters, evaluates, and deterministically ranks providers.
- **SDK Payment Hooks**: Integrates with the official GOAT Network AgentKit SDK, using EvmPayerWalletAdapter and HttpMerchantGatewayAdapter to sign payloads and execute token transfers.
- **Verification Command**: Running `npm run validate:foundation` executes 156 tests successfully.
- **Buy Contract & Acceptance Checks**: Hashing prevents term tampering, and delivery verification prevents marking a task complete if the payload is malformed.

### Hypothesis (Assumptions to Prove)
- Operators will pay a transaction markup to offload validation and selection from their core agent loop.
- Standardized schemas for machine API pricing will emerge across providers.

---

## Why Now
AI agents are transitioning from informational tasks to execution tasks. To execute reliably, they need deterministic, safe transactional loops that protect them from double-spends, rate-limits, and provider outages.

---

## Target User
Developers and creators of autonomous agent networks who consume multiple paid microservices.

---

## User Journey
1. User provides natural language request.
2. Agent parses intent and requirements.
3. MeterMind queries quotes and candidates.
4. MeterMind qualifies and ranks candidates, choosing the winner.
5. terms are frozen in a hashed `BuyContract`.
6. Payment policy evaluates the request and signs the transaction.
7. Wallet submits transaction to GOAT Testnet3.
8. Provider delivers output payload.
9. MeterMind verifies output schema and acceptance criteria.
10. Final audit log is generated.

---

## Product Lifecycle
Intent → Discovery → Quotes → Qualification → Ranking → Buy Contract → Policy Guard → GOAT Payment → Delivery → Acceptance → Audit log.

---

## Architecture
Vite React TanStack Start (unified Client & Server SSR execution).
- `src/domain/planning`: parsing intent & budget allocation.
- `src/domain/procurement`: scoring candidates.
- `src/domain/payment`: Buy Contract, verification rules, audits.
- `src/domain/execution`: orchestration pipelines & acceptance checks.
- `src/server/payment`: Wallet signers and GOAT adapter clients.

---

## Why GOAT Network
MeterMind utilizes the **GOAT Network AgentKit SDK** to settle payments. It uses:
- `HttpMerchantGatewayAdapter` to request payment intents, submit transaction proofs, and query payment settlement status.
- `EvmPayerWalletAdapter` to securely sign EVM transaction calldata.
- Bridged USDC contract transfers on GOAT Testnet3 (Chain ID `48816`).

---

## Procurement Decision Engine

### Hard Qualification
Filters catalog candidates against user constraints: budget, minimum quality, minimum reliability, exclusions, and destination addresses. Disqualified candidates are rejected immediately and cannot win.

### Ranking
Applies min-max normalization across qualified candidates based on: base cost, latency, quality, and reliability.

### Buy Contract
Freezes commercial terms (quote, amount, network, recipient, criteria) in a serializable structure. A SHA-256 hash verifies that no parameters are modified post-authorization.

### Payment Lifecycle
`CREATED` → `POLICY_APPROVED` → `PAYMENT_PENDING` → `SETTLED` → `DELIVERED`.

### Delivery Verification
Validates payload output against contract schema and criteria (e.g. JSON format, keyword presence).

---

## Failure Handling

### RPC Reliability
Ensures transaction timeouts do not cause immediate retries. The status must be resolved via merchant endpoints before a new transfer is authorized.

### Security
Mnemonics and private keys are read server-side only and stripped from all execution result audits.

---

## Demo Evidence
Refer to `docs/foundation/EVIDENCE.md` for test command outputs and trace references.

---

## Current Limitations
- RPC endpoints do not support automated fallback.
- Session states are in-memory (lacks persistent DB).
- Quote expiry check lacks automated re-quote loops.

---

## Foundation Validation Results
All 156 test cases passed. GOAT Testnet3 payment verified via simulation in the test suite due to missing credentials.

---

## Hackathon Scope
End-to-end flow execution linking live price inputs, scoring, mock payment settlement, and delivery acceptance verification.

---

## Post-Hackathon Roadmap
- **Month 1**: Telemetry, live SDK helper.
- **Months 2-3**: MCP Server integration, dynamic directory.
- **Months 3-6**: RFQs, spending limits.
- **Months 6-12**: M2M decentralized marketplace.

---

## Monetization
Initial 1% markup transaction fee on paid execution channels.

---

## Metrics
- Target procurement success rate > 98%.
- Double-payment rate = 0%.

---

## Risks
- Payment irreversibility on L2 networks.
- Merchant API availability.

---

## Open Questions
- Standardizing L2 gas payment offsets for high-frequency micro-payments.

---

## Moderator Feedback
- *Moderator requested to see the demo.*
- **Interpretation**: A functional developer-ready demo is the immediate priority.

---

## Feedback Log

| Date | Person/Role | Feedback | Interpretation | Product Change | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-08-17 | Hackathon Moderator | Requested demo | Focus on end-to-end execution path | Implement Buy Contract & Acceptance tests | `DONE` |

---

## Next Validation Questions
1. Which part of the procurement lifecycle is most valuable to GOAT?
2. What is required for Builder Grants consideration?
3. Which real agent workloads should we support first?
