# Failure Strategy & Exception Handling

MeterMind is designed to protect autonomous agents from losing funds on-chain or repeating failed transactions. This document outlines our strategies for handling transactional failures.

---

## 1. Lifecycle Failure Matrix

| Failure Stage | Detected By | Action Taken | Result Status |
| :--- | :--- | :--- | :--- |
| **RPC Offline / Network Loss** | Wallet / Signer connection | Throws error before signing; blocks payment submission | `PAYMENT_SUBMISSION_FAILED` |
| **Payer Wallet Unfunded** | Ethers gas check | Blocks signature request | `PAYMENT_NOT_CONFIGURED` |
| **Merchant Challenge Invalid**| HTTP 402 Parser | Blocks signing loop | `X402_CHALLENGE_INVALID` |
| **Budget Policy Exceeded** | Policy Guard | Rejects signing before balance leaves wallet | `PAYMENT_BUDGET_EXCEEDED` |
| **Duplicate Spend Attempt** | Idempotency Guard | Blocks transaction signature | `PAYMENT_ALREADY_SETTLED` |
| **Paid but Delivery Fails** | Acceptance Check | Records transaction proof; marks delivery as failed | `PAID_BUT_DELIVERY_FAILED` |

---

## 2. Recovery Strategies
 
### RPC Redundancy (Active)
MeterMind supports fallback RPC rotation. If the primary connection throws an error or times out (5000ms limit), the signer rotates to the secondary Thirdweb RPC node. It verifies chain IDs on startup, blocking execution if the node returns an incorrect network ID.
 
### Double-Spend & Idempotency Safeguards
Using transactional reference databases, MeterMind maps the unique `idempotencyKey` of the request to the payment status. If an execution loop crashes post-payment but pre-delivery, subsequent retry requests with the same key are intercepted at the Policy Guard, preventing the wallet from signing a duplicate token transfer.
 
### Quote Expiry & Requote Loop
If a quote expires (reaches its 5-second TTL), the executor runs a requote-rescore loop. If no eligible providers are found during requoting or the price exceeds the allocated budget, the stage fails with `NO_PROVIDERS_FOR_SERVICE` or `EXECUTION_BUDGET_EXCEEDED` before any transaction is signed.
 
### Budget Ledger Reservations
Under multi-step bundle execution, step budgets are reserved ahead of execution. If a step fails to execute, the reserved budget is automatically released back to the process-local pool, allowing subsequent fallback steps to execute within the original task budget.
 
### The `PAID_BUT_DELIVERY_FAILED` State
This state is a P0 critical condition where a blockchain transfer settles successfully, but the merchant API returns an invalid payload or throws an HTTP 500 error.
*   **Mitigation**: MeterMind compiles the complete cryptographically signed payment audit logs containing the `transactionHash` and `paymentReference`.
*   **Acceptance Checking**: The payload is parsed under [`acceptance.ts`](file:///c:/Users/PC/Desktop/METERMIND/metermind-app/src/domain/acceptance/acceptance.ts). If the JSON is malformed or required keywords are missing, the executor marks the result as `PAID_BUT_DELIVERY_FAILED`.
*   **Resolution**: Developers can present this complete audit log to the merchant as deterministic proof of payment to claim refunds or retry the execution out-of-band.
