# Product Roadmap

## Hackathon / Now (Verification Phase)
- **Goal**: Prove one complete procurement lifecycle end-to-end.
- **Key Deliverables**:
  - Integrate parallel live candidate feeds (Bitfinex & CoinGecko).
  - Implement frozen `BuyContract` backend primitives.
  - Implement `DeliveryAcceptance` validation rules.
  - Test double-spend, timeout, and tampering protections.
  - Ensure zero leak of server-side secrets.

## Month 1 (Harden & Telemetry)
- **Goal**: Move from simulation towards developer testing.
- **Key Deliverables**:
  - Harden provider adapter architecture.
  - Build helper SDK for easy provider onboarding.
  - Expose a public endpoint for external agents to trigger procurement plans.
  - Capture real performance metrics (observed latencies, HTTP status counts).
  - Build automated reconciliation loops for `UNKNOWN` transaction states.

## Months 2-3 (Discovery & Ecosystem)
- **Goal**: Expand capabilities and partner integrations.
- **Key Deliverables**:
  - Dynamic service registry/directory.
  - Score providers based on real historical data instead of static mock metrics.
  - Integrate Coinbase AgentKit adapter.
  - Integrate Model Context Protocol (MCP) servers to let LLM agents run MeterMind actions.
  - Dashboard for aggregate spend analytics.

## Months 3-6 (Treasury & Governance)
- **Goal**: Add team controls and flexible payment routes.
- **Key Deliverables**:
  - Request for Quotes (RFQ) standard for dynamic bidding.
  - Persistent agent budgets and token spending limits.
  - Support for multi-network payment paths.
  - Enterprise auditing logs and SSO controls.

## Months 6-12 (Machine-to-Machine Marketplace)
- **Goal**: Build a decentralized machine-service economy.
- **Key Deliverables**:
  - Permissionless marketplace for registering new machine APIs.
  - Decentralized provider reputation network.
  - Transaction-based fee monetization strategy.
