# Backend Contract

`contract-lock.json` pins the approved POS backend release/SHA consumed by this frontend.

The OpenAPI snapshot is deliberately not fabricated. The backend currently exposes `/openapi.json` at runtime; the snapshot and generated transport must be created from an approved backend runtime/export when that artifact becomes available.

Until then, `packages/api` provides the stable human-designed transport boundary only. This is an explicit Frontend Foundation limitation, not authorization for screens to call raw endpoints directly.
