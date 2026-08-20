<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Operational Rules for AI Coding Agents

This document is the mandatory operating policy for every AI developer, planner, or engineer agent working on MeterMind. These rules must be followed without exception.

---

## RULE 1: Read PRD.md and AGENTS.md before implementation
Before starting any code modification, feature implementation, or bug fix, read both `docs/PRD.md` and `AGENTS.md` to align with product thesis, architecture guidelines, and operational constraints.

## RULE 2: Existing working architecture must be reused before creating alternatives
Always inspect the codebase for existing modules before introducing new ones. Do not build parallel architectures or write redundant helper functions. Reuse established patterns, domain structures, and server/client helpers.

## RULE 3: Never change expected product behavior merely to satisfy a failing test
If a test fails, find the root cause in the code rather than modifying the test assertions or mocking expected outcomes away. The test suite is the single source of truth for MeterMind's security, policy, and compliance validations.

## RULE 4: Integration Classification Schema
Every service or data integration in this repository must be clearly classified under one of the following terms in all code, comments, documentation, and user interfaces:
*   `REAL`: Fully connected, executing production/testnet transactions with active state updates.
*   `SIMULATED`: Using mock functions, sandbox accounts, or prefixing outputs (e.g., transaction hashes starting with `sim_`) due to environment constraints.
*   `PARTIAL`: Ingests real data but lacks complete write/state capabilities or full loops.
*   `BLOCKED`: Integrations with external dependencies that cannot run due to missing credentials, server limits, or API shutdowns.
*   `BROKEN`: Broken pipelines or throwing errors.
*   `NOT IMPLEMENTED`: Placeholders or scheduled items on the roadmap.

## RULE 5: Never display simulated transactions as blockchain transactions
Simulated transactions must be explicitly labeled as such in the user interface. Developers and users must never be led to believe a transaction occurred on a live network when it did not.

## RULE 6: Never fabricate mock data
Do not fabricate:
*   Transaction hashes (use deterministic sandbox patterns with clear indicators like `sim_` prefixes).
*   Provider reputation scores (must represent static configured parameters or dynamic historical telemetry, never randomized).
*   Provider latency or reliability metrics.
*   Service quotes.
*   Payment settlement proofs.
*   Wallet token balances.
*   Blockchain network state.

## RULE 7: Distinguish telemetry from static metadata
Measured telemetry (live latencies, observed success ratios, actual request durations) and configured or static metadata (base provider catalog attributes) must be visually and programmatically distinguishable in UI dashboards and backend logs.

## RULE 8: Never expose secrets
Never expose, log, or commit private keys, wallet mnemonics, seed phrases, API secrets, or credentials. Server-side logs and audit files must sanitize all sensitive tokens before writing to disks or output traces.

## RULE 9: Independent dependency testing
Every external library, API package, or SDK (e.g. AgentKit additions or ethers version updates) must be independently validated and tested before integrating into core product loops.

## RULE 10: Architectural Decision Log
Every major architectural change, library addition, or pattern deviation must be recorded in:
`/docs/DECISIONS.md`

## RULE 11: Drift Log
Every discovered inconsistency between the expected product design, UI claims, and actual backend implementation must be recorded in:
`/docs/DRIFT_LOG.md`

For each entry, specify:
*   Date of discovery
*   Affected component
*   Expected behavior
*   Actual behavior
*   Root cause
*   Proposed fix or remediation
*   Regression test case
*   Current status

## RULE 12: Run validation after every major phase
Run `npm run validate:foundation` after making any major modifications to ensure all existing security and policy constraints remain 100% satisfied.
