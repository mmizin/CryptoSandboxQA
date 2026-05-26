---
name: run-backend-tests
description: >-
  Run Python/pytest backend API tests under tests/backend_tests/ with optional marker
  filtering and Allure output. Use when the user asks to run backend tests, API tests,
  or a specific pytest marker subset.
disable-model-invocation: false
---

# Run backend tests

When the user invokes `/run-backend-tests` or asks to run backend/API/pytest tests, execute the appropriate command from `tests/backend_tests/`.

## Arguments

`$ARGUMENTS` may contain:
- A marker name or expression: `smoke`, `e2e`, `merge_gate`, `"smoke and merge_gate"`, `"not e2e"`
- A module path: `tests/api/orders/`, `tests/api/test_deposits_api.py`
- Flags: `-n auto` for parallel, `-k "some_function"` for keyword match
- `allure` to generate and serve the Allure report after the run

If no arguments are given, run all tests.

## Commands

```bash
# All tests
cd tests/backend_tests && pytest

# Filtered by marker
cd tests/backend_tests && pytest -m <marker>

# Filtered by marker, parallel
cd tests/backend_tests && pytest -n auto -m <marker>

# Specific module or path
cd tests/backend_tests && pytest <path>

# Generate Allure report (default via pytest.ini addopts)
# Results go to tests/backend_tests/allure-results/
# To serve: allure serve tests/backend_tests/allure-results
```

## Allure output

`pytest.ini` sets `--alluredir=allure-results` by default, so every run produces `tests/backend_tests/allure-results/`. To view the report:

```bash
allure serve tests/backend_tests/allure-results
```

Allure CLI requires a Java runtime. If unavailable, raw JSON results are still in the directory.

## After running

- Report which tests passed/failed with a count summary.
- For failures, quote the assertion message and any HTTP status/body snippet from the test output.
- If a test needs `ADMIN_API_KEY` or `API_URL`, remind the user to check repo root `.env`.
