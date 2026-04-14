---
name: design-patterns-solid
description: >-
  Guides application and test-framework design using SOLID principles and
  common design patterns (creational, structural, behavioral) mapped to
  TypeScript, NestJS, Next.js, Prisma, and Playwright. Use when designing or
  refactoring features, extending the UI test harness under tests/ui-tests/,
  reviewing architecture, choosing abstractions, or when the user asks for
  design patterns, SOLID, clean architecture, or maintainable test structure.
---

# Design patterns & SOLID

## Purpose

Apply **SOLID** and **design patterns** deliberately: reduce coupling, make behavior easy to extend without breaking callers, and keep the **product code** and **test framework** aligned with [ARCHITECTURE.md](../../../ARCHITECTURE.md). Prefer **simple code** over pattern theater—use a pattern when it removes duplication, clarifies responsibilities, or stabilizes an extension point.

## When to use

- New or refactored **backend** (NestJS), **frontend** (Next.js), or **persistence** (Prisma) code.
- Changes under **`tests/ui-tests/`** (Playwright, fixtures, models, strategies).
- Requests for **SOLID**, **design patterns**, **clean architecture**, **dependency injection**, or **testability**.

## SOLID (practical checklist)

| Principle | What it means here | Smell if wrong |
|-----------|-------------------|----------------|
| **S**ingle Responsibility | One reason to change per module/class (service = one domain concern; component = one UI job). | God services, 500-line React components. |
| **O**pen/Closed | Extend behavior via **new types** or **injected strategies**, not `if/else` chains on a growing enum. | Repeated `switch (type)` across the codebase. |
| **L**iskov Substitution | Implementations honor the contract (same errors, same invariants); no surprise side effects in subclasses/mocks. | Tests that need special cases for “real” vs “fake” impl. |
| **I**nterface Segregation | Small, focused types/APIs; clients don’t depend on methods they don’t use. | Fat interfaces, “optional” methods on shared types. |
| **D**ependency Inversion | Depend on **abstractions** (interfaces, tokens) for volatile or test-relevant deps; **inject** via Nest constructors or explicit factories. | `new ConcreteClient()` inside business logic; hard-coded env reads in deep layers. |

**NestJS alignment:** constructor injection, dynamic modules, and guards/interceptors already support **DIP** and **OCP**. Keep domain rules in **services**; keep HTTP/WebSocket adapters thin.

## Pattern map — application (this repo)

Use the **lightest** option that fits. See [pattern-catalog.md](pattern-catalog.md) for short definitions and references.

| Pattern | Typical use in this stack |
|---------|---------------------------|
| **Strategy** | Swappable algorithms (e.g. user-creation strategies, pricing, validation rules). |
| **Factory / Abstract factory** | Centralize creation of complex objects (DTOs → domain objects, API clients with shared config). |
| **Repository** | **Prisma** already acts as persistence access; add a thin wrapper only if you need swapability or domain-specific queries worth isolating. |
| **Decorator** | Nest **guards**, **interceptors**, **pipes**; cross-cutting auth, logging, metrics. |
| **Adapter** | Bridge external shapes to internal models (webhooks, third-party APIs, legacy DTOs). |
| **Facade** | One entry point over multiple services/modules for a use case. |
| **Template method** | Shared workflow with hooks (`abstract` base + overrides) when subclasses differ only in steps. |
| **Observer / Pub-sub** | Domain events or Socket.IO push; keep subscribers thin. |
| **Singleton** | Use sparingly; Nest providers are typically **one instance per scope**—prefer that over global mutable singletons. |
| **Module (Nest)** | Feature boundaries per [ARCHITECTURE.md](../../../ARCHITECTURE.md); avoid circular imports—extract shared module or interfaces. |

**Frontend (Next.js / React):** favor **composition** (children, slots), **custom hooks** for reusable stateful logic, and **presentational vs container** split where it clarifies testing. Avoid prop drilling when context or small composition APIs suffice.

## Pattern map — test framework (`tests/ui-tests/`)

| Pattern | Typical use |
|---------|-------------|
| **Page Object** | Encapsulate selectors and page actions; specs assert behavior, not CSS details scattered everywhere. |
| **Fixture** | Playwright `test.extend` for logged-in context, API setup, consistent teardown. |
| **Object Mother / Builder** | Construct **test users** and payloads with defaults + overrides; keep matrices readable. |
| **Strategy** | Swap **user creation** or **auth** paths (e.g. API vs UI registration) without duplicating journey code. |
| **Facade** | One helper that performs a multi-step **given** (seed user + wallet + order) for flows. |

**SOLID for tests:** keep **fixtures** and **page objects** focused (**SRP**); extend via **new strategies/fixtures** (**OCP**); depend on **interfaces** or typed helpers for API actors (**DIP**) so journeys stay stable when implementation details change.

## Workflow for the agent

1. **Clarify the change surface** — which module, route, or test layer ([ARCHITECTURE.md](../../../ARCHITECTURE.md)).
2. **Check SOLID** — especially SRP and DIP for new services and test helpers.
3. **Pick a pattern** only if it removes a concrete problem (duplication, unstable extension point, cross-cutting concern).
4. **Prefer framework idioms** — Nest injection, Prisma transactions, Playwright fixtures—before bespoke frameworks.
5. **Document non-obvious choices** — a one-line comment or PR note when a pattern guards a real extension point.

## Anti-patterns to avoid

- **Over-abstraction:** interfaces with one implementation and no tests needing fakes.
- **God objects:** one service or fixture doing registration, mail, trading, and assertions.
- **Leaking UI tests:** journeys that know database schema—prefer APIs/fixtures for setup per project rules.
- **Copy-paste Page Objects:** merge duplicates; parameterize differences.

## Additional resources

- Expand-only reference: [pattern-catalog.md](pattern-catalog.md) (catalog + further reading).
- Stack shape: [ARCHITECTURE.md](../../../ARCHITECTURE.md).
- UI test conventions: [playwright-ui-tests.mdc](../../rules/playwright-ui-tests.mdc).
