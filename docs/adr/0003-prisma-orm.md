# Use Prisma ORM for database access and schema management

**Status:** Accepted

**Date:** 2024-03-01

## Context

CryptoSandboxQA required an ORM that could:
- Provide type-safe database queries (prevent runtime errors like typos in column names)
- Manage schema migrations in version control (so changes are reviewed in PRs)
- Integrate with NestJS dependency injection
- Support complex queries (joins, filtering, aggregations for orders and wallets)
- Offer developer tooling for introspection (Prisma Studio)
- Keep database schema in sync with application types

The project started with schema design in `docs/DATABASE_DESIGN_PROPOSAL.md` and required a migration-first approach suitable for a team environment.

## Decision

We chose **Prisma ORM** (v4+) for all database access and schema management.

## Rationale

### Pros of Prisma
- **Type safety** — Generated TypeScript client; queries catch errors at build time, not runtime
- **Schema-first** — `schema.prisma` is the single source of truth; migrations are generated from it
- **Migrations in version control** — Each schema change is a SQL migration file reviewed in PRs; easy to rollback or revert
- **Embedded tooling** — Prisma Studio (`npx prisma studio`) provides web UI for viewing/editing records; `prisma db` commands for schema management
- **NestJS integration** — `@nestjs/prisma` or custom `PrismaService` provides clean dependency injection
- **Relationship handling** — Fluent API for loading related data (e.g., `user.wallets({ include: { balances: true } })`)
- **Performance** — Queries are close to raw SQL; can use `$queryRaw` for complex aggregations
- **Multi-database support** — Same schema syntax works with PostgreSQL, MySQL, SQLite (useful for testing)

### Cons of Prisma
- **Opinionated schema** — Some constraints (e.g., many-to-many junction tables) follow Prisma conventions, not raw SQL
- **Not a query builder** — Limited support for complex queries; sometimes requires `$queryRaw` for advanced SQL
- **Vendor lock-in** — Schema syntax is Prisma-specific; switching ORMs requires rewriting migrations
- **N+1 query risk** — Easy to accidentally load related data inefficiently without explicit `include`
- **Cold starts** — Prisma client generation adds startup time (mitigated: negligible in practice)

### Alternatives considered

**TypeORM (Active Record / Data Mapper patterns):**
- Pros: More SQL-like; decorators for entity mapping; works with multiple databases
- Cons: More boilerplate (decorators, repositories); less intuitive migrations; weaker type safety
- **Rejected:** Prisma's schema-first approach and type generation are superior; less boilerplate

**Raw SQL / Query Builder (e.g., Knex.js):**
- Pros: Full control; no abstraction layer; fastest queries
- Cons: SQL everywhere; harder to refactor; no type safety; tedious to manage migrations manually
- **Rejected:** Too error-prone for financial transactions (balance updates require correctness); team prefers abstraction

**Sequelize (Node.js ORM):**
- Pros: Long-established, integrates with Express/NestJS
- Cons: Less intuitive API; weaker type support; migrations are cumbersome
- **Rejected:** Prisma's developer experience (Studio, type generation) is superior

**Entity Framework (C# / .NET):**
- Pros: Mature, powerful LINQ queries, great tooling
- Cons: Requires C# backend; breaks TypeScript alignment with frontend
- **Rejected:** Language incompatibility with Node.js stack

## Consequences

### Positive consequences
- **Type safety throughout** — Schema ↔ Database ↔ Application types are all aligned; errors caught at compile time
- **Safe schema evolution** — Migrations are tracked in version control; every change is reviewed and reversible
- **Developer confidence** — Prisma Studio lets developers explore data without SSH/SQL knowledge
- **Reduced bugs** — Generated client prevents typos in column names, table names; invalid relationships caught early
- **Maintenance** — Schema is self-documenting; relationships clear in `schema.prisma`
- **Testing** — Easy to write fixture seeders; Prisma plays well with test database resets

### Negative consequences / Risks
- **Complex queries** — Sometimes easier to write raw SQL than struggle with Prisma's query API; requires `$queryRaw` fallback
- **Migration conflicts** — Multiple developers working on schema simultaneously can cause migration file conflicts (mitigated: `npm run db:reset` rebuilds cleanly)
- **Learning curve** — Developers unfamiliar with Prisma need time to learn schema syntax and generated client API
- **Compile-time overhead** — Schema changes require `prisma generate` or `prisma db push` before code compiles

### Mitigation strategies
- **Schema discipline** — Schema reviews in PRs enforce consistency (naming, relationships, constraints)
- **Prisma Studio** — Developers use Studio instead of raw SQL for exploration; reduces friction
- **Raw SQL escapes** — For complex queries, use `$queryRaw(Prisma.sql``)` with tagged templates for SQL injection protection
- **Testing** — `npm run db:reset` quickly recovers from schema conflicts during development
- **Documentation** — `docs/DATABASE_DESIGN_PROPOSAL.md` explains schema rationale; Prisma docs are excellent

## Related ADRs

- [0001: PostgreSQL](./0001-postgresql-relational-model.md) — Database choice; Prisma manages PostgreSQL schema
- [0002: NestJS](./0002-nestjs-backend-framework.md) — Backend framework; Prisma integrates cleanly via `PrismaService`

## References

- Prisma docs: https://www.prisma.io/docs/
- Schema design: [`docs/DATABASE_DESIGN_PROPOSAL.md`](../DATABASE_DESIGN_PROPOSAL.md)
- NestJS + Prisma: https://docs.nestjs.com/recipes/prisma
- Setup: [`CLAUDE.md` § Quick start](../../CLAUDE.md#quick-start)
