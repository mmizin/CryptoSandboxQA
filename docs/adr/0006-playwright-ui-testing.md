# Use Playwright for UI/E2E testing

**Status:** Accepted

**Date:** 2024-04-01

## Context

CryptoSandboxQA required a UI testing framework that could:
- Test real user flows (login → deposit → trade → view portfolio)
- Run across browsers (Chrome, Firefox, Safari) to ensure compatibility
- Provide good debugging experience (trace files, screenshots, slow-motion replay)
- Support multiple login strategies (direct browser login, API user creation, admin impersonation)
- Integrate with CI/CD without flakiness
- Generate test reports for stakeholders

We needed a tool that could replace manual QA testing and provide confidence before each release.

## Decision

We chose **Playwright** (v1.40+) for all UI and end-to-end testing.

## Rationale

### Pros of Playwright
- **Cross-browser** — Single codebase tests Chrome, Firefox, and Safari
- **Debugging tools** — Trace files, screenshots, video, slow-motion replay help diagnose failures
- **Reliable selectors** — Auto-waits for elements to be actionable (visible, stable); reduces flakiness
- **API + UI testing** — Can make HTTP calls via `page.request` (useful for setup/teardown)
- **Multiple login strategies** — Supports form-based login, API token auth, and session persistence
- **Parallel execution** — Runs tests in parallel by default; shard across CI machines
- **Good TypeScript support** — Full type safety for page objects, fixtures, assertions
- **Reporting** — Built-in Allure and HTML reports; integrates with CI dashboards
- **Open source** — Free, well-maintained by Microsoft; active community

### Cons of Playwright
- **Not headless-only** — Requires full browser binaries (adds ~500MB to CI image)
- **Slow in CI** — UI tests inherently slower than unit tests; full test suite takes 5-10 minutes
- **Flakiness risk** — Network latency, timing assumptions can cause intermittent failures (mitigated: proper waits and retries)
- **Maintenance overhead** — Test selectors break when UI changes; requires discipline to keep tests updated

### Alternatives considered

**Cypress (UI testing):**
- Pros: Developer experience is excellent; good debugging; single-browser automation
- Cons: Chrome-only (no Firefox/Safari); limited to same-origin navigation; not suitable for full-stack QA
- **Rejected:** Cross-browser testing is important; Playwright's multi-browser support is superior

**Selenium (WebDriver protocol):**
- Pros: Industry standard; works with all browsers; widely adopted
- Cons: Flaky (no auto-waits); verbose syntax; slow; poor debugging experience
- **Rejected:** Playwright's auto-waits and debugging tools are superior; Selenium is dated

**WebDriver IO (WebDriver + Node):**
- Pros: Familiar WebDriver protocol; good Node.js integration
- Cons: Less mature than Cypress/Playwright; smaller community; debugging is weaker
- **Rejected:** Playwright is the newer standard; better tooling and community

**Robot Framework (Keyword-driven testing):**
- Pros: Non-developers can write tests; keyword library is extensive
- Cons: Steep learning curve; verbose; inflexible; not suitable for complex flows
- **Rejected:** Team prefers code-based testing; not suitable for developers who write code

**Manual QA only:**
- Pros: Finds edge cases humans think of; real user perspective
- Cons: Slow; expensive; not reproducible; scales poorly; misses regressions
- **Rejected:** Automated testing is essential for continuous delivery; manual testing complements automation

## Consequences

### Positive consequences
- **Confidence before release** — Full user journeys are tested; catch regressions automatically
- **Cross-browser validation** — Same test runs in Chrome, Firefox, Safari; catches browser-specific bugs
- **Low-maintenance tests** — Auto-waits eliminate most timing issues; test selectors are resilient
- **Fast CI feedback** — Parallel execution finishes in ~5 minutes; developers see results before merging
- **Good debugging** — Screenshots and trace files pinpoint failures without "it works on my machine" mysteries
- **Multiple strategies** — Can test both authenticated flows (via API) and unauthenticated flows (form login)

### Negative consequences / Risks
- **CI image size** — Playwright browser binaries add ~500MB to Docker image
- **Test maintenance** — Selectors break when UI changes; requires discipline to keep tests updated
- **Flakiness** — Timing assumptions can cause intermittent failures (e.g., waiting for animation to finish)
- **Slow feedback** — Full test suite takes 5-10 minutes; developers may skip running locally
- **Parallel execution overhead** — Spinning up browsers per test is memory-intensive

### Mitigation strategies
- **Reliable waits** — Use explicit `page.waitForLoadState('networkidle')` and `page.locator(...).waitFor()` instead of `sleep`
- **Page objects** — Encapsulate selectors in reusable page objects; changes propagate automatically
- **Retry logic** — Playwright's built-in retry mechanism handles transient failures
- **Fixture setup via API** — Create test users and data via `POST /auth/register` (fast) instead of UI form-filling (slow)
- **Smoke tests vs. comprehensive** — Keep core journey smoke tests fast; deeper tests run nightly
- **CI optimization** — Shard tests across multiple runners; cache browser binaries
- **Regular maintenance** — Review test failures in PR reviews; update selectors during refactoring

## Related ADRs

- [0004: Next.js](./0004-nextjs-frontend-framework.md) — Frontend framework; Playwright tests the Next.js app
- [0007: pytest Backend Testing](./0007-pytest-backend-testing.md) — Complementary backend API testing

## References

- Playwright docs: https://playwright.dev/
- Playwright best practices: https://playwright.dev/docs/best-practices
- Test organization: [`tests/ui-tests/`](../../tests/ui-tests/) — Feature-based structure (auth, orders, deposits, etc.)
- Page objects: [`tests/ui-tests/src/pages/`](../../tests/ui-tests/src/pages/)
- Running tests: [`CLAUDE.md` § Testing](../../CLAUDE.md#testing) — `/run-ui-tests @auth` by feature tag
- Setup guide: [`knowledge/llm-wiki/wiki/00-START-HERE.md`](../../knowledge/llm-wiki/wiki/00-START-HERE.md)
