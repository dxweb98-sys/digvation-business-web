# Frontend Local Acceptance

## Required sequence

For a checkpoint handoff:

```text
install
-> contract check
-> naming check
-> format check
-> lint
-> typecheck
-> unit/integration tests
-> production build
-> browser smoke
```

Canonical command:

```bash
pnpm verify
pnpm test:e2e
```

## Verification cadence

During the normal coding loop, use targeted Vitest checks and the relevant Vite dev server when they provide useful feedback. Do not run the full `pnpm verify` and `pnpm test:e2e` sequence after every small edit.

Run the complete sequence once when a completed page, feature, or source/tooling change is ready as a review candidate and before recommending a merge. If relevant source or tooling changes during remediation, rerun the affected targeted checks and run the complete sequence again only at the renewed review-candidate boundary.

For documentation-only changes, validate changed Markdown/static references. Browser/E2E validation is not required unless documentation changes tooling or runtime behavior.

## Initial dependency lock

The first Frontend Foundation CI run intentionally permits `pnpm install --no-frozen-lockfile` because this execution environment cannot reach the npm registry and therefore cannot produce the initial `pnpm-lock.yaml` locally.

Frontend Foundation must not be marked accepted until a real package install has generated and committed `pnpm-lock.yaml`; after that, CI must switch to `pnpm install --frozen-lockfile`.

This is an explicit acceptance item, not a permanent exception.
