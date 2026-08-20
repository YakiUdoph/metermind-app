# Product Reality Report

Updated: 2026-08-20 (Phase 3.1B read-only ERC-8004 proof)

| Area | Status | Reality |
| --- | --- | --- |
| Planning, qualification, scoring, Pareto selection | `REAL` | Deterministic application logic with test coverage. |
| CoinGecko and Bitfinex market reads | `REAL` | External HTTP adapters; availability depends on provider/network configuration. |
| Paid research execution | `SIMULATED` | Local controlled HTTP-402 router with deterministic `sim_` evidence. It is never labeled live. |
| GOAT AgentKit payment implementation | `BLOCKED` | Code exists, but execution fails closed without a frozen Buy Contract, real merchant receiver, merchant credentials, and durable idempotency readiness. No live payment has been proved. |
| GoatFlow merchant/order SDK | `PARTIAL` | Merchant lookup/order helpers exist separately from the AgentKit execution path. No end-to-end economic proof has been executed. |
| ERC-8004 identity/reputation reads | `PARTIAL` | ERC-8004 read integration proven on GOAT Testnet3 for external agent 356: identity verified; metadata absent; client list empty; no reputation score exists. AgentKit read actions, RPC fallback/timeout/cache, and explicit provenance are wired. |
| ERC-8004 feedback preparation/write | `PARTIAL` | Production acceptance can prepare hashed feedback, but no feedback was submitted and the chain-write path remains `NOT IMPLEMENTED`. |
| Idempotency persistence | `NOT IMPLEMENTED` | Simulation uses process-local state. Live payment fails closed unless a durable-store readiness boundary is supplied; durable storage remains future work. |
| Public `@metermind/sdk` facade | `NOT IMPLEMENTED` | Current callable interfaces are repository functions, not a published SDK. |

The canonical validation target contains 189 tests. Command results belong in `docs/VALIDATION.md`; documentation must not claim success before commands exit successfully.

Safe claims include deterministic procurement, Buy Contract tamper checks, policy guards, explicit simulated x402 execution, live market reads, and **ERC-8004 read integration proven on GOAT Testnet3** for identity/no-feedback evidence. Claims of a reputation score for the tested agent, completed live payment, live paid-research merchant, reputation write, durable restart-safe idempotency, or published SDK are not permitted.
