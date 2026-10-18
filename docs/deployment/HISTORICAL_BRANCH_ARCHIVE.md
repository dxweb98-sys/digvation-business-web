# Historical branch cleanup — recoverability

Only these long-lived branches are kept in the repository: `main`, `dev`, `dev-workshop`, `stage`, `stage-workshop`.

The one-time housekeeping workflow enumerates branch heads, and for every extra branch **first creates a tag** `archive/20261011/<old-branch-name>` referencing its exact SHA. It deletes a branch only after successful archival (or verification that an identical archival tag already exists). Protected branches cannot be forcibly deleted. Any failure makes the cleanup run red.

Archived tags are historical recovery points, **not** active development branches, CI targets, or deployment sources. GitHub pull requests tied to deleted branches may no longer be updateable; open PRs should be considered retired after this cleanup.

Recovery example (manual, only when specifically approved):

```bash
git fetch origin --tags
git switch -c restored-work <archive/20261011/old-branch-name>
```

Do not delete the archive tags as part of cleanup. This operation does not alter the five preserved branch heads.
