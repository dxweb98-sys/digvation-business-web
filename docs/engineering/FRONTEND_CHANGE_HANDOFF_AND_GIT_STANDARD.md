# Manual Change, Commit & Merge Standard

## Branches

```text
main        release/stable
dev         accepted checkpoint integration
feat/*      feature/checkpoint work
fix/*       bounded bug fixes
refactor/*  behavior-preserving refactors
chore/*     tooling/repository maintenance
```

Do not implement directly on `main` or `dev`.

## Manual change handoff

When manual changes are pushed, provide:

```text
repository
branch
latest SHA
summary of manual changes
reason
```

When changes are not pushed, provide:

```bash
git status --short --branch
git log --oneline --decorate -10
git diff --stat
git diff
git diff --cached
```

For large uncommitted changes, a binary-safe patch is preferred.

## Review-candidate validation

For a completed page, feature, or source/tooling change, run `pnpm verify` and `pnpm test:e2e` once before a merge recommendation. During implementation, use targeted checks and the relevant app dev server instead of repeating the full gate after each edit.

For documentation-only changes, report the Markdown/static-reference validation performed. Do not represent browser or E2E acceptance as completed when it was not required or run.

## Review decisions

Every handoff returns one merge decision:

```text
READY_FOR_DEV_MERGE
REMEDIATION_REQUIRED
DO_NOT_MERGE
READY_FOR_RELEASE_PR
```

And one version impact:

```text
NONE
PRERELEASE_INCREMENT
PATCH
MINOR
MAJOR
```

Working branches normally squash-merge into `dev`. `dev -> main` happens only through a release PR after acceptance.
