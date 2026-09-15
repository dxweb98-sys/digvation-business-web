# Frontend Engineering Consistency Standard

## Naming

- directories: `kebab-case`
- source files: `kebab-case`
- React components/types: `PascalCase`
- variables/functions/hooks: `camelCase`
- hooks start with `use`
- boolean variables prefer `is`, `has`, `can`, or `should`
- ports end with `Port`
- adapters end with `Adapter`
- schemas end with `.schema.ts`
- tests end with `.test.ts` / `.test.tsx`

Avoid generic dumping grounds such as `misc`, `stuff`, or broad unowned `helpers`.

## Ownership

Feature-specific code stays close to its feature. A shared package is created only for stable reuse across application/feature boundaries.

`apps/cashier` and `apps/backoffice` are separate deployable application owners. They may depend on deliberate packages under `packages/`, but must not import each other's application internals. Do not move feature code into a generic shared location merely for visual symmetry; promote it only when stable cross-application ownership is proven.

Authoritative Sale/Payment business state must never be copied into a global client store.

## Components

Presentation components receive view models, action availability, and callbacks. They do not fetch domain data, calculate authoritative money, or decide backend policy.

## Money

Business monetary calculations use `decimal.js` through `@digvation/pos-money`. JavaScript `number` must not become business monetary authority.

## White-label

Do not branch on client name or business type. Branding is runtime presentation configuration; deployment topology is a separate runtime/infrastructure concern. Neither concern authorizes client-specific source branches or client-specific application logic.
