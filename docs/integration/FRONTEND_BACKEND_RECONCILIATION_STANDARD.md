# Frontend ↔ Backend Reconciliation Standard

Every approved frontend capability is classified against the backend:

```text
FRONTEND_ONLY
EXISTING_BACKEND_CONTRACT
POS_BACKEND_GAP
CROSS_SERVICE_CONTRACT
DOMAIN_DECISION_REQUIRED
```

Frontend must never invent backend business authority to hide a missing contract.

When backend changes, compare its approved release/SHA/OpenAPI behavior against the locked frontend behavior and return one result:

```text
NO_FRONTEND_CHANGE
ADAPTER_CHANGE_ONLY
FRONTEND_CONTRACT_UPDATE_REQUIRED
BACKEND_CHANGE_CONFLICTS_WITH_LOCKED_FRONTEND_REQUIREMENT
```

Approved presentation/UX should remain stable when a change can be isolated in transport, adapter, query, command, or view-model layers.

Known backend gaps are recorded and closed only after backend implementation is accepted and the frontend adapter is migrated/verified.
