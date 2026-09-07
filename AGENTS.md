# Digvation POS Web Engineering Contract

This repository is governed by the Digvation Lifecycle engineering system.

## Bootstrap

Before repository work:

1. Locate and read the nearest ancestor `lifecycle/AGENTS.md`.
2. Apply this repository contract after the global contract.
3. Apply any more-specific app-level `AGENTS.md`.

Do not assume the lifecycle contract was automatically loaded by the agent harness.

## Structural discovery

When Codebase Memory MCP is available:

- select the graph for `digvation-pos-web`;
- use it before broad repository-wide grep/find;
- query only symbols, routes, dependencies, callers/callees, ownership,
  and change impact relevant to the current work unit;
- verify important findings against current source;
- use change-impact information for targeted validation.

## Repository boundaries

- This repository owns POS frontend applications.
- Cashier and Backoffice remain independently deployable.
- They must not import each other's application internals.
- Do not modify a backend repository unless the requested work explicitly
  crosses that boundary.
- Do not invent backend contracts.
- No direct browser calls to Digvation CORE for normal product behavior.
- `contracts/contract-lock.json` records verified backend reconciliation facts.

## Frontend invariants

- No `businessType` or client-name source branching.
- No JavaScript-number monetary authority.
- No global mirror of authoritative Sale/Payment server state.
- Generated API code must not be manually edited.

## Conditional standards

Do not read all documentation for every task.

Use the global lifecycle conditional-reading rules.

For this repository additionally:

- read `docs/architecture/FRONTEND_ARCHITECTURE_BASELINE.md`
  when frontend ownership/architecture is materially involved;
- read the relevant file under `docs/checkpoints/` only when the requested
  work maps to that checkpoint;
- read `docs/engineering/FRONTEND_ENGINEERING_CONSISTENCY_STANDARD.md`
  when changing shared frontend structure or conventions;
- read `docs/integration/FRONTEND_BACKEND_RECONCILIATION_STANDARD.md`
  when backend contracts are materially involved;
- read `docs/engineering/FRONTEND_LOCAL_ACCEPTANCE.md`
  at local/manual acceptance;
- read `docs/engineering/FRONTEND_CHANGE_HANDOFF_AND_GIT_STANDARD.md`
  at commit/push/PR/merge handoff;
- read `docs/engineering/FRONTEND_VERSIONING_STANDARD.md`
  only at version/release gates.

## Validation

Use targeted checks during implementation.

Run broader repository acceptance only when the coherent requested work unit
reaches the applicable acceptance gate.

Never claim an unexecuted check passed.
