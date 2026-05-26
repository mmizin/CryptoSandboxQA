---
name: run-ui-tests
description: >-
  Run Playwright UI tests under tests/ui-tests/ with optional tag/grep filtering and
  optional Allure report display. Use when the user asks to run UI tests, E2E tests,
  Playwright tests, or a specific tag subset.
disable-model-invocation: false
---

# Run UI tests

When the user invokes `/run-ui-tests` or asks to run UI/E2E/Playwright tests, execute the appropriate command from `tests/ui-tests/`.

## Arguments

`$ARGUMENTS` may contain:
- A tag: `@smoke`, `@e2e`, `@merge-gate`, `@client-validation`
- A spec path: `tests/e2e/login.spec.ts`
- `--headed` for visible browser
- `report` to serve the Allure report after the run

If no arguments are given, run all tests in headless mode.

## Setup check

Before running, verify `tests/ui-tests/node_modules/` exists. If not, remind the user:

```bash
cd tests/ui-tests && npm install
```

Playwright browsers also need to be installed once:

```bash
cd tests/ui-tests && npx playwright install
```

## Commands

```bash
# All tests (headless)
cd tests/ui-tests && npx playwright test

# Filtered by tag
cd tests/ui-tests && npx playwright test --grep @smoke
cd tests/ui-tests && npx playwright test --grep @merge-gate
cd tests/ui-tests && npx playwright test --grep @e2e

# Specific file
cd tests/ui-tests && npx playwright test tests/e2e/login.spec.ts

# Headed mode (visible browser)
cd tests/ui-tests && npx playwright test --headed --grep @smoke

# View Allure report (results in tests/ui-tests/allure-results/)
cd tests/ui-tests && npx playwright show-report
# Or with allure CLI:
allure serve tests/ui-tests/allure-results
```

## Environment

Tests load repo root `.env` then `tests/ui-tests/.env` (overrides). Key variables:
- `PLAYWRIGHT_BASE_URL` / `BASE_URL`: browser origin (default `http://localhost:3000`)
- `PLAYWRIGHT_RANDOM_SEED`: optional integer for reproducible randomised data

Ensure the app is running (`npm run dev` from repo root) before running Playwright tests.

## After running

- Report pass/fail summary.
- For failures, include the test name, assertion message, and URL/locator context.
- If screenshots or traces were captured (first retry), mention their location so the user can inspect them.
