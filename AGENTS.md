# Digvation Business Web Engineering Contract

This repository is governed by the Digvation Lifecycle engineering system.

The current repository/path may still be named `digvation-pos-web` for historical reasons.
That name is not the current architecture boundary.

Project meaning:

```text
Digvation Business Web
├── Backoffice
└── Operational
```

Current `apps/backoffice` is the Backoffice foundation.
Current `apps/cashier` is the existing POS Operational implementation and may retain its current file/folder naming until an explicit migration/rename task changes it.

## Bootstrap

Before repository work:

1. Locate and read the nearest ancestor `lifecycle/AGENTS.md`.
2. Apply this repository contract after the global contract.
3. Apply any more-specific app/module-level `AGENTS.md`.

Do not assume the lifecycle contract was automatically loaded by the agent harness.

For ownership-sensitive work, read `standards/ECOSYSTEM_ARCHITECTURE.md` before interpreting historical POS names.

## Applicable scope contracts

Use the lifecycle `scopes/` catalog as the durable business-scope authority. Read only contracts materially involved in the current task:

- POS selling/transaction/cashier work -> `scopes/POS.md`;
- Employee Management / workforce identity -> `scopes/WORKFORCE.md`;
- Account/User/Role/Permission/RBAC -> `scopes/IDENTITY_ACCESS.md`;
- Branch/Location identity -> `scopes/ORGANIZATION_LOCATION.md`;
- Operational account branch/location access, Owner/Manager location scope, or branch switching -> `scopes/OPERATIONAL_ACCESS.md`;
- Catalog/product/service classification -> `scopes/CATALOG.md`;
- Audit/Activity -> `scopes/AUDIT_ACTIVITY.md`;
- Customer or Membership/Loyalty -> `scopes/CUSTOMER_MEMBERSHIP.md`;
- Promotion / commercial offer / discount / campaign rules -> `scopes/PROMOTION_COMMERCIAL.md`;
- dynamic tax/fiscal configuration/calculation -> `scopes/TAX_FISCAL.md`;
- Financial Accounts, payment routing to settlement destinations, Expenses, Cash Movements, Settlement, or Reconciliation -> `scopes/FINANCE_OPERATIONS.md`;
- Dashboard or Reports composition -> `scopes/DASHBOARD_REPORTING.md`;
- Inventory -> `scopes/INVENTORY.md` only when Inventory is actually in scope;
- Workshop -> `scopes/WORKSHOP.md` only when Workshop is actually in scope.

`Deferred`, `Planned`, and conceptual envelope items are not implementation authorization. The current user task remains the hard delivery boundary.

Source-code presence does not grant a product/capability. Optional domains/add-ons such as Inventory, Promotions, or Loyalty Points must be enabled by the effective entitlement set resolved by CORE/control-plane. SaaS plan names are packaging, not runtime authorization.

## Structural discovery

When Codebase Memory MCP is available:

- select the graph for the current repository name, currently `digvation-pos-web` unless it has been renamed;
- use it before broad repository-wide grep/find;
- query only symbols, routes, dependencies, callers/callees, ownership, and change impact relevant to the current work unit;
- verify important findings against current source;
- use change-impact information for targeted validation.

## UI / UX skill

For every frontend UI/UX task in this repository, use the installed `uiuxpromax` skill automatically before materially changing layouts, forms, interactions, responsive behavior, visual hierarchy, or reusable UI patterns. Existing Digvation Design System components/tokens and repository reality remain authoritative.

## Repository boundaries

This repository owns Digvation's shared business frontend experiences.

### Backoffice

Backoffice means **manage the business**.

It composes management modules contributed by entitled business domains and shared foundations.

Examples:

- POS sales/transaction management;
- Finance / Financial Operations management when `FINANCE_OPERATIONS` is effectively entitled;
- Workshop work-order/service management;
- Inventory management;
- workforce/organization management;
- reports/configuration where ownership is valid.

### Operational

Operational means **run the business now**.

It composes live execution modules such as:

- POS cashier/selling;
- Workshop mechanic/floor execution;
- Inventory receiving/picking/counting;
- future operational domain experiences.

`cashier` is not the architecture definition of the application. It is the current POS Operational module/implementation.

## Composition authority

Visible capability must be derived from authoritative runtime context such as:

```text
Effective Product/Capability Entitlements
INTERSECT Installation Runtime Capability
INTERSECT User Permission
INTERSECT Location / Operational Context
```

Do not:

- branch source behavior by client name;
- use `businessType` as entitlement authority;
- infer product access from white-label/dedicated deployment;
- create a new permanent frontend app merely because a new business domain exists.

Business type may influence onboarding presets/terminology only when explicitly supported.

## Business-domain ownership

The frontend does not own canonical business authority.

- POS behavior belongs to the POS domain/backend authority.
- Workshop behavior belongs to the Workshop domain/backend authority.
- Inventory stock belongs to Inventory authority.
- shared business identity belongs to its accepted shared owner.

Do not move business authority into Backoffice/Operational state because it is convenient for UI work.

No direct browser calls to Digvation CORE for normal business behavior.
No browser shortcut around the owning backend/domain API.
Do not invent backend/domain contracts.

`contracts/contract-lock.json`, where present, records verified backend reconciliation facts; historical naming does not change its authority rules.

## Frontend invariants

- No `businessType` or client-name source branching as feature authority.
- No JavaScript-number monetary authority.
- No global mirror that becomes authoritative Sale/Payment/Stock/WorkOrder state.
- Generated API code must not be manually edited.
- Shared Backoffice/Operational shells do not imply shared business-domain ownership.

## Existing implementation preservation

Architecture migration is not permission to restart accepted frontend work.

When moving existing POS functionality into the new meaning:

- move/re-home existing implementation before rewriting;
- preserve accepted behavior and routes where the current migration contract requires it;
- avoid duplicate old/new implementations;
- do not redesign accepted UI merely because ownership/folder boundaries change;
- treat existing Backoffice and Cashier code as migration source, not disposable legacy.

## Conditional standards

Do not read all documentation for every task.

Use the global lifecycle conditional-reading rules.

For this repository additionally:

- read `standards/ECOSYSTEM_ARCHITECTURE.md` for domain ownership, composition, entitlement, or Backoffice/Operational boundary changes;
- read `docs/architecture/FRONTEND_ARCHITECTURE_BASELINE.md` when frontend ownership/architecture is materially involved;
- read the relevant file under `docs/checkpoints/` only when the requested work maps to that checkpoint;
- read `docs/engineering/FRONTEND_ENGINEERING_CONSISTENCY_STANDARD.md` when changing shared frontend structure or conventions;
- read `docs/integration/FRONTEND_BACKEND_RECONCILIATION_STANDARD.md` when backend contracts are materially involved;
- read `docs/engineering/FRONTEND_LOCAL_ACCEPTANCE.md` at local/manual acceptance;
- read `docs/engineering/FRONTEND_CHANGE_HANDOFF_AND_GIT_STANDARD.md` at commit/push/PR/merge handoff;
- read `docs/engineering/FRONTEND_VERSIONING_STANDARD.md` only at version/release gates.

## Validation

Use targeted checks during implementation.

Run broader repository acceptance only when the coherent requested work unit reaches the applicable acceptance gate.

Never claim an unexecuted check passed.
