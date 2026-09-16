# Digvation Business Web

Frontend product workspace for Digvation Business, with independently deployable Operational and Backoffice applications.

## Repository status

Product implementation is performed from `dev` through capability-scoped working branches. `main` remains release/stable only.

Accepted frontend baseline:

```text
Cashier Transaction Foundation
0.1.0-alpha.2
```

## Branch model

```text
main
  ↑ release / stable only

dev
  ↑ accepted checkpoint integration

feat/* | fix/* | refactor/* | chore/*
  ↑ implementation work
```

## Application topology

This is a multi-app monorepo, not one monolithic frontend application and not a microfrontend architecture.

- `apps/operational` — live Operational execution experience, including the current POS selling implementation.
- `apps/backoffice` — management/configuration experience.

Both applications are independently deployable and consume deliberate shared packages from `packages/*`; they never import each other's internals.

A future approved application is added under `apps/<application-name>` only when the architecture actually requires another deployable application.

## Runtime authority

Browser bootstrap and authenticated business context are deliberately separate.

Before authentication, `runtime-config.json` is deployment bootstrap only. It provides API origin, deployment metadata, login workspace resolution, application shell availability, branding/theme fallback, and locale/country fallback defaults.

After authentication, the canonical application-composition contract is:

```text
GET /api/v1/session/context
```

The session context supplies identity, tenant/business identity, Runtime-owned currency, effective products/capabilities/foundations/permissions, effective business preferences, deployment metadata, and `contextVersion`.

The browser must not reconstruct effective authorization from role payloads or static runtime config. Domain data and commands remain owned by their corresponding Runtime/domain APIs.

`GET /api/v1/runtime/context` is compatibility-only during migration. `GET /api/v1/auth/me` is identity-oriented and is not the full application-context authority.

See `docs/architecture/FRONTEND_RUNTIME_BRANDING_AND_APP_TOPOLOGY.md`.

## Development

Requirements:

```text
Node.js 24.x
pnpm 11.x
```

Install:

```bash
corepack enable
pnpm install
```

Official validation before checkpoint handoff:

```bash
pnpm verify
pnpm test:e2e
```

Run Operational and Backoffice together for review:

```bash
pnpm dev
```

Default local URLs:

```text
Operational http://localhost:5173
Backoffice  http://localhost:5174
```

Run only one app when needed:

```bash
pnpm dev:cashier
pnpm dev:backoffice
```

The historical `dev:cashier` script name may remain until an explicit tooling rename is approved; it currently starts the Operational application.

Build everything, then preview both production builds:

```bash
pnpm build
pnpm preview
```

Preview ports:

```text
Operational http://localhost:4173
Backoffice  http://localhost:4174
```

## Product boundary

Digvation Business is tenant-aware and can support shared, isolated, or dedicated deployment and white-label presentation without client-specific source forks or business-type authorization conditionals.

Deployment topology and branding are separate concerns:

```text
Deployment Profile
├── SHARED
├── BUSINESS_ISOLATED
└── DEDICATED

Branding Mode
├── DIGVATION_DEFAULT
└── WHITE_LABEL
```

Deployment bootstrap may disable Operational or Backoffice at shell level. Production deployments should additionally avoid publishing/routing application artifacts that the customer does not use. This shell availability does not replace backend authorization or authenticated entitlement checks.

Branding can provide deployment presentation fallback such as product/company/logo identity. Authenticated business identity comes from session context. Theme configuration can override semantic colors and approved shape tokens without forking application source.

The Digvation default is light-first: white/off-white surfaces with controlled Yellow, Mint, Sky, Lavender, and Coral accent tokens. Standard Digvation UI uses those accents individually; it does not combine them into rainbow or spectrum gradients.

## Branch terminology

The backend contract may continue to call the domain concept `Selling Location`. Operator-facing UI uses **Branch / Cabang**.

When branch integration is implemented, one permitted branch may auto-select; multiple permitted branches use a selector/dropdown. Switching branch must never move an existing Sale.

## Backend compatibility

Current backend compatibility remains governed by `contracts/contract-lock.json` and the frontend/backend reconciliation standard. Historical names in locked records do not change current architecture ownership.

See `contracts/contract-lock.json` and `docs/integration/FRONTEND_BACKEND_RECONCILIATION_STANDARD.md`.
