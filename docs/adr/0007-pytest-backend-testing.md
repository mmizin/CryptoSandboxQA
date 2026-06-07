# Use pytest for backend API testing

**Status:** Accepted

**Date:** 2024-04-01

## Context

CryptoSandboxQA required backend API testing that could:
- Test order creation, settlement, and balance correctness (critical for QA training)
- Validate complex workflows (deposit → order → settlement → withdrawal)
- Create test fixtures efficiently (users, wallets, market data)
- Share test data models with frontend tests (type consistency)
- Integrate with CI/CD without external dependencies
- Provide parametrized testing for validation matrices (e.g., invalid order amounts)
- Support both integration tests (against real database) and unit tests

The team already used Python for data science work, so pytest was a natural fit; it also integrates with the Allure reporting tool used by Playwright tests.

## Decision

We chose **pytest** (v7+) with **httpx** (async HTTP client) for backend API testing.

## Rationale

### Pros of pytest
- **Fixture system** — Powerful dependency injection; reusable test setup (user creation, wallet funding, etc.)
- **Parametrization** — `@pytest.mark.parametrize` tests multiple inputs without code duplication
- **Integration testing** — Tests run against real PostgreSQL database; catches real bugs
- **Clear assertions** — `assert` statements are readable; easy to understand test intent
- **Plugin ecosystem** — Pytest has plugins for coverage, parallel execution, reporting, mocking
- **Python language** — High-level scripting; easy to manipulate test data and assertions
- **Allure integration** — Same reporting tool as Playwright; unified test reports across UI and API
- **Markers** — `@pytest.mark.auth`, `@pytest.mark.orders` organize tests by feature (same as Playwright tags)

### Cons of pytest
- **Language mismatch** — Tests are Python, but backend is TypeScript/NestJS (mitigated: types are shared via DTOs in models/)
- **Async complexity** — Testing async NestJS endpoints requires async/await in tests
- **Setup overhead** — Fixtures and conftest.py can be complex for beginners
- **Slower than unit tests** — Integration tests with database calls are inherently slower than mocks

### Alternatives considered

**Jest (JavaScript testing):**
- Pros: Same language as backend; excellent TypeScript support; built-in test runner
- Cons: Requires Node.js environment; database testing is more complex; fewer Python testing patterns (coverage matrices, etc.)
- **Rejected:** Python's pytest is more flexible for integration testing; httpx is simpler than Jest's HTTP mocking

**Supertest (Express/NestJS testing):**
- Pros: Native NestJS integration; launches app in test process; can inject services directly
- Cons: Only Node.js; less flexible than external API testing; doesn't test real HTTP serialization
- **Rejected:** External API testing (via httpx) tests the real HTTP layer; better for QA training platform

**Go `testing` package (if backend were Go):**
- Pros: Built-in, fast, simple
- Cons: Doesn't apply; backend is NestJS
- **Rejected:** Not applicable

**Robot Framework with HTTP keywords:**
- Pros: Keyword-driven; non-developers can read tests
- Cons: Verbose; rigid structure; poor IDE support; steeper learning curve
- **Rejected:** Code-based testing with pytest is more flexible; developers prefer code

**Postman Collections (Manual API testing):**
- Pros: GUI; easy to learn; exportable
- Cons: Not version-controlled easily; hard to maintain; manual execution; no continuous testing
- **Rejected:** Automated testing is essential; Postman is fine for exploration but not suitable for CI/CD

## Consequences

### Positive consequences
- **Type-safe test data** — Models shared between frontend and backend (`UserProfile`, `Order`, `Deposit`) prevent sync errors
- **Reusable fixtures** — User creation, wallet funding, order placement are centralized; tests are focused on behavior
- **Parametrized validation** — `@pytest.mark.parametrize` tests many edge cases (negative amounts, invalid currencies, etc.)
- **Real database testing** — Tests run against PostgreSQL; catch real bugs that mocks would miss (locking, race conditions, constraints)
- **Integration with Allure** — Same reporting tool as Playwright; unified CI/CD reporting
- **Python flexibility** — Easy to calculate expected balances, manipulate test data, and assert complex conditions
- **Fast feedback** — Pytest runs in parallel; full backend test suite takes ~2-3 minutes

### Negative consequences / Risks
- **Language switch** — Developers must context-switch between TypeScript (backend) and Python (tests)
- **Type mismatch** — Python models must be kept in sync with NestJS DTOs manually (mitigated: clear naming conventions)
- **Database state management** — Tests can leave residual data; requires careful cleanup or isolation (mitigated: test transactions or `db reset`)
- **Fixture complexity** — Shared conftest.py can become hard to understand as suite grows
- **Slow startup** — Python startup + database connection per test class; slower than in-process Jest tests

### Mitigation strategies
- **Shared models** — `tests/backend_tests/src/models/` mirrors NestJS types; synchronized naming (e.g., `UserProfile`, `CreateOrderRequest`)
- **Fixture reuse** — `conftest.py` centralizes user creation, wallet funding; individual tests are focused
- **Database isolation** — Each test runs in isolation; use pytest fixtures to clean up after tests
- **Documentation** — Comprehensive comments in conftest.py explain fixture layering and dependencies
- **Code generation** — If models drift, regenerate from OpenAPI spec or NestJS types
- **Validation matrices** — Use parametrization to test many edge cases without writing redundant test functions
- **Parallelization** — `pytest -n auto` runs tests in parallel across CPU cores

## Related ADRs

- [0002: NestJS](./0002-nestjs-backend-framework.md) — Backend framework; pytest tests NestJS REST API
- [0006: Playwright UI Testing](./0006-playwright-ui-testing.md) — Complementary UI testing; both use Allure reporting

## References

- pytest docs: https://docs.pytest.org/
- pytest fixtures: https://docs.pytest.org/en/stable/fixture.html
- pytest parametrize: https://docs.pytest.org/en/stable/parametrize.html
- httpx docs: https://www.python-httpx.org/
- Test organization: [`tests/backend_tests/`](../../tests/backend_tests/) — Pytest matrices by feature
- Running tests: [`CLAUDE.md` § Testing](../../CLAUDE.md#testing) — `/run-backend-tests @orders` by marker
- Setup guide: [`knowledge/llm-wiki/wiki/00-START-HERE.md`](../../knowledge/llm-wiki/wiki/00-START-HERE.md)
- Allure reporting: https://docs.qameta.io/allure/
