---
name: playwright-trace-cli-analysis
description: >-
  Locates a Playwright test by name, re-runs it with `--trace on` and `--retries 0`,
  then inspects the resulting `trace.zip` via `npx playwright trace` to triage failures
  and suggest minimal fixes. Use when the user names a failing or flaky test; when they
  provide a `trace.zip` or `test-results/...` path; or when debugging Playwright traces
  from the CLI without the GUI.
---

# Playwright trace CLI analysis

Use the **Playwright 1.59+** CLI trace workflow (see [CLI trace analysis for agents](https://playwright.dev/docs/release-notes#-cli-trace-analysis-for-agents)) to explore [Playwright Trace](https://playwright.dev/docs/trace-viewer) data without relying only on the Trace Viewer UI.

## Prerequisites

- Run all commands from **`tests/ui-tests`** (where `npx playwright` resolves and `test-results/` paths are correct).

## First steps (user gives a test name)

When the user provides a **test name** (title substring, file, or line) but not yet a `trace.zip`:

1. **Find the test** — Search under `tests/ui-tests/tests` (and imports) until the matching `test(...)` / `test.only` / `test.describe` is identified. Resolve ambiguity by asking one short question if multiple tests match.
2. **Re-run with trace and no retries** — From `tests/ui-tests`, run that test with **`--trace on`** (always record a trace for this run) and **`--retries 0`** (single attempt; avoids extra runs and matches a single clear `trace.zip`):

   ```bash
   # By spec path
   npx playwright test tests/e2e/login.spec.ts --trace on --retries 0

   # By test title: -g is shorthand for --grep (regex against test('...') titles)
   npx playwright test -g "add a todo item" --trace on --retries 0
   ```

3. **Locate `trace.zip`** — After the run, open the artifact under `test-results/`, typically:

   `test-results/<sanitized-suite>-<sanitized-title>-<project>/trace.zip`

   If the test passed, the trace still exists for analysis; if it failed, proceed to triage below.

When the user **already** has a `trace.zip` path, skip the run and start at **Standard CLI workflow**.

## Standard CLI workflow

Execute in order; each step uses the trace session opened by `open` until `close`:

1. `npx playwright trace open <path/to/trace.zip>` — loads the trace; note title, browser, duration from the output.
2. `npx playwright trace actions` — list actions. Optional: `--grep="expect"` or other substrings to focus on assertions or interactions.
3. `npx playwright trace action <index>` — inspect the failing or suspicious step: error text, expected vs received, timeout, parameters, **Source** line, snapshot availability.
4. `npx playwright trace snapshot <index> --name before` and/or `--name after` — capture accessibility/DOM context at failure time.
5. `npx playwright trace close` — end the session when analysis is done.

## Triage playbook

- **Expect failures:** Read `Expected` / `Received`, pattern vs string, `timeout`, and `isNot`. Check the **Log** for retries or intermediate values.
- **Snapshots:** Compare **before** vs **after** to see what the page actually showed when the assertion ran.
- **Source:** Use file:line from the trace (e.g. `login.spec.ts:53:28`) to jump to the spec and align fixes with real code.
- **Network / console:** If the trace output or user context points to missing APIs or console errors, correlate with app behavior; the CLI snapshot may still show the visible UI state.

## Fix guidance

- Prefer the **smallest** change: stabilize locators, adjust assertions, add targeted waits, fix `baseURL` or route assumptions, or correct environment/config—not broad refactors.
- For this repo’s UI tests: data-driven / matrix **names** follow [.cursor/rules/test-scenario-conventions.mdc](../../rules/test-scenario-conventions.mdc); Playwright **URLs and tags** follow [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc) (e.g. `toHaveURL` with **path strings** when `baseURL` is set in `playwright.config.ts`).
- **Do not** add new test files or new test cases unless the user explicitly asks — see [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc).

## Trace availability (this repo)

`tests/ui-tests/playwright.config.ts` sets `trace: 'on-first-retry'`, so a normal run without CLI overrides may omit a trace on first failure (local `retries: 0`). **Prefer the First steps flow** (`--trace on --retries 0`) when the user names a test so a `trace.zip` is always produced for that run. If artifacts are still missing, suggest checking `test-results/` output or re-running with the same flags; only suggest changing `playwright.config.ts` trace mode if the user wants that permanently.

## Anti-patterns

- Do not store custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor-built-in skills).
- Do not skip `open` before `actions` / `action` / `snapshot`; the CLI session expects an opened trace.
