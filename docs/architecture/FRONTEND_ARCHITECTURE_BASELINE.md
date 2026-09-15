# Frontend Architecture Baseline

Digvation POS Web is one monorepo with two deployable React applications:

```text
Cashier
Backoffice
```

Core stack:

```text
React + TypeScript + Vite
React Router Data Mode
TanStack Query
Tailwind CSS / source-owned UI primitives
decimal.js
Zod
Vitest + Testing Library
MSW
Playwright
```

TanStack Query owns server-state caching. Do not create a second authoritative Sale/Payment store with Redux/Zustand/context.

Human-designed feature query/command boundaries wrap generated/raw transport. Screens do not call generated HTTP operations directly.

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

No transactional offline write queue is allowed.

Browser applications never call Digvation CORE directly. CORE-owned lifecycle/capability information reaches the browser through approved POS-local/runtime provisioning boundaries.

`Customer != LoyaltyMembership`. Guest sale remains valid.

`Sale != Fulfillment != Payment`.

Employee assignment is separate from contribution, and contribution is separate from commission/payroll.
