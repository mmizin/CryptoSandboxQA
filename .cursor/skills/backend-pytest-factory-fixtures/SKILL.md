# Backend pytest factory fixtures

Use this skill when backend API/integration tests need authenticated users in `tests/backend_tests/`.

## Workflow

1. Open `tests/backend_tests/conftest.py` and check existing `pytest_plugins`.
2. Reuse fixture factories from `tests/backend_tests/src/plugins/` first (typically `fxt_regular_user` and `fxt_admin_user`).
3. If naming or uniqueness differs per scenario, start with a local callback in the spec file and pass it into the fixture factory.
4. Move that callback to `tests/backend_tests/src/utils/` only when multiple modules reuse the same behavior (example: `configure_api_order_user`).
5. Create a new fixture plugin only when existing fixtures cannot represent the lifecycle you need; place it under `tests/backend_tests/src/plugins/` and register it in `conftest.py`.

## Helper placement rule

- Prefer local support functions in the test file for single-module needs.
- Promote helpers to `tests/backend_tests/src/utils/` only after clear cross-module reuse appears.
- Keep `utils` for durable/common behavior, not one-file convenience wrappers.

## Examples

- Local helper example: a per-file user naming callback like `_configure_deposits_api_user(...)` inside one deposits spec.
- Local helper example: a small one-file assertion adapter used only by one test module.
- `utils` helper example: `configure_api_order_user(...)` shared across several Orders API modules under `tests/api/orders/`.
- `utils` helper example: shared response diagnostics helpers consumed by multiple suites.

## Decision checklist

- Used by one spec module only -> keep helper local.
- Used by multiple modules with the same contract -> move to `tests/backend_tests/src/utils/`.
- Extraction creates an over-generic or unclear helper -> keep local until reuse is real.

## Cross-stack alignment

- UI tests follow the same fixture-first mindset in `tests/ui-tests/src/fixtures/` (see `user.fixture.ts`).
