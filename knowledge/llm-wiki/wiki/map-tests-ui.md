# Map — Playwright UI tests (`tests/ui-tests/`)

**Canonical detail:** [`ARCHITECTURE.md`](../../../ARCHITECTURE.md) § `tests/ui-tests/`, [playwright-ui-tests.mdc](../../../.cursor/rules/playwright-ui-tests.mdc). For service calls and request objects in tests, use [`docs/CODE_STYLE_READABILITY.md`](../../../docs/CODE_STYLE_READABILITY.md).

**Allure:** `allure-playwright` + `allure-js-commons` — reporter in `playwright.config.ts` (`allure-results`); patterns in [`.cursor/skills/allure-reporting/SKILL.md`](../../../.cursor/skills/allure-reporting/SKILL.md).

## Where to look first

| Topic | Location |
|-------|----------|
| Config & env | `tests/ui-tests/playwright.config.ts`, root `.env` then `tests/ui-tests/.env` |
| E2E vs unit specs | `tests/ui-tests/tests/e2e/`, `tests/ui-tests/tests/unit/` |
| Page objects | `tests/ui-tests/src/pages/` |
| API clients for setup | `tests/ui-tests/src/services/*.api.ts` |
| Domain types & builders | `tests/ui-tests/src/models/`, `tests/ui-tests/src/builders/` |
| Fixtures | `tests/ui-tests/src/fixtures/` |

## Related wiki

- [`map-backend.md`](map-backend.md) for API behavior under test
- [`map-testing-by-capability.md`](map-testing-by-capability.md)
- [`index-by-repo-path.md`](index-by-repo-path.md)
