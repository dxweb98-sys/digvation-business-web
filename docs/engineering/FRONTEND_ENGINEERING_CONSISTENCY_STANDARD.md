# Frontend Engineering Consistency Standard

## Naming

- directories: `kebab-case`;
- source files: `kebab-case`;
- React components/types: `PascalCase`;
- variables/functions/hooks: `camelCase`;
- hooks start with `use`;
- boolean variables prefer `is`, `has`, `can`, or `should`;
- ports end with `Port`;
- adapters end with `Adapter`;
- schemas end with `.schema.ts`;
- tests end with `.test.ts` / `.test.tsx`.

Names must reveal responsibility. Avoid vague `Manager`, `Helper`, `Utils`, `Common`, `Misc`, or `Shared` names that collect unrelated behavior.

## Ownership

Frontend ownership order:

```text
application composition
-> route
-> feature/use case
-> stable cross-app package
-> transport/platform package
```

Feature-specific code stays close to its feature.

`apps/backoffice` and `apps/operational` are separate deployable application owners. They must not import each other's application internals.

Application-local reuse may live under that application's `src/shared`, but it is not cross-app shared code.

Truly reusable Backoffice + Operational behavior belongs in a narrowly owned workspace package under `packages/`.

Do not create a generic `packages/shared`, `packages/common`, or `packages/utils`.

A shared package is created only for stable ownership and legitimate reuse, not for visual symmetry.

## Product and capability awareness

Source-code presence never grants a product, capability, permission, or location scope.

Optional feature UI must be gated by effective runtime/session authority.

Use the effective composition:

```text
entitlement
INTERSECT runtime capability
INTERSECT permission
INTERSECT location/operational context
```

Do not:

- hard-code client names;
- infer access from business type;
- show optional capability sections because their component exists;
- collapse optional capabilities into Catalog or another shared foundation.

Capability-specific behavior remains owned by that capability even when composed into another feature's UI.

## Reuse

Use:

```text
REUSE -> EXTEND -> PROMOTE -> NEW
```

Before adding reusable code:

1. identify the current owner;
2. reuse an existing implementation when responsibility matches;
3. extend the current owner when behavior belongs there;
4. promote to a cross-app package only when ownership and reuse are proven;
5. create a new abstraction only for a real boundary.

Do not build speculative generic form/state abstractions.

A reusable function should have one coherent purpose and an ownership-compatible home.

Examples:

- HTTP/query-string transport helper -> `packages/api`;
- decimal/money primitive -> `packages/money`;
- stable Catalog vocabulary/pure selling interpretation -> `packages/catalog`;
- Catalog Item Editor reducer -> Backoffice Catalog editor feature, not a cross-app package.

## Feature structure

For large features, prefer responsibility-oriented segments:

```text
features/<feature>/
  model/
  api/
  ui/
  lib/
```

Create only the segments the feature actually needs.

`model/` may contain:

- typed draft state;
- reducer;
- derived view state;
- validation;
- command/input mapping;
- feature controller hook.

`api/` may contain:

- feature-specific query hooks;
- command hooks;
- query keys;
- adapters around lower-level API clients.

`ui/` contains React presentation and composition.

`lib/` contains feature-private pure helpers.

## State management

### useState

Use `useState` for small, independent local state.

### Related form state

Group values that form one coherent draft.

Do not combine unrelated server facts, UI flags, mutable refs, and API request DTOs into one giant object simply to reduce the number of hooks.

### useReducer

Prefer `useReducer` plus a feature-specific hook when state has coordinated transitions or several of:

- many related fields;
- cross-field resets;
- server hydration;
- dirty/touched state;
- multi-step flow;
- non-trivial validation;
- multiple save boundaries;
- complex transition rules.

Actions should communicate intent rather than exposing arbitrary object mutation when meaningful actions exist.

### useRef

Use refs for mutable values that should not trigger rendering, including one-time hydration guards or immutable editor snapshots where appropriate.

### Derived state

Do not store values that can be safely derived from authoritative inputs.

Prefer calculation or memoization over synchronized duplicate state.

## Server state

TanStack Query owns asynchronous server state.

Do not mirror authoritative server collections into Redux/Zustand/Context merely for reuse.

Feature editor draft state may be hydrated from query results, but the draft is temporary user input, not a second authoritative server cache.

## API and commands

Raw transport should not dictate component structure.

Keep a clear boundary:

```text
feature draft
-> validate
-> normalize/map
-> command DTO
-> API
```

Do not name draft state `payload` unless it is actually the API payload.

Transport/API classes should remain coherent. Split large clients by responsibility when they become broad facades, while compatibility facades may be retained temporarily during incremental migration.

## Components

Presentation components receive view state, action availability, and callbacks.

They do not:

- own authoritative server or financial truth;
- duplicate Runtime policy;
- infer capability entitlement;
- perform backend-only monetary rules;
- silently create another business authority.

Large page/dialog files should be split by coherent presentation responsibility after state/orchestration boundaries are clear.

Do not extract tiny components solely to reduce line count.

## Money

Business monetary calculations use `decimal.js` through `@digvation/business-money`.

JavaScript `number` must not become business monetary authority.

Display/input parsing helpers are not permission to duplicate Runtime monetary policy.

## Design System

`@digvation/ui` is the canonical reusable UI primitive layer.

Application code owns composition and feature behavior, not duplicate generic buttons, inputs, tables, dialogs, or design tokens already provided by the Design System.

Feature-specific components remain with their owning feature.

## Compatibility-preserving refactors

Architecture refactors should be incremental.

Allowed migration technique:

```text
old import path
-> thin re-export compatibility facade
-> new owned implementation
```

Remove the facade after consumers have migrated and validation proves it is no longer required.

Do not change route behavior, API payloads, permission semantics, capability visibility, or user flow merely as a side effect of a structural refactor.

## White-label

Do not branch on client name or business type.

Branding is runtime presentation configuration; deployment topology is a separate runtime/infrastructure concern.

Neither concern authorizes client-specific source branches or client-specific application logic.

## Reference implementation

The Backoffice Catalog Item Editor is the first reference implementation for this structure.

Future large editor/form refactors should reuse its architectural principles, not blindly copy every file. Adapt the pattern to the actual domain/use case and promote only truly reusable behavior to the correct `packages/*` owner.
