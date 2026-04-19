# Map — Python API tests (`tests/backend_tests/`)

**Canonical detail:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) § `tests/backend_tests/`.

## Where to look first

| Topic | Location |
|-------|----------|
| Pytest plugins & fixtures | `tests/backend_tests/conftest.py`, `tests/backend_tests/src/plugins/` |
| HTTP clients | `tests/backend_tests/src/services/` (`base_client.py`, `*_client.py`) |
| User strategies | `tests/backend_tests/src/strategies/user/` |
| Builders & factories | `tests/backend_tests/src/builders/`, `tests/backend_tests/src/factories/` |
| API test matrices | `tests/backend_tests/tests/api/` |
| Env loading | root `.env` + optional `tests/backend_tests/.env` via `src/utils/env_loader.py` |

## Related wiki

- [`map-backend.md`](map-backend.md)
- [`index-by-repo-path.md`](index-by-repo-path.md)
