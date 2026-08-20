# Product Roadmap

This roadmap outlines the milestones for MeterMind as we transition from a hackathon proof-of-concept into a decentralized machine-to-machine procurement protocol.

---

## Milestone 0: Hackathon (Now)
*   **Goal**: Verify one complete end-to-end procurement lifecycle.
*   **Key Deliverables**:
    *   Unified intent parser and budget partitioning engine.
    *   Deterministic min-max normalization scorer.
    *   Hashed and signed `BuyContract` backend primitives.
    *   Official GOAT Network AgentKit payment flows (simulated and live-ready).
    *   Output acceptance checking and sanitization audits.

---

## Milestone 1: Telemetry & Fallbacks (Month 1)
*   **Goal**: Harden the integration and gather real performance metrics.
*   **Key Deliverables**:
    *   Measure live latencies and HTTP status codes to replace mock metrics.
    *   Build client-side fallback list for GOAT Testnet3 RPC endpoints to survive node downtime.
    *   Introduce automated reconciliation loops to handle `UNKNOWN` payment settlement states.

---

## Milestone 2: Ecosystem & Developer Tools (Months 2-3)
*   **Goal**: Expand integration options and developer ease-of-use.
*   **Key Deliverables**:
    *   Dynamic, on-chain service registry.
    *   Release the Model Context Protocol (MCP) server, allowing LLM-based agents to trigger MeterMind procurement actions.
    *   Onboard external developers with a client-side SDK.

---

## Milestone 3: Policy Limits & RFQs (Months 3-6)
*   **Goal**: Introduce advanced treasury management and custom bidding.
*   **Key Deliverables**:
    *   Persistent database structures to enforce daily agent spending limits.
    *   Standardize Request For Quotes (RFQs) for dynamic provider bidding.
    *   Support multi-chain payment pathways (GOAT, Ethereum, Base).

---

## Milestone 4: Decentralized M2M Marketplace (Months 6-12)
*   **Goal**: Launch a permissionless, decentralized machine commerce network.
*   **Key Deliverables**:
    *   On-chain provider reputation tracking (ERC-8004/equivalent schemas).
    *   Decentralized provider catalog registration.
    *   Automated transaction-based fee splitting via smart contracts.
