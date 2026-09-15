# Digvation POS Web

Frontend product workspace for the Digvation white-label POS platform.

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

- `apps/cashier` — operational cashier experience.
- `apps/backoffice` — management/configuration experience.

Both applications are independently deployable and consume deliberate shared packages from `packages/*`; they never import each other's internals.

A future approved application is added under `apps/<application-name>` without restructuring existing applications.

## Authentication during early frontend development

Production POS AUTH-01 is still implemented in the backend track. Frontend Foundation therefore uses the approved `AuthPort` with a development-only `MockAuthAdapter`. Business screens do not know token storage or transport mechanics.

When AUTH-01 is accepted, `MockAuthAdapter` is replaced by the production adapter without redesigning business screens.

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
```

Run Cashier and Backoffice together for review:

```bash
pnpm dev
```

Default local URLs:

```text
Cashier    http://localhost:5173
Backoffice http://localhost:5174
```

Run only one app when needed:

```bash
pnpm dev:cashier
pnpm dev:backoffice
```

Build everything, then preview both production builds:

```bash
pnpm build
pnpm preview
```

Preview ports:

```text
Cashier    http://localhost:4173
Backoffice http://localhost:4174
```

## Product boundary

Digvation POS remains a domain-neutral, tenant-aware, white-label transactional product. Runtime differences are configuration/capability driven. Client-specific source forks and business-type conditionals are forbidden.

Deployment topology and branding are separate concerns:

```text
Deployment Profile
├── SHARED                # shared / SaaS infrastructure
├── BUSINESS_ISOLATED
└── DEDICATED

Branding Mode
├── DIGVATION_DEFAULT
└── WHITE_LABEL
```

Runtime application availability can disable Cashier or Backoffice for a workspace. Production deployments should additionally avoid publishing/routing app artifacts that the customer does not use.

Branding can provide product, company, business, and logo identity. Theme configuration can override semantic colors and approved shape tokens without forking application source.

The Digvation default is light-first: white/off-white surfaces with controlled Yellow, Mint, Sky, Lavender, and Coral accent tokens. Standard Digvation UI uses those accents individually; it does not combine them into rainbow or spectrum gradients.

See `docs/architecture/FRONTEND_RUNTIME_BRANDING_AND_APP_TOPOLOGY.md`.

## Branch terminology

The backend contract may continue to call the domain concept `Selling Location`. Operator-facing UI uses **Branch / Cabang**.

When branch integration is implemented, one permitted branch may auto-select; multiple permitted branches use a selector/dropdown. Switching branch must never move an existing Sale.

## Backend compatibility

Current locked backend transactional baseline:

```text
Digvation POS backend v0.3.0
SHA d58327fa17322d1a98049d842f43742635e744f7
```

AUTH-01 specification baseline:

```text
SHA 9008e605b96660b5183e937b1b15088d5f6faa27
target backend release v0.4.0 after approval
```

See `contracts/contract-lock.json` and `docs/integration/FRONTEND_BACKEND_RECONCILIATION_STANDARD.md`.
