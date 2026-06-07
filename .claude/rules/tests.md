---
description: Testing patterns, builders, and conventions
paths:
  - "tests/**/*"
---

# CLAUDE.md — Testing

Guidance for writing and running tests in CryptoSandboxQA.

## Test builders

Use fluent builders `UserBuilder`, `OrderBuilder`, `DepositBuilder` (aligned across Python API tests and TypeScript UI tests). Example: `OrderBuilder().withPrice(100).withQuantity(5).withSide('buy').build()`. Builders construct domain objects matching request DTOs.

## User creation strategies

API tests use `ApiUserCreationStrategy` (registers via `POST /auth/register-with-profile`). Admin tests use `AdminApiUserCreationStrategy` (registers via `POST /auth/admin/register` with `ADMIN_API_KEY`). Both yield user object with lazy `.api` client: `user.api.orders.create(payload)`, `user.api.deposits.deposit_fiat(...)`. **Do not** assign `api = user.api` — use the lazy property directly.

## Run tests

- UI by feature: `/run-ui-tests @auth` (available tags: `@orders`, `@deposits`, `@admin`, `@payments`, `@portfolio`, `@auth`)
- API by marker: `/run-backend-tests @orders` (available markers: `@admin`, `@deposits`, `@auth`, `@orders`, `@payment_methods`)
- Allure reports auto-generated in `allure-results/` after each run; view with Allure skill

## Policies

- **No test creation unless asked.** Don't create, extend, or modify automated tests (unit, API, E2E) without explicit request. You can modify *existing* tests only if the task requires it.
- **Verify with tests.** Run tests before and after changes. For data changes, seed test data and verify balances/state. Tests aren't optional — they catch silent failures.
