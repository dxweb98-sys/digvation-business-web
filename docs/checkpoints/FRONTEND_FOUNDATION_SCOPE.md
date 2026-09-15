# Frontend Foundation Scope

## Objective

Create the production-grade frontend foundation without implementing transactional business workflow.

## In scope

- pnpm workspace multi-app monorepo;
- Cashier and Backoffice independently deployable apps;
- React/TypeScript/Vite/React Router;
- TanStack Query provider;
- semantic design tokens and source-owned UI primitives;
- light-first Digvation default presentation with controlled multi-color accents;
- runtime configuration, application availability, branding, theme, and capability boundaries;
- fixed application shell where header/sidebar stay stationary and only content scrolls;
- `AuthPort` + development `MockAuthAdapter`;
- API envelope/client/error boundary;
- decimal-safe money package;
- MSW/Vitest/Testing Library/Playwright infrastructure;
- contract lock against POS backend `v0.3.0`;
- naming/versioning/Git/backend-reconciliation documentation;
- root review commands for running both applications together;
- CI verification.

## Explicitly out of scope

- real Sale/SaleLine workflow;
- Payment;
- Fulfillment;
- employee assignment/contribution;
- real Branch/Selling Location query and selector behavior;
- Customer/Loyalty persistence;
- production AUTH-01 integration;
- Backoffice CRUD;
- fake analytics/dashboard data;
- Refund/Receipt/Reporting;
- arbitrary client CSS injection;
- client-specific application source forks.

## Acceptance

Frontend Foundation is accepted only after:

- deterministic dependency lock exists;
- clean install succeeds;
- contract/naming/format/lint/typecheck/tests pass;
- Cashier and Backoffice production builds pass;
- Cashier browser smoke passes;
- Cashier and Backoffice can run together without port collision;
- header/sidebar remain outside the content scroll container;
- Digvation default is light-first and uses approved accent tokens;
- runtime branding/theme can be changed without source edits;
- a disabled runtime application refuses to bootstrap;
- mock auth cannot leak token concerns into screens;
- no business-type/client conditionals;
- no business-state global store;
- documentation reflects actual repository structure.

Accepted prerelease: `0.1.0-alpha.1`.
