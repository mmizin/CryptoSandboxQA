# Map — backend (`backend/`)

**Canonical detail:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) (backend modules, auth, env loading).

## Where to look first

| Topic | Location |
|-------|----------|
| Nest app wiring | `backend/src/app.module.ts`, feature `*.module.ts` under `backend/src/` |
| OpenAPI / Swagger helpers | `backend/src/openapi/`, exported [`openapi.json`](../../../openapi.json) (repo root) |
| Prisma schema & seeds | `backend/prisma/schema.prisma`, `backend/prisma/seed-*.js` |
| Deposits domain | `backend/src/deposits/` |
| Orders & matching | `backend/src/orders/` |
| Wallets & balances | `backend/src/wallets/` |
| Auth, mail, metrics | `backend/src/auth/`, `backend/src/mail/`, `backend/src/metrics/` |

## Related wiki

- [`index-by-repo-path.md`](index-by-repo-path.md)
- [`map-tests-backend.md`](map-tests-backend.md) (HTTP clients under tests)
