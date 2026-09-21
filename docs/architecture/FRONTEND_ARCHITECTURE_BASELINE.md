# Frontend Architecture Baseline

Digvation Business Web is one monorepo with two deployable React experiences:

```text
Backoffice
Operational
```

They are shared platform experiences. They are not separate source trees per business product.

Core stack:

```text
React + TypeScript + Vite
React Router
TanStack Query
@digvation/ui
Tailwind CSS
decimal.js through @digvation/business-money
Zod
Vitest + Testing Library
MSW
Playwright
```

## Architectural goal

Frontend Clean Architecture is a dependency and ownership discipline, not a requirement to reproduce backend folder layers in every component.

Prefer:

```text
APP COMPOSITION
    |
    v
ROUTES
    |
    v
FEATURES / USER USE CASES
    |
    +------> PROVEN SHARED PACKAGES / APP SHARED PRIMITIVES
    |
    +------> QUERY / COMMAND ADAPTERS
    |
    v
UI COMPOSITION
```

The desired properties are:

- business vocabulary has one clear owner;
- server state is not duplicated into another global store;
- feature-local draft state stays local to the feature;
- Backoffice and Operational do not import each other's application internals;
- truly reusable cross-app behavior is promoted to a deliberately owned package;
- optional product/capability source code does not make that capability visible or authorized;
- Runtime remains authoritative for business, monetary, entitlement, and authorization outcomes.

## Source ownership

### Application-local code

Each deployable application owns its application composition:

```text
apps/backoffice/src/
  app/
  routes/
  features/
  shared/

apps/operational/src/
  app/
  routes/
  features/
  shared/
```

The application-local `shared/` area means reusable only inside that application.

Application-local shared code must not be imported by the other deployable application.

### Cross-application code

Code intentionally reused by Backoffice and Operational belongs under a narrowly owned workspace package:

```text
packages/
  api/
  auth/
  money/
  runtime/
  testing/
```

Do not create a generic `packages/shared`, `packages/common`, or `packages/utils` dumping ground.

Promote code to a package only when:

1. at least two legitimate consumers need the same responsibility, or the responsibility is already a canonical shared business foundation;
2. the behavior has stable ownership;
3. the package can expose a narrow public contract;
4. promotion removes duplication without coupling one application to another.

Use:

```text
REUSE -> EXTEND -> PROMOTE -> NEW
```

Do not promote feature-specific React state merely because it could theoretically be reused later.

## Product and capability composition

Source-code presence is not capability authority.

Visible functionality is composed from effective runtime context:

```text
Visible Capability
=
Client Entitlement
INTERSECT Runtime Capability
INTERSECT User Permission
INTERSECT Location / Operational Context
```

A feature may exist in the repository while being unavailable to a client.

Therefore:

- do not branch on client name;
- do not branch on business type as authorization;
- do not infer capability from whether a component exists;
- do not make one giant Catalog form containing every optional future capability;
- optional sections are composed only when the owning capability is effectively available and permitted.

Example:

```text
Catalog Item Editor
  + Catalog foundation fields
  + Pricing section when pricing is available/permitted
  + Loyalty section when LOYALTY_POINTS is entitled and permitted
  + future Inventory extension only when its own capability is active
```

Catalog remains the authority for reusable catalog identity/classification semantics. Loyalty may reference a Catalog item, but Loyalty remains the authority for loyalty rules and ledger behavior.

## Feature structure

Large user use cases should be organized by feature responsibility rather than by generic technical buckets.

Reference shape:

```text
features/
  catalog/
    api/
      catalog-api.ts
    localization/
      ...
    model/
      ...
    ui/
      catalog-page.tsx
      ...
    item-editor/
      model/
        catalog-item-editor-state.ts
        catalog-item-editor-reducer.ts
        catalog-item-editor-validation.ts
        catalog-item-editor-mapper.ts
        use-catalog-item-editor.ts
      api/
        use-catalog-item-editor-data.ts
      ui/
        catalog-item-dialog.tsx
        ...
```

Segments mean:

- `model/` — feature-local state, reducer, view-model derivation, validation, and orchestration helpers;
- `api/` — feature query/command bindings when the feature needs them;
- `ui/` — React presentation and composition;
- `lib/` — feature-private pure helpers that do not have a better owner.

Do not create empty segments merely for symmetry.

Avoid broad folders such as:

```text
components/
hooks/
types/
utils/
helpers/
misc/
```

when those names hide feature ownership. Small local folders may use them when responsibility remains obvious, but they are not the default architecture.

## Current Backoffice reference layout

The current Catalog refactor is the concrete reference for Backoffice feature ownership:

```text
apps/backoffice/src/
├── features/
│   └── catalog/
│       ├── api/
│       ├── model/
│       ├── localization/
│       ├── ui/
│       └── item-editor/
│           ├── api/
│           ├── model/
│           └── ui/
│
└── shared/
    ├── api/
    │   └── build-query-string.ts
    ├── forms/
    │   └── use-form-state.ts
    └── query/
        ├── use-list-query.ts
        └── use-pagination-state.ts
```

`apps/backoffice/src/modules/catalog` is no longer an accepted Catalog implementation path. New Catalog work belongs under `features/catalog`.

The shared files above are Backoffice-wide primitives and may be reused by any Backoffice feature when their semantics match. Their existence does not require every feature to use them.

## Reuse without speculative abstraction

Do not promote domain code across applications merely because two experiences happen to use similar vocabulary.

Prefer the smallest correct owner:

```text
feature-specific behavior
-> feature

reusable within one application
-> apps/<app>/src/shared/<concern>

proven reusable across applications
-> existing narrowly owned packages/* concern
```

Examples of appropriate application-level shared code:

- generic form-state helpers;
- backend-compatible limit/offset pagination helpers;
- generic list-query wrappers;
- query-string builders;
- application-wide localization primitives.

Examples that should stay feature-owned until real reuse is proven:

- Catalog Item Editor reducer;
- Catalog selling rules;
- Loyalty draft behavior;
- Promotion targeting state;
- Workforce attendance filters.

Do not create a new workspace package simply to avoid two similar-looking local types.

## State ownership

Use the smallest state owner that matches the responsibility.

### Server state

TanStack Query owns server-state caching.

Do not create a second authoritative Catalog, Sale, Payment, Loyalty, or other server-state store with Redux, Zustand, Context, or custom global state.

For ordinary entity/detail queries, use TanStack Query directly. Do not wrap `useQuery` only for visual consistency.

For collection endpoints that follow the Runtime `limit/offset` contract, application shared code may provide a small list-query/pagination primitive:

```text
UI page/pageSize
  -> shared pagination adapter
  -> backend limit/offset
  -> backend response stays unchanged
```

The shared wrapper must not invent another response contract or hide feature-specific filters.

### Local UI state

Use `useState` for small independent UI state, for example:

```ts
const [open, setOpen] = useState(false);
```

### Related form state

Related simple form values may use one typed state object.

Do not call a UI draft `payload` when it is not the actual API request contract.

### Complex editor state

Use a feature-specific reducer/custom hook when an editor has coordinated state transitions, async hydration, cross-field validation, multi-step state, or multiple persistence boundaries.

Conceptually:

```text
SERVER FACTS
    |
TanStack Query
    |
hydrate
    v
FEATURE EDITOR DRAFT
(useReducer/custom hook)
    |
validation / normalization
    |
command mapper
    v
RUNTIME API
```

Reducer actions should describe meaningful feature transitions where practical, for example:

```text
LOYALTY_HYDRATED
IMAGE_REMOVAL_REQUESTED
VARIANTS_HYDRATED
SAVING_CHANGED
```

Do not create a universal custom form framework merely to replace React's `useState` or `useReducer`.

## API payload boundary

UI/editor state is not automatically the API DTO.

Normalize and map at the submit/command boundary:

```text
UI input
  -> feature draft
  -> validation
  -> normalization/mapping
  -> API command
```

This prevents transport contracts from becoming the shape of every input component.

## React component responsibility

Large screens/dialogs should compose readable sections.

A page/dialog component should primarily reveal the user experience structure. Move coordinated state and non-trivial derivation into feature model code, and split large presentation sections when that improves ownership.

Avoid components that simultaneously own:

- many unrelated `useState` values;
- server queries;
- complex hydration;
- validation policy;
- several API commands;
- cross-capability persistence;
- hundreds of lines of presentation markup.

There is no mandatory line-count rule, but file size is a signal. Split by responsibility, not merely by line count.

## Runtime authority

Human-designed query/command boundaries wrap raw transport.

Frontend business flow follows:

```text
SERVER FACT
-> CENTRALIZED POLICY / VIEW MODEL
-> ACTION AVAILABILITY
-> PRESENTATION
-> USER INTENT
-> COMMAND
-> SERVER
```

Browser applications never call Digvation CORE directly. Effective product/capability context reaches them through approved Runtime/session contracts.

Frontend previews may aid the user but must not become authoritative business or monetary calculation.

No transactional offline write queue is allowed unless explicitly introduced by a later durable architecture decision.

## Incremental migration

Architectural cleanup must not require a big-bang rewrite.

Prefer compatibility-preserving migration:

```text
existing public import
  -> compatibility facade/re-export
  -> new owned implementation
  -> migrate consumers
  -> validate
  -> remove obsolete facade when no longer needed
```

During architecture refactors, preserve existing routes, API contracts, capability gates, permissions, query behavior, and user flow unless the work unit explicitly changes them.
