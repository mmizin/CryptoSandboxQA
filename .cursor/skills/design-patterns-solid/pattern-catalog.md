# Pattern catalog (reference)

Use this file when the user needs **names**, **intent**, or **classic structure**—keep answers in the main skill lean.

## SOLID (expanded)

- **SRP:** Split when a module mixes unrelated reasons to change (e.g. HTTP parsing + business rules + email HTML).
- **OCP:** Prefer **plugin-style** extension (strategy, events, new Nest module) over editing a central `switch`.
- **LSP:** Subtypes must not weaken pre/postconditions; mocks should behave like production regarding observable contracts.
- **ISP:** Split fat TypeScript interfaces into role-specific types.
- **DIP:** High-level modules import **abstractions**; wire concrete implementations in composition root (Nest `Module`, test `test.extend`).

## Creational

| Pattern | Intent |
|---------|--------|
| **Singleton** | Single instance (prefer Nest provider scope over hand-rolled globals). |
| **Factory method** | Subclasses decide which product to instantiate. |
| **Abstract factory** | Families of related objects without concrete classes leaking. |
| **Builder** | Step-by-step construction of complex objects (useful for **test data**). |
| **Prototype** | Clone/reuse configured instances (less common in typical TS services). |

## Structural

| Pattern | Intent |
|---------|--------|
| **Adapter** | Convert one interface to another. |
| **Decorator** | Add behavior without changing original object (Nest interceptors/guards). |
| **Facade** | Simplify a complex subsystem API. |
| **Proxy** | Surrogate controlling access (lazy load, caching, auth). |
| **Composite** | Tree structures treated uniformly (UI component trees). |

## Behavioral

| Pattern | Intent |
|---------|--------|
| **Strategy** | Interchangeable algorithms at runtime. |
| **Template method** | Algorithm skeleton in base; subclasses customize steps. |
| **Observer** | Notify dependents of state changes (events, subscriptions). |
| **Command** | Encapsulate requests as objects (undo queues, job dispatch). |
| **State** | Object behavior changes when internal state changes. |
| **Chain of responsibility** | Pass along a pipeline until handled (middleware-style). |

## Further reading (external)

These are stable, widely used references (no project-specific URLs required):

- **Gang of Four** — *Design Patterns: Elements of Reusable Object-Oriented Software* (catalog and forces).
- **Refactoring.Guru** — Design patterns and SOLID overviews with diagrams and language-agnostic intent.
- **NestJS docs** — [Providers](https://docs.nestjs.com/providers), [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers), [Modules](https://docs.nestjs.com/modules) for DI-first design.
- **Playwright** — [Fixtures](https://playwright.dev/docs/test-fixtures) for composable test setup.

When recommending a link in chat, prefer the **canonical documentation** for the stack version the repo uses.
