# Developer and Agent Interface

## Current interface (`REAL`)

MeterMind is currently an application repository, not a published SDK. Internal/server callers use `planTask(...)`, `evaluateProcurement(...)`, async `runProcurement(...)`, and `executeTaskPlan(...)`. These return repository domain types such as `ProcurementPlan`, `DecisionTrace`, and `ExecutionResult`.

`runProcurement(...)`, requoting, and execution accept an explicit `TrustDataProvider`. Inject `ERC8004TrustProvider` only in server-side live-read contexts; omit it for deterministic offline behavior. An explicit live provider never falls back to fixture trust.

## Proposed SDK (`NOT IMPLEMENTED`)

The previously documented `import { MeterMind } from "@metermind/sdk"` and `metermind.procure(...)` facade is a proposed future API. No `@metermind/sdk` package or `MeterMind` class is shipped by this repository.

Wallet material and merchant credentials remain server-side. Returned audits must be sanitized. Simulated results carry `sim_` references and cannot be represented as blockchain transactions.
