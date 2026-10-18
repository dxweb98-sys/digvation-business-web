# Frontend Runtime Branding and App Topology

## Purpose

Define how Digvation Business Web supports shared, isolated, and dedicated deployments, white-label presentation, multiple applications, and authenticated business composition without creating browser-side business authority or client-specific source forks.

## Repository topology

This repository is a **multi-app monorepo**.

```text
apps/
  operational/
  backoffice/

packages/
  api/
  auth/
  runtime/
  money/
  ui/
  testing/
```

Operational and Backoffice are independently deployable applications. They may share deliberate packages, but they must never import each other's application internals.

A future application is added as a new `apps/<application-name>` workspace only after its product scope is approved. Adding an application must not require restructuring existing applications.

This architecture is not a single monolithic frontend application and is not a microfrontend architecture.

## Three authority boundaries

Frontend startup and authenticated composition use three distinct authorities. They must not be collapsed into one browser configuration object.

### 1. Deployment bootstrap

Deployment bootstrap is static, pre-authentication configuration. It may contain only information required to reach and present the application before an authenticated business context exists:

- API origin (`apiBaseUrl`), including empty-string same-origin mode;
- deployment profile metadata;
- workspace resolution needed by login;
- application shell availability;
- branding and theme fallback;
- locale and country fallback defaults.

Deployment bootstrap is **not** authority for:

- tenant/business identity;
- business currency;
- products or capabilities;
- foundations;
- user permissions;
- authenticated business preferences.

A deployment profile or white-label setting must never imply entitlement or authorization.

### 2. Authenticated session context

After authentication, the canonical browser composition contract is:

```text
GET /api/v1/session/context
```

Business Runtime projects the effective authenticated context as one coherent response containing:

- lightweight identity and role identity;
- tenant/business identity and Runtime-owned currency;
- effective products, capabilities, foundations, and permissions;
- effective locale, timezone, date format, and time format;
- deployment profile metadata;
- deterministic `contextVersion` for the effective context.

`access.permissions` is already the Runtime projection of the actor's grants intersected with effective product, capability, and foundation availability. Web consumers must not recreate that intersection from raw role permissions.

`GET /api/v1/runtime/context` is a compatibility alias during migration and must not become a second frontend authority. `GET /api/v1/auth/me` remains an identity-oriented endpoint and must not be used to reconstruct the full application context.

Token rotation and authenticated-context refresh are separate concerns. Refreshing an access token does not by itself authorize Web to invent or retain stale business context; when application context must be refreshed, Web requests the canonical session context again.

### 3. Domain APIs

Authenticated session context governs application composition and access projection. It is **not** canonical Sale, Payment, Catalog, Stock, Work Order, Finance, or other domain state.

Domain facts and commands remain owned by their corresponding Runtime/domain API. TanStack Query and feature adapters may cache/project those server facts for presentation, but the browser must not promote session context or deployment bootstrap into a second domain store.

The flow remains:

```text
DEPLOYMENT BOOTSTRAP
-> AUTHENTICATION
-> SESSION CONTEXT
-> AUTHORIZED DOMAIN API
-> POLICY / VIEW MODEL
-> PRESENTATION
-> USER INTENT
-> DOMAIN COMMAND
-> SERVER
```

## Deployment and branding are independent

Deployment topology describes where the product runs:

```text
SHARED
BUSINESS_ISOLATED
DEDICATED
```

`SHARED` represents the shared/SaaS infrastructure model.

Branding mode describes whose presentation identity is used:

```text
DIGVATION_DEFAULT
WHITE_LABEL
```

Valid combinations include:

- SHARED + DIGVATION_DEFAULT;
- SHARED + WHITE_LABEL;
- BUSINESS_ISOLATED + WHITE_LABEL;
- DEDICATED + DIGVATION_DEFAULT;
- DEDICATED + WHITE_LABEL.

Never encode white-labeling as a deployment profile.

## Application availability

Deployment bootstrap contains explicit shell availability for Operational and Backoffice.

A shell may be disabled for a deployment even though its source remains in the repository. A disabled application must refuse to bootstrap.

This is deployment topology, not business authorization. Post-authentication feature availability still comes from the effective session context and the owning domain APIs.

For production, the stronger deployment rule is to not publish or route an application artifact that the customer must not use. Runtime disabling is defense in depth, not a replacement for backend authorization.

CI continues to build and test all product applications so disabled deployments cannot allow unused application code to decay.

## Branding configuration

Deployment branding may configure presentation fallback such as:

- product name;
- company name;
- logo URL;
- branding mode.

Authenticated business name comes from the session context and must not be duplicated as deployment bootstrap authority.

No client name, salon name, business type, or white-label identity may be hardcoded in application source.

## Theme configuration

The default Digvation presentation is light-first.

Default surfaces use white/off-white with dark navy text. Digvation identity is expressed through a controlled multi-color accent palette:

- Yellow `#F8E85D`;
- Mint `#BFE4D2`;
- Sky `#B9D8EF`;
- Lavender `#CEC4F5`;
- Coral `#F3A08B`.

Dark `#0B0D10`, Navy `#0F172A`, and Indigo `#121A2F` are anchors, not the default page background.

The accent colors are used individually and intentionally. Standard Digvation UI must not combine the palette into rainbow, spectrum, or multi-color gradients for identity bars, logo tiles, buttons, navigation, or other persistent chrome.

The deployment theme can override semantic tokens such as background, surface, text, border, brand, focus, and the five accent colors. Shape can be varied through the approved radius profile.

Theme customization changes presentation tokens without changing domain behavior, security, application ownership, entitlement, or API contracts.

Arbitrary client CSS injection is prohibited. A customer that requires a genuinely different layout or workflow must use an explicitly approved presentation/experience profile rather than a client-specific source fork.

## Branch terminology

The backend/domain concept remains **Selling Location** where that term is required by the POS contract.

The operator-facing product label is **Branch** / **Cabang**.

Expected Operational behavior when selling-location access is integrated:

- exactly one permitted branch: select it automatically;
- more than one permitted branch: show a Branch selector/dropdown;
- changing branch clears the active navigation context after confirmation when an Active Sale exists;
- changing branch never moves an existing Sale to another branch.

The frontend must not invent branch data before the backend query is connected.
