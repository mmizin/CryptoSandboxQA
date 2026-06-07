# Use NestJS as the backend framework

**Status:** Accepted

**Date:** 2024-03-01

## Context

CryptoSandboxQA required a backend that could:
- Serve REST API endpoints for trading, deposits, user management
- Handle realtime updates (ticker prices, order fills) via WebSocket
- Integrate cleanly with Prisma ORM and PostgreSQL
- Support modular architecture (auth, orders, wallets, etc. as separate concerns)
- Provide built-in tooling for API documentation (Swagger/OpenAPI)
- Be type-safe to catch errors at build time, not runtime

The team had TypeScript expertise, so a framework in the JavaScript/Node.js ecosystem was preferred.

## Decision

We chose **NestJS** (v9+) as the backend framework, running on Node.js.

## Rationale

### Pros of NestJS
- **Module system** — Built-in dependency injection and modular architecture (AuthModule, OrdersModule, WalletsModule, etc.) prevent tight coupling
- **TypeScript first** — Full-stack type safety; decorators reduce boilerplate; clear contracts between layers
- **Swagger/OpenAPI built-in** — `@nestjs/swagger` generates API docs; regenerated via `npm run openapi:generate`
- **WebSocket support** — `@nestjs/websockets` + Socket.IO for realtime updates (ticker namespace)
- **ORM integration** — Excellent integration with Prisma; services inject `PrismaService` directly
- **Middleware & guards** — Auth, logging, error handling via standard patterns (guards, pipes, interceptors)
- **Strong ecosystem** — Well-maintained, wide adoption, good community; integrates with testing frameworks (Jest)
- **Developer experience** — CLI scaffolding, hot reloading, clear project structure

### Cons of NestJS
- **Opinionated** — Forces a structure (modules, services, controllers) that feels heavy for simple APIs
- **Boilerplate** — More decorators and wiring than minimal alternatives like Express
- **Performance** — Not as lean as Fastify, but acceptable for training platform scale (~100-1000 concurrent users)
- **Learning curve** — Steeper than Express.js for developers unfamiliar with Angular-like patterns

### Alternatives considered

**Express.js (Minimal Node.js HTTP server):**
- Pros: Lightweight, flexible, fast startup
- Cons: No built-in structure; dependency injection optional; requires manual routing, error handling, validation
- **Rejected:** Would require custom boilerplate for modules, guards, and OpenAPI documentation; not worth the effort for a QA training platform

**Fastify (High-performance HTTP server):**
- Pros: Very fast, lightweight, built-in JSON schema validation
- Cons: Smaller ecosystem; fewer integrations (Swagger, WebSocket); less opinionated structure
- **Rejected:** NestJS's integration with Prisma, Swagger, and Socket.IO outweighs the marginal performance gain; training platform doesn't need peak throughput

**Go with Gin or Chi (Compiled, concurrent):**
- Pros: Compiled, fast, goroutines for concurrency, simpler build model
- Cons: Different language (team expertise is TypeScript); breaks type alignment with frontend; separate deployment pipeline
- **Rejected:** Linguistic consistency with frontend (Next.js + React) and shared TypeScript types (models, DTOs) outweigh Go's performance advantage

**Python with Django or FastAPI:**
- Pros: Rich ecosystem, easy ORM integration
- Cons: Runtime overhead; separate from frontend TypeScript; slower cold starts
- **Rejected:** Team preference for TypeScript; real-time requirements favor JavaScript event loop

## Consequences

### Positive consequences
- **Modular architecture** — Each feature (auth, orders, wallets) lives in a self-contained module; easy to reason about
- **Type-safe API** — Swagger-generated types prevent client/server mismatches; automated OpenAPI regeneration catches drift
- **Real-time capability** — Socket.IO integration for ticker updates is seamless; same language as WebSocket handlers
- **Developer onboarding** — Clear patterns (Module → Service → Controller) reduce cognitive load for new team members
- **Testing patterns** — NestJS + Jest integration is smooth; dependency injection makes mocking services easy
- **Code reuse** — Shared types (Order, User, Wallet) across backend and frontend reduce duplication and sync errors

### Negative consequences / Risks
- **Boilerplate overhead** — Every feature needs a module, service, controller, DTO, even for simple operations
- **Startup time** — Slower cold starts than Express or Fastify (mitigated: not a concern for continuous dev server or containerized deployment)
- **Framework coupling** — Difficult to swap out NestJS later; tightly integrated guards, interceptors, pipes
- **Performance ceiling** — Single Node.js process; horizontal scaling requires load balancer (acceptable for training platform)

### Mitigation strategies
- **Documentation** — ARCHITECTURE.md and NestJS docs help new developers understand module patterns quickly
- **Scaffolding** — Use NestJS CLI for new modules to ensure consistent structure: `nest generate module <name>`
- **Code generation** — OpenAPI spec regenerated automatically in CI to catch schema drift
- **Testing** — Comprehensive unit and integration tests (pytest) prevent regressions; documented in `tests/backend_tests/`

## Related ADRs

- [0001: PostgreSQL](./0001-postgresql-relational-model.md) — Database choice; NestJS integrates seamlessly with Prisma
- [0003: Prisma ORM](./0003-prisma-orm.md) — ORM layer; NestJS + Prisma is a natural pairing
- [0005: Socket.IO Realtime](./0005-socket-io-realtime.md) — Real-time updates via NestJS WebSocket support

## References

- NestJS docs: https://docs.nestjs.com/
- Backend architecture: [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Backend module breakdown: [`ARCHITECTURE.md` § Backend application](../../ARCHITECTURE.md#backend-application)
- Setup: [`CLAUDE.md` § Quick start](../../CLAUDE.md#quick-start)
