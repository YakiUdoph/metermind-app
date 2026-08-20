# Monetization Models

MeterMind operates as an economic-control and optimization shield. This document details our business model and monetization strategies.

---

## 1. Primary Model: 1% Transaction Fee Markup

MeterMind applies a **1.0% markup fee** added to the base execution cost of all paid machine-service routes (like `paid_research` settled on GOAT Network).

### Unit Economics
*   **Provider Cost**: $0.0100 USDC
*   **MeterMind Fee (1%)**: $0.0001 USDC
*   **Total Payer Cost**: $0.0101 USDC

This fee is processed server-side at the time the `BuyContract` is generated and signed, split out from the payment destination, or added as a protocol fee.

---

## 2. Secondary Model: Savings-Share (Performance-based)

For enterprise-level search, translation, and large-scale research tasks, MeterMind implements a savings-share monetization model.
*   **Mechanism**: The scoring engine calculates the difference between the selected winner's price and the next-best qualified alternative.
*   **Commission**: MeterMind claims **10% to 20%** of the calculated savings.
*   **Example**: If the selected provider costs $0.02 and the next-best qualified provider is $0.05, the savings is $0.03. MeterMind collects 10% of that ($0.003).

This model ensures developers only pay when MeterMind successfully optimizes their budget.

---

## 3. Long-Term: Developer Tier SaaS Subscription

For high-volume operations, teams can purchase flat-rate monthly SaaS tiers to unlock advanced enterprise features:
*   **Advanced Policies**: Spending limits, custom exclusions, and multi-signature approvals.
*   **Analytics Dashboard**: Aggregate spend logs, telemetry charts, and historical provider performance metrics.
*   **Dedicated RPCs**: High-speed, rate-limit-free RPC endpoints.
