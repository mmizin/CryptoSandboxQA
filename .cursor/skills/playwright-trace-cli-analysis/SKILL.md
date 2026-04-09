---
name: playwright-trace-cli-analysis
description: >-
  Inspects Playwright trace archives via the CLI (`npx playwright trace`) to triage
  failing or flaky tests, interpret expect errors and snapshots, and suggest minimal
  fixes. Use when a Playwright test failed or is flaky; when the user provides a
  `trace.zip` path or `test-results/...` artifact; when debugging Playwright traces
  from the command line; or when the user asks to analyze trace output without the GUI.
---

# Playwright trace CLI analysis

Use the **Playwright 1.59+** CLI trace workflow (see [CLI trace analysis for agents](https://playwright.dev/docs/release-notes#-cli-trace-analysis-for-agents)) to explore [Playwright Trace](https://playwright.dev/docs/trace-viewer) data without relying only on the Trace Viewer UI.

## Prerequisites

- Run all commands from **`tests/ui-tests`** (where `npx playwright` resolves and `test-results/` paths are correct).
- A trace archive must exist, typically:

  `test-results/<sanitized-suite>-<sanitized-title>-<project>/trace.zip`

  If the user only names a test, help them locate the matching folder under `test-results/` (or they re-run the test with tracing enabled).

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
- For this repo’s UI tests, follow [.cursor/rules/playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc) (e.g. `toHaveURL` with **path strings** when `baseURL` is set in `playwright.config.ts`).
- **Do not** add new test files or new test cases unless the user explicitly asks — see [.cursor/rules/no-unrequested-tests.mdc](../../rules/no-unrequested-tests.mdc).

## Trace availability (this repo)

`tests/ui-tests/playwright.config.ts` sets `trace: 'on-first-retry'`. A trace is produced when a failed test is **retried** (e.g. on CI with `retries > 0`). On a **first-run failure with no retry**, there may be no `trace.zip`. If the user needs a trace on every failure, they can change tracing mode (e.g. `on`, `retain-on-failure`, or `retain-on-failure-and-retries` per Playwright docs)—suggest this only when missing artifacts block debugging; do not change config unless the user wants it.

## Anti-patterns

- Do not store custom skills under `~/.cursor/skills-cursor/` (reserved for Cursor-built-in skills).
- Do not skip `open` before `actions` / `action` / `snapshot`; the CLI session expects an opened trace.
