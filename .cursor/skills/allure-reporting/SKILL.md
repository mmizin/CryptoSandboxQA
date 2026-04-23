---
name: allure-reporting
description: >-
  Applies Allure Report patterns for pytest (allure-pytest) under tests/backend_tests/ and
  Playwright (allure-playwright + allure-js-commons) under tests/ui-tests/: metadata (title,
  description, links, severity, labels), behavior and suite hierarchies (epic/feature/story),
  steps, parametrization display, fixture titles, attachments, ALLURE_TESTPLAN_PATH, and
  environment.properties. Use when the user asks for Allure, HTML test reports, richer pytest
  or Playwright reporting, test steps, or aligning automation with TMS/Jira-style links.
---

# Allure reporting (pytest + Playwright)

## When to use

Use this skill when **implementing or editing** automated tests and the goal is **clearer HTML reports**, **triage-friendly steps**, or **traceability** (layers, TMS/Jira links). Official references: [Allure Pytest](https://allurereport.org/docs/pytest/) (especially [Writing tests](https://allurereport.org/docs/pytest/#writing-tests)), [Allure Playwright](https://allurereport.org/docs/playwright/).

## Repo alignment

- **Test selection** stays on **pytest markers** ([`.cursor/rules/pytest-backend-api-tests.mdc`](../../rules/pytest-backend-api-tests.mdc), [`tests/backend_tests/pytest.ini`](../../../tests/backend_tests/pytest.ini)) and **Playwright `tag`** ([`.cursor/rules/playwright-ui-tests.mdc`](../../rules/playwright-ui-tests.mdc)). Use `-m` / `--grep` for CI subsets—not Allure labels alone.
- **Allure** adds **report navigation and metadata** (epic/feature/story, steps, attachments). Prefer **one** coherent hierarchy per module or `describe` block; avoid duplicating the same text in five fields.
- **Jira / TMS:** use `issue` / `testcase` (pytest) or `issue` / `link` (Playwright commons) only when **real keys or URLs** exist—do not invent IDs.

## Shared concepts

- **Behavior hierarchy:** `epic` → `feature` → `story` (product-oriented grouping).
- **Suite hierarchy:** `parent_suite` / `suite` / `sub_suite` (structural)—optional if package paths are enough.
- **Steps:** break journeys into **Arrange / Act / Assert** (HTTP or UI phases).
- **Parametrization:** adapters usually record pytest/Playwright parameters automatically; use **dynamic** overrides for redacted or readable values.
- **Test plan file:** set `ALLURE_TESTPLAN_PATH` to a JSON plan file so only listed tests run ([pytest](https://allurereport.org/docs/pytest/), [Playwright](https://allurereport.org/docs/playwright/)).
- **Environment:** after the run, add `environment.properties` under the results directory for static env facts; Playwright can set `environmentInfo` on the reporter in `playwright.config.ts`.

## Pytest (`allure-pytest`)

**Setup:** dependency `allure-pytest`; run with `--alluredir` (this repo defaults via [`tests/backend_tests/pytest.ini`](../../../tests/backend_tests/pytest.ini)). **Allure CLI** (`allure generate` / `allure serve`) needs a **Java** runtime per upstream docs.

**Metadata:** decorators (`@allure.epic`, …) or **`allure.dynamic.*`** inside the test when values are built at runtime.

**Steps:** `@allure.step` on helpers, or `with allure.step("…"):` in the test.

**Fixtures:** `@allure.title("…")` on important fixtures so setup/teardown reads well in the report ([Writing tests — fixtures](https://allurereport.org/docs/pytest/#describe-fixtures)).

**Attachments:** `allure.attach` / `allure.attach.file` for bodies, redacted headers, screenshots. Use `--allure-no-capture` if stdout/stderr capture noise dominates.

## Playwright (`allure-playwright` + `allure-js-commons`)

**Setup:** reporter in [`tests/ui-tests/playwright.config.ts`](../../../tests/ui-tests/playwright.config.ts); **`allure-js-commons`** for runtime/metadata in specs ([Getting started](https://allurereport.org/docs/playwright/)).

**Metadata:** call `allure.epic` / `allure.feature` / `allure.story` **early** in the test (or `test.beforeEach` in a `describe`). Alternative: metadata tags embedded in test titles per doc.

**Steps:** `allure.step` from commons or Playwright **`test.step`**.

**Attachments:** `allure.attachment` / `attachmentPath` or `testInfo.attach`.

**Global labels:** e.g. `ALLURE_LABEL_epic=…` in the environment (see Playwright doc).

## Project boundaries

- Match existing style; **no drive-by refactors** outside reporting-related lines.
- Do not blanket-annotate every line—focus on **journeys**, **large matrices**, and **failure-prone** areas where steps/metadata help.
- Domain naming for hierarchies should align with capability maps (e.g. [`knowledge/llm-wiki/wiki/map-testing-by-capability.md`](../../../knowledge/llm-wiki/wiki/map-testing-by-capability.md)).
