# MeterMind Autonomous Procurement Engine

MeterMind is the economic control and procurement intelligence layer for autonomous AI agents. This document explains in simple terms how the procurement engine works, why it exists, and how it protects agent funds.

---

## 1. Why MeterMind Exists
While AI agents can autonomously send funds using machine payment rails (like x402), payment is only one part of commerce. Before spending capital, an agent needs answers to critical commercial questions:
*   *What service do I actually need?*
*   *Which providers support this service?*
*   *Which provider offers the best value?*
*   *Is the quote acceptable and within budget?*
*   *Did the provider actually deliver what was purchased?*

MeterMind automates these checks, serving as a procurement layer that makes decisions transparent, cost-optimal, and secure.

---

## 2. What Is Being Procured
MeterMind procures API services on behalf of AI agents. Supported service categories include:
*   `market_data`: Crypto or financial price feeds (e.g. CoinGecko, Bitfinex)
*   `web_search`: Search engine queries
*   `content_extraction`: Web page scraping and parsing
*   `summarization`: Content condensation
*   `translation`: Multi-lingual translation
*   `code_analysis`: Static analysis or debugging
*   `image_analysis`: Computer vision extraction
*   `paid_research`: Premium, x402-payable deep research

---

## 3. How Providers Compete
Providers list their services in the catalog or quote them dynamically. They compete across four primary dimensions:
1.  **Price**: The cost per execution.
2.  **Latency**: Time taken to return a result (ms).
3.  **Quality**: Accuracy or depth score (0-100).
4.  **Reliability**: Success rate of historically completed requests (%).

---

## 4. Hard Constraints
Before any scoring takes place, MeterMind filters out candidates that violate any of the user's strict parameters. A candidate violating a hard constraint is immediately disqualified and can **never** win, regardless of how well it scores on other features.

Hard constraints include:
*   **Price > Budget**: Rejecting candidates that cost more than the allocated budget.
*   **Excluded Providers**: Strict blacklists (e.g. "Do not use Provider X").
*   **Latency > Safety Limit**: Rejecting slow candidates.
*   **Quality / Reliability below minimums**: Enforcing strict quality thresholds.
*   **Freshness / Network requirements**: Ensuring live execution on correct chains.

---

## 5. How Scoring Works
For eligible candidates, MeterMind normalizes their metrics using a Min-Max normalizer:
*   **Price & Latency**: Lowest values receive a score of `100`; highest receive `0`.
*   **Quality & Reliability**: Used directly (since they are already bounded 0-100).

These normalized scores are then multiplied by priority weights:
*   `CHEAPEST`: 75% Price weight
*   `FASTEST`: 65% Latency weight
*   `HIGHEST_QUALITY`: 70% Quality weight
*   `MOST_RELIABLE`: 80% Reliability weight
*   `BALANCED`: Multi-objective balance (20% Price, 45% Quality, 25% Reliability, 10% Latency)

A soft preference bonus of `+3` is added if the user specifies a preferred provider. Tie-breaking is deterministic (Reliability -> Quality -> Price -> Latency -> ID alphabetical).

---

## 6. What Pareto Optimal Means
A candidate is **Pareto optimal** (or Pareto efficient) if there is no other candidate that is strictly better in at least one dimension without being worse in any other. 

If Candidate A dominates Candidate B (i.e. A is cheaper, faster, and higher quality than B), B is removed from the Pareto optimal set. Identifying the Pareto frontier helps agents select trade-off options intelligently rather than relying blindly on a single score.

---

## 7. How Budgets Are Protected (The Budget Ledger)
MeterMind uses a process-local **Budget Ledger** to manage funds for multi-step bundles.
1.  **Reservation**: Before starting an execution step, the estimated cost is reserved. If the reservation exceeds the remaining task budget, execution is blocked immediately.
2.  **Spent**: Once a step settles successfully, the actual cost is moved to the spent column.
3.  **Refund**: If a step fails, the reserved amount is released back to the remaining pool.

This guarantees that the total spent across all steps never exceeds the original task budget.

---

## 8. How Quote Expiry Works (Requoting)
Quotes can expire quickly in volatile environments. MeterMind assigns a Time-To-Live (TTL) to every quote (default: 5 seconds). 
Before freezing the transaction contract, MeterMind checks if the quote is stale. If it has expired, MeterMind runs a **requote loop**:
1.  Query candidates again for fresh prices.
2.  Rescore candidates.
3.  Confirm the winner (and switch providers if the winner changed).
4.  Freeze the contract.
This loop is bounded to 2 attempts max to prevent infinite retries.

---

## 9. How Decisions Are Explained
MeterMind generates human-readable justifications explaining:
*   Why the winner beat the runner-up with concrete differences (e.g. *"Bitfinex was selected because it is 200ms faster than CoinGecko at the same price"*).
*   Which candidates were eligible or rejected.
*   Whether the choice is Pareto optimal.

---

## 10. The Buy Contract
The **Buy Contract** is a cryptographically signed document that freezes the procurement decision. It acts as a purchase order containing:
*   The exact terms of the purchase (amount, currency, recipient, deadline).
*   The hash of the procurement decision trace (`decisionEvidenceHash`).
*   A cryptographic hash of all parameters (`contractHash`).

Any subsequent mutation of the terms of this contract will fail validation checks, protecting the agent against merchant tampering or duplicate billing.
