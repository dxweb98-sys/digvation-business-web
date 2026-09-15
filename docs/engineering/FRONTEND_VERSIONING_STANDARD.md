# Frontend Versioning Standard

Digvation POS Web uses Semantic Versioning with prerelease lifecycle.

```text
0.1.0-alpha.1
-> 0.1.0-beta.1
-> 0.1.0-rc.1
-> 0.1.0
```

A Git commit does not automatically increment SemVer. Exact source identity is the Git SHA/build revision.

## Deployable application ownership

Cashier and Backoffice are independently deployable applications and may version independently. Their application versions are owned by `apps/cashier/package.json` and `apps/backoffice/package.json` respectively.

The root workspace `package.json` version identifies workspace/package-management metadata. It does not force a shared Cashier/Backoffice runtime version and must not be bumped merely because one application version changes. Documentation-only, test-only, and repository-maintenance changes normally have version impact `NONE`.

Before stable `1.0.0`:

- `alpha`: architecture/foundation and incomplete product flows;
- `beta`: usable product flow with remaining product/hardening gaps;
- `rc`: release candidate, feature-complete for the intended release;
- stable: accepted production release.

After stable release:

- PATCH: compatible fixes/security/UX correction;
- MINOR: backward-compatible product capability;
- MAJOR: intentional breaking product/application contract.

Frontend/backend versions are independent. A frontend application release is reconciled against the supported backend release and SHA in `contracts/contract-lock.json`; lock entries are updated only from approved, verified backend facts.

Frontend Foundation was accepted at `0.1.0-alpha.1`. Subsequent prerelease increments occur only when the next meaningful checkpoint or release boundary is accepted.
