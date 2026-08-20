# Reality Check

This document maps user interface assertions and claims against the actual backend and domain implementations.

## Discovered Gaps & Classifications

Below is the verification audit of features displayed in UI vs their executable code backend:

### 1. "AI Decision / Selects Winner"
- **UI Claim**: The UI indicates that an AI agent dynamically decides which provider matches the task requirements.
- **Backend Reality**: The selection is entirely deterministic, using the utility-scorer function inside [`scoring.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/domain/procurement/scoring.ts) with min-max normalization and mathematical tie-breaking.
- **Classification**: `SAFE DEMO ABSTRACTION` (Auditability and determinism are required for economic transactions; using a deterministic scorer is superior to speculative LLMs).

### 2. "Provider Quality (e.g. 96) and Reliability (e.g. 99.1%)"
- **UI Claim**: The selection card highlights provider quality and historical reliability metrics.
- **Backend Reality**: These are hardcoded fixture values within [`mock.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/lib/mock.ts). No dynamic telemetry, user feedback loops, or historical metrics capture exists.
- **Classification**: `SAFE DEMO ABSTRACTION / ROADMAP` (Telemetry collection is scheduled for Month 1-2).

### 3. "GOAT Payment Succeeded"
- **UI Claim**: Shows a blockchain transaction has settled on the network and tokens were moved.
- **Backend Reality**: If live keys are missing, the executor uses [`simulated-paid-research.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/server/providers/simulated-paid-research.ts) and generates simulated transaction hashes (prefixed with `sim_`).
- **Classification**: `SAFE DEMO ABSTRACTION` (Ensure that simulated runs are explicitly labeled in the UI to prevent developers from mistaking simulation for live mainnet/testnet activity).

### 4. "Live Quotes & Bid Terms"
- **UI Claim**: Suggests that providers are bidding on service requests in real time.
- **Backend Reality**: Only `market_data` feeds (CoinGecko and Bitfinex) fetch live quotes. All search, translation, and extraction providers use static pricing tables.
- **Classification**: `ROADMAP` (Standardized Request For Quotes - RFQ - is targeted for Months 3-6).

### 5. "Budget Allocation Weights"
- **UI Claim**: Suggests dynamic, agentic division of funds across complex tasks.
- **Backend Reality**: Allocations are decided by multiplying the total budget by hardcoded weights inside [`budget.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/domain/planning/budget.ts).
- **Classification**: `SAFE DEMO ABSTRACTION`.
