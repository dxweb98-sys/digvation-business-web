# Frontend ↔ POS Backend Gap Register

This file records frontend-discovered backend contract needs. A gap is not authorization for the frontend track to modify the POS backend.

Status vocabulary:

```text
OPEN
ACCEPTED_DEFERRED
IMPLEMENTED_BACKEND
FRONTEND_MIGRATED
CLOSED
```

## GAP-01 — Cashier Selling Catalog Query

**Status:** OPEN

Current Cashier must compose generic category/item/variant endpoints. A production cashier read endpoint should return only sellable/current facts needed by the active Branch and avoid management-history semantics.

Temporary frontend seam: `SellingCatalogQuery`.

## GAP-02 — Priced Catalog Projection

**Status:** OPEN

`CatalogItem` does not contain resolved current selling price. Current frontend can call `GET /pricing/resolve`, but doing this per visible item creates N+1 request behavior.

Desired backend projection should provide cashier-display price while Add SaleLine remains the final price/tax authority.

Temporary frontend seam: `SellingCatalogQuery`.

## GAP-03 — Open Sale Operational Query

**Status:** OPEN

Current `GET /sales` returns full Sale aggregates and has only generic pagination. It is too heavy to become the permanent operational Open Sales queue and has no OPEN/location operational filters.

Desired projection should include lightweight Sale identity, location, lifecycle, monetary summary, payment/fulfillment attention facts, updatedAt, and human reference once available.

Temporary frontend seam: `OpenSalesQuery`.

## GAP-04 — Runtime / Capability Bootstrap

**Status:** OPEN

Current frontend loads `/runtime-config.json`. Browser must never call CORE directly. A future POS-local/runtime provisioning contract should supply authoritative runtime branding/capability facts where required.

## GAP-05 — Human-Friendly Sale Reference

**Status:** OPEN

Stable v0.3.0 exposes UUID Sale identity only. Frontend currently displays a shortened technical UUID strictly as a temporary visual locator and does not pretend it is an official receipt/transaction number.

## GAP-06 — Atomic Transaction Start

**Status:** ACCEPTED_DEFERRED

Stable contract requires Create Sale followed by Add SaleLine. If Create succeeds and Add fails, an empty OPEN Sale can remain.

Frontend recovery is locked: keep that exact Sale active; never auto-void it and never create a second Sale automatically.

A future backend atomic start command may remove this two-command gap if approved.

## GAP-07 — Contribution Semantics Clarification

**Status:** ACCEPTED_DEFERRED

Current runtime behavior effectively requires non-empty valid contribution when the captured line allows employee contribution. Resolve naming/optional semantics before contribution UI is treated as final product contract.

## GAP-08 — Customer Domain API

**Status:** OPEN

Customer/CRM production UI remains disabled until its backend domain/API checkpoint is approved.

## GAP-09 — Loyalty Membership Lookup API

**Status:** OPEN

Opaque membership-token lookup remains future backend scope. Loyalty is separate from Customer ownership.

## GAP-10 — Sale Customer Context Mutation

**Status:** OPEN

Future Sale customer/guest association must be an explicit versioned Sale contract. Frontend must not fake persistence.

## Branch authorization decision

**Classification:** DOMAIN_DECISION_REQUIRED

`GET /locations` is tenant-scoped and permission-gated but does not define per-user Branch grants. Until ownership decides otherwise, frontend only presents ACTIVE Selling Locations returned by the authenticated/trusted POS backend context and does not invent narrower grants.
