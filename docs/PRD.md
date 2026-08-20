# Product Requirements Document (PRD)

## 1. Product Statement

MeterMind is an autonomous procurement and economic-control layer for AI agents that discovers, qualifies, selects, purchases, and verifies machine services. It bridges the gap between wallet payment rails (x402) and autonomous commerce.

## 2. The Problem

AI agents are increasingly capable of spending money autonomously using machine-payment rails such as x402. However, payment is only one part of autonomous commerce. Before an agent spends money, it still needs to determine:
*   What service does it actually need to satisfy user intent?
*   Which providers can satisfy the task requirements?
*   Which provider should win (objective value-based selection)?
*   Is the provider trustworthy/reliable?
*   Is the quote acceptable (within budget)?
*   Is the purchase within policy/budget?
*   What exactly is being purchased?
*   How do we prevent duplicate payments (idempotency)?
*   Did the provider deliver what was purchased (delivery verification)?
*   Should the result be accepted or rejected?
*   What evidence should be retained (audits)?
*   How should successful/failed delivery affect future provider selection?

Simply having a wallet (payment rail) does not solve these verification, selection, policy, and reconciliation issues.

## 3. Target User

Developers and operators of autonomous agent networks (e.g. trading bots, autonomous researchers, translation pipelines) consuming paid APIs and micro-services.

## 4. Job To Be Done

> "When my agent needs an external service, choose an objective, acceptable provider within my budget and constraints, authorize the correct transaction, verify delivery of the payload, and output structured audit evidence."

## 5. Core Workflow (17-Step Target Lifecycle)

```
[Agent Request] 
  ↓ 
[Intent Understanding] 
  ↓ 
[Capability Requirements] 
  ↓ 
[Provider Discovery] 
  ↓ 
[Provider Quotes] 
  ↓ 
[Provider Telemetry] 
  ↓ 
[ERC-8004 Trust/Reputation] 
  ↓ 
[Procurement Scoring] 
  ↓ 
[Winner Selection] 
  ↓ 
[Selection Explanation] 
  ↓ 
[Buy Contract] 
  ↓ 
[Policy Validation] 
  ↓ 
[x402 Payment] 
  ↓ 
[GOAT Settlement] 
  ↓ 
[Service Execution] 
  ↓ 
[Delivery Acceptance] 
  ↓ 
[Reputation Feedback] 
  ↓ 
[Procurement Receipt / Audit]
```

## 6. Non-Goals

MeterMind is not:
*   A generic cryptocurrency wallet or browser extension.
*   A generic chatbot or conversational agent.
*   A blockchain transaction explorer.
*   Another payment rail or Layer 2 network.
*   A static API price-comparison dashboard.

## 7. Success Metrics

*   **Procurement Success Rate**: Percentage of plans successfully executed.
*   **Accepted-Delivery Rate**: Percentage of paid transactions resulting in an accepted payload.
*   **Double Payment Rate**: Percentage of duplicate payments (target is 0%).
*   **Average Procurement Latency**: Time from user intent to verified delivery.
*   **Rejected Bad-Provider Rate**: Disqualified candidates correctly filtered.
*   **Decision Audit Coverage**: Percentage of transactions with complete, cryptographically signed evidence.

## 8. Risks

*   **Standardized API Quotes**: Gaps in standardized schemas for machine-service rates.
*   **Irreversibility**: Blockchain payment settlement cannot be undone if delivery fails.
*   **Reconciliation Timeouts**: Network delay causing status checks to fail.
*   **RPC Availability**: Downtime of testnet/mainnet RPC endpoints.
*   **x402 Ecosystem Maturity**: Merchant integration complexity.

## 9. Hackathon Scope
*   One convincing, end-to-end verified procurement lifecycle using the combination of live market-data feeds and simulated/mocked premium research services.

## 10. Phase 2 Implementation Scope (Procurement Intelligence Engine)

*   **Natural Language Intent & Constraint Extraction**: Automated parsing of user intent for budgets, latencies, provider exclusions/preferences, quality, reliability, networks, and freshness.
*   **Multi-Service Bundle Planning**: Dynamic scheduling and sequencing of complex workflows.
*   **Hard Constraint Filters**: Rejection of providers violating strict price, latency, exclusion, quality, reliability, freshness, or network constraints.
*   **Pareto Frontier Selection**: Identifying dominated candidates to optimize trade-offs between price, quality, and latency.
*   **Deterministic Scorer**: Normalizing capabilities and weighing metrics based on user priority (Cheapest, Fastest, Highest Quality, Most Reliable, Balanced).
*   **Quote Freshness Verification & Re-quoting**: Automatic detection of expired quotes with dynamic rescoring and provider switching.
*   **Process Budget Reservation Ledger**: Thread-safe reservation, transactional release on failure, and spent confirmation on success.

