# Digvation Production Release Contract — Main-Origin

1. Merge approved feature branches into dev (Runtime and Web); both CI gates must pass.
2. Open dev -> stage pull requests. Stage builds staging images, but deploying staging with dgvctl is optional. Test and approve.
3. Promote the **approved code** from stage -> main using PR review. Production artifacts are **rebuilt from each repo's main commit**; staging images or stage digests are never promoted.
4. Wait for main push CI and release-validation to succeed in both repositories. Run the **Publish Production** workflow in **both repos** on main using the **same SemVer**. A release produces immutable digest references in the versioned GitHub release manifests; immutable_ref is authoritative (not the tag).
5. Register a single dgvctl release version with the exact Runtime and Web manifests/digests (Runtime production/migration/operations/first-install commands; Web Backoffice/Operational/Member Portal). Refuse missing/mismatched versions or source_branch != main.
6. Before each client update record the installed version/image digest set, verify a PostgreSQL database backup, and perform migration compatibility checks. Update the full stack together, then health-check Runtime readiness, authenticated endpoint, all published Web surfaces, and business transaction smoke.
7. On failure, pin and redeploy the previous COMPLETE release manifest for **all containers**, not selected services (e.g. v1.3.2 -> v1.3.1). Database schema backward compatibility is required for code-only rollback. If migration is destructive/incompatible, stop and invoke a reviewed recovery plan based on verified pre-upgrade backup; never automatically overwrite customer writes with a blind restore.
8. Record operation status, version/digests, backup path, migration and health-check evidence, and rollback outcome. No automatic production deployment on main merge.

**dgvctl migration required:** current server tooling must accept main-origin production GHCR digest manifests rather than staged/promoted image registry entries. This repository cannot by itself change the installed dgvctl binary or release registry on the server.

**Release policy:** production publisher is manual and refuses publication unless same-SHA main CI and release validation pass. The approved release version is independent of branch names and binds both repositories.
