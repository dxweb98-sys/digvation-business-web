# Cashier Transaction Core

## Status

IMPLEMENTATION IN PROGRESS

## Accepted base

```text
Frontend baseline: Cashier Transaction Foundation
Frontend version: 0.1.0-alpha.2
Accepted dev SHA: 4779e313c3b8ffa266a1c01254ebaec9b61e5db4
POS backend: v0.3.0
POS backend SHA: d58327fa17322d1a98049d842f43742635e744f7
```

AUTH-01 is still separate. This checkpoint continues to consume `AuthPort` through the development `MockAuthAdapter`; it does not invent production token/session behavior.

## Objective

Turn the accepted Cashier Transaction Foundation into a usable transaction-core Cashier workflow while preserving the backend invariant:

```text
Sale != Fulfillment != Payment
```

The frontend orchestrates operator tasks; the POS backend remains authoritative for Sale lifecycle, optimistic version, settlement, fulfillment, contribution, captured price/discount/tax, and all monetary facts.

## In scope

- line price override and removal;
- LINE and ORDER discount set/removal;
- ACTIVE employee lookup for current transaction tasks;
- line employee assignment;
- line employee contribution configuration using backend-supported equal and partial explicit share semantics;
- contribution preview returned by the backend;
- tracked line fulfillment transitions;
- split/multiple payments;
- CASH tender/change flow;
- BANK_TRANSFER, WALLET and QRIS pending payment flow without fake provider SDK/countdown;
- explicit pending-payment terminal transitions supported by backend v0.3.0;
- top-up payment after an OPEN Sale increases when settlement rules permit;
- separate paid, pending and available-to-pay presentation;
- completion workspace/dialog that may be opened before a Sale is ready;
- domain readiness vs execution readiness;
- exact-settlement finalization;
- unpaid OPEN Sale void;
- optimistic conflict handling with refetch + explicit review and no automatic business-command replay;
- no transactional offline writes or mutation queue;
- unit/browser journeys for transaction-core invariants.

## Explicitly out of scope

- Refund/Reversal or chargeback;
- Receipt/PDF or official human transaction number;
- full Sales Reporting;
- Customer/CRM persistence;
- Loyalty/Membership;
- cash drawer/shift/till reconciliation;
- booking/scheduling;
- inventory/COGS;
- payroll/commission payout;
- payment provider SDK/webhook integration;
- offline transactional replication;
- production AUTH-01 integration;
- CORE calls from the browser.

## Locked UX rules

The main Cashier remains a selling workspace, not a wizard.

```text
Selling Catalog -> Current Sale -> Sale Completion
```

Sale Completion is a large task workspace/dialog, not a separate payment-only page. Payment completion does not imply Sale completion when tracked fulfillment remains incomplete.

Service-line operational tasks remain separate from monetary Sale state. Assignment is not contribution. Contribution is not commission/payroll.

Payment summary uses:

```text
Paid
Pending
Available to pay
```

not a generic `Remaining` label.

## Backend contract classification

### EXISTING_BACKEND_CONTRACT

Backend `v0.3.0` already provides:

- `GET /employees`;
- price override and line/order discount commands;
- line assignment and contribution commands;
- contribution preview;
- tracked fulfillment transition;
- create/list/read Payment;
- pending Payment terminal transition;
- Sale finalize;
- Sale void;
- expectedVersion on aggregate mutations;
- idempotency for Payment/finalize/void;
- full Sale aggregate containing line fulfillment/participations/contributions and Payment attempts.

### POS_BACKEND_GAP

Existing accepted gaps remain open:

- cashier selling catalog projection;
- priced catalog projection;
- lightweight Open Sales projection;
- POS-local runtime/capability bootstrap;
- human-friendly Sale reference;
- atomic transaction start.

Contribution semantics remain tracked by GAP-07; the frontend follows the behavior exposed by backend v0.3.0 and does not reinterpret contribution as payroll/commission.

### DOMAIN_DECISION_REQUIRED

Per-user Branch grants remain unresolved. The frontend continues to present ACTIVE Selling Locations returned by the trusted POS backend context.

### CROSS_SERVICE_CONTRACT

None.

## Readiness model

Domain readiness is derived from authoritative Sale facts and is advisory to the operator. Backend finalization remains final authority.

Expected blockers include:

- no active lines;
- pending payment;
- available-to-pay not zero;
- tracked line not COMPLETED;
- required assignment missing;
- contribution configuration invalid/missing where captured line semantics require it.

Execution readiness separately covers:

- offline state;
- command in progress;
- conflict/uncertain-command review.

## Version recommendation

Keep `0.1.0-alpha.2` during implementation and review.

If this checkpoint becomes the first usable end-to-end transaction core, recommend:

```text
0.1.0-beta.1
```

Do not bump before explicit checkpoint approval.
