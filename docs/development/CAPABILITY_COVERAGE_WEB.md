# Batch A — Web capability & report coverage

Source authority: Runtime effective products, capabilities, foundations and permission projection. Web consumes `@digvation/business-auth` session selectors; it never grants entitlements locally.

- **Backoffice navigation:** `canAccessBackoffice('reports')` uses `REPORT_CATALOG` with `canAccessReport`, identical to the Reports selector. A dormant report permission (such as `settlements:read`) must not show a blank Reports page. POS report types still require POS and actual effective permission.
- **Dashboard:** basic business insights use current published projections and RBAC; `BUSINESS_ANALYTICS` legacy flag is not a new commercial paywall. Keep disabled finance/customer/workforce contributions out of API queries.
- **Report filter references:** tax-only readers may load the **Tax report**, but `/catalog/items` and `/catalog/categories` reference routes require `catalog:read`; do not fetch them with `tax:read` alone. Hide the two unavailable selectors rather than issuing known-403 requests.
- **Operational:** POS Product/Service, Membership/Loyalty, Promotions, Customer Identity, Workforce and Finance remain controlled by current effective session/permissions. No new Product/Service dependency or fake Inventory flag.
- **Current report set:** business-performance, transactions, catalog-performance, component-usage, product-commission, employee-performance, attendance, payments, expenses, cash, tax, locations.
- **Explicitly deferred:** DIG-47 single/multi-location direct-API hardening; DIG-84 BOM commercial entitlement; DIG-48 resource quota and Free plan; additional commercial flags for receipt WhatsApp, Member Portal, Split Payment and Bulk Import. These are not silently granted or denied by Batch A.

Paired Runtime branch: `feat/capability-registry-coverage`; canonical inventory and report authority evidence are documented in Runtime `docs/development/CAPABILITY_REGISTRY_COVERAGE.md`. No DB migration, permission registry expansion, stage/main changes or deployment.
