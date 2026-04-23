# Map — Python API tests (`tests/backend_tests/`)

**Canonical detail:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) § `tests/backend_tests/`. When writing or editing API test calls, follow [`docs/CODE_STYLE_READABILITY.md`](../../../docs/CODE_STYLE_READABILITY.md) (named request locals, clear identifiers).

**Markers / run profiles (pytest):** the repo uses the same logical **`@…` tags** as Playwright (e.g. `@smoke`, `@merge-gate`, `@e2e` for integration journeys) via **`pytest.mark.*`**; hyphens in doc names map to **underscores** in Python (e.g. `merge_gate`). See [`.cursor/rules/pytest-backend-api-tests.mdc`](../../../.cursor/rules/pytest-backend-api-tests.mdc) and `tests/backend_tests/pytest.ini` **`[pytest] markers`**. Run examples: from `tests/backend_tests/`, `pytest -m smoke` or `pytest -m "e2e and merge_gate"`.

**Allure:** `allure-pytest` is a dependency; `pytest.ini` sets `--alluredir=allure-results`. Metadata and steps: [`.cursor/skills/allure-reporting/SKILL.md`](../../../.cursor/skills/allure-reporting/SKILL.md).

## Where to look first

| Topic | Location |
|-------|----------|
| Pytest plugins & fixtures | `tests/backend_tests/conftest.py`, `tests/backend_tests/src/plugins/` |
| HTTP clients | `tests/backend_tests/src/services/` (`base_client.py`, `*_client.py`) |
| User strategies | `tests/backend_tests/src/strategies/user/` |
| Authenticated actor pattern | `RegisteredTestUser.api` / `AdminRegisteredTestUser.api` — chain calls at the site (e.g. `user.api.deposits.deposit_fiat(...)`); do not use `api = user.api` |
| Builders & factories | `tests/backend_tests/src/builders/`, `tests/backend_tests/src/factories/` |
| API test matrices | `tests/backend_tests/tests/api/` |
| Env loading | root `.env` + optional `tests/backend_tests/.env` via `src/utils/env_loader.py` |

## Related wiki

- [`map-backend.md`](map-backend.md)
- [`map-testing-by-capability.md`](map-testing-by-capability.md)
- [`index-by-repo-path.md`](index-by-repo-path.md)
