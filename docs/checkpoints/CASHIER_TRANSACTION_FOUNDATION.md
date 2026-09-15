# Cashier Transaction Foundation

## Status

```text
Checkpoint: F1 — Cashier Transaction Foundation
Status: APPROVED
Approved: 2026-09-02
Accepted prerelease: 0.1.0-alpha.2
Validated implementation head: d60ee67e6856fc8dcffe730616cbb4805d3856a0
Validation: Frontend CI run #37 — PASS
```

This approval accepts the F1 behavior and boundaries described below. It does not authorize F2 scope, backend redesign, production AUTH-01 integration, or any deferred business capability.

## Objective

Establish the first production-shaped Cashier transaction boundary on top of the accepted Frontend Foundation without expanding into Payment, employee Assignment/Contribution, full Fulfillment, Discount/Override, Finalize/Void, Customer/Loyalty, Refund, Receipt, or Reporting workflows.

The POS backend remains authoritative for Sale state, captured pricing, tax, totals, optimistic transaction versioning, and command acceptance.

## Backend baseline reconciled

This checkpoint is reconciled against the locked POS backend baseline:

```text
release: v0.3.0
SHA: d58327fa17322d1a98049d842f43742635e744f7
API prefix: /api/v1
```

AUTH-01 remains separately in progress. Cashier therefore preserves the accepted `AuthPort` + development `MockAuthAdapter` boundary and does not invent token persistence or authentication transport.

## Accepted scope

F1 accepts:

- ACTIVE Selling Location selection presented as Branch/Cabang;
- ACTIVE category and item catalog discovery with search/category filtering;
- temporary priced-catalog composition behind `SellingCatalogQuery` using the existing backend pricing resolve contract;
- active variant lookup on demand and variant selection before Add where applicable;
- lazy transaction start: an empty Cashier workspace does not create a Sale until the operator adds the first valid item;
- idempotent Create Sale followed by idempotent Add SaleLine;
- recovery when Create Sale succeeds but first Add SaleLine fails: keep the same empty OPEN Sale active and never auto-void or create a second Sale;
- `/sell/:saleId` as the authoritative active-Sale route;
- Sale server state owned by TanStack Query, with no client-side Sale/cart mirror;
- backend-returned decimal strings as monetary authority;
- decimal-safe quantity increase/decrease and versioned quantity mutation;
- versioned SaleLine removal;
- latest backend Sale `version` used as `expectedVersion` for versioned commands;
- `SALE_VERSION_CONFLICT` recovery by refetching the latest Sale and requiring explicit operator review, with no automatic command replay;
- offline business mutation blocking with no paused financial mutation auto-resume;
- basic Open Sales operational queue and recent-Sale navigation;
- switching an OPEN Sale by navigation only, without changing backend Sale status;
- starting a new Sale while another remains OPEN, without inventing HOLD/PARKED/SUSPENDED statuses;
- Branch switching that leaves the previous Sale OPEN and clears only active frontend navigation context;
- query/command seams separated from presentation components;
- explicit backend-gap documentation for cashier catalog projection, priced catalog projection, Open Sales projection, human Sale reference, and atomic transaction start.

## Explicitly deferred

The following remain outside F1 and must not be treated as accepted production capability from this checkpoint:

- Payment and settlement;
- employee Assignment;
- employee Contribution;
- full Fulfillment transitions;
- Discount and price Override;
- Sale Finalize and Void;
- Customer persistence/context mutation;
- Loyalty membership lookup or redemption;
- Refund;
- Receipt;
- Reporting/analytics;
- production AUTH-01 adapter integration;
- WebSocket/SSE/presence/edit locks;
- offline transactional writes or mutation queues;
- client-specific source branching or `businessType` behavior.

## Contract classification

### FRONTEND_ONLY

- Cashier workspace composition and loading/error/empty states;
- TanStack Query keys and command orchestration;
- active-Sale navigation context and recent-Sale navigation history;
- Branch-switch confirmation behavior;
- decimal-string quantity syntax validation before transport;
- centralized Sale workspace projection/action availability;
- version-conflict review presentation;
- offline mutation guard;
- temporary catalog/Open Sales adapters that hide backend projection gaps from presentation components.

### EXISTING_BACKEND_CONTRACT

Locked backend `v0.3.0` provides the contracts consumed by this checkpoint, including:

- Selling Locations;
- Catalog Categories, Items, and Variants;
- pricing resolve;
- Sale create/list/get;
- SaleLine add, quantity change, and remove;
- command idempotency where required;
- optimistic `expectedVersion` concurrency.

Sale amounts and quantities are serialized as decimal strings. Sale state and monetary values displayed after mutation are sourced from backend responses.

### POS_BACKEND_GAP

F1 intentionally keeps the following needs behind frontend seams instead of manufacturing frontend authority:

- cashier-oriented Selling Catalog query;
- priced Catalog projection suitable for Cashier reads;
- lightweight Open Sales operational projection;
- human-friendly Sale reference;
- atomic transaction start that can eliminate the Create-success/Add-failure split-command gap.

The Selling Location contract is tenant-scoped and does not yet define a narrower per-user Branch grant. The frontend therefore does not invent one. If product policy requires per-user Branch access, POS backend/AUTH-01 must expose an authoritative contract.

### DOMAIN_DECISION_REQUIRED

Whether authorized Cashiers may select every ACTIVE Selling Location returned for the tenant, or require narrower per-user Branch grants, remains a backend/product decision. This does not block approval of the F1 frontend boundary.

### CROSS_SERVICE_CONTRACT

None. Cashier does not call Digvation CORE directly.

## State ownership

```text
runtime/config        RuntimeProvider
identity boundary     AuthPort
server Sale state     TanStack Query
selected Branch       Cashier session context
active Sale identity  route/navigation context only
recent Sale ids       session-local navigation aid only
money authority       POS backend decimal-string snapshots
```

No Zustand/Redux Sale mirror, offline write queue, client subtotal engine, or app-to-app import is introduced.

## Accepted validation evidence

The validated F1 implementation head was:

```text
d60ee67e6856fc8dcffe730616cbb4805d3856a0
```

Frontend CI run #37 passed end-to-end:

```text
pnpm install --frozen-lockfile   PASS
contract lock check              PASS
repository naming check          PASS
Prettier                         PASS
ESLint                           PASS
TypeScript                       PASS
unit tests                       PASS — 10 tests
Cashier production build         PASS
Backoffice production build      PASS
Playwright F1 journeys           PASS — 5 tests
```

The browser journeys cover lazy Sale creation, first-line failure recovery, latest-version quantity/remove commands, conflict refetch/review without auto-replay, and Open Sales navigation without creating a new Sale.

## Version decision

Frontend Foundation was accepted at `0.1.0-alpha.1`.

F1 is the next meaningful accepted prerelease boundary, therefore this checkpoint advances the frontend prerelease to:

```text
0.1.0-alpha.2
```

The version increment records checkpoint acceptance; exact source identity remains the Git SHA/build revision.

## Post-approval rule

This checkpoint may now be prepared for integration into `dev`, but it must not silently continue into F2. F2 requires its own implementation scope, validation, review, and acceptance boundary.
