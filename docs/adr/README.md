# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) — a lightweight method for capturing important architectural decisions and their rationale.

## What is an ADR?

An ADR documents:
- **The decision** — what we chose and why
- **The context** — the problem we were solving
- **The status** — accepted, deprecated, superseded, etc.
- **The consequences** — trade-offs and implications

ADRs are **versioned with the code**, **reviewed in PRs**, and serve as tribal knowledge for future maintainers.

## Format

We use the [MADR 2.1 format](https://adr.github.io/madr/) — lightweight, markdown-only, git-friendly.

## File naming

```
NNNN-kebab-case-title.md
```

Where `NNNN` is a zero-padded decision number (e.g., `0001`, `0042`).

## How to create a new ADR

1. **Copy the template:** Use [`0000-template.md`](./0000-template.md) as your starting point
2. **Fill in the sections:** Context, decision, rationale, consequences
3. **Mark status:** Usually `Accepted` for new decisions
4. **Get reviewed:** Include in your PR for architectural feedback
5. **Commit:** ADRs are committed alongside code changes

## Current decisions

| # | Title | Status |
|---|-------|--------|
| [0001](./0001-postgresql-relational-model.md) | PostgreSQL for relational data and ACID compliance | Accepted |
| [0002](./0002-nestjs-backend-framework.md) | NestJS as backend framework | Accepted |
| [0003](./0003-prisma-orm.md) | Prisma ORM for database access | Accepted |
| [0004](./0004-nextjs-frontend-framework.md) | Next.js for frontend | Accepted |
| [0005](./0005-socket-io-realtime.md) | Socket.IO for realtime updates | Accepted |
| [0006](./0006-playwright-ui-testing.md) | Playwright for UI testing | Accepted |
| [0007](./0007-pytest-backend-testing.md) | pytest for backend API testing | Accepted |

## ADR workflow

### When to write an ADR
- **Major framework/library choices** (backend, frontend, testing)
- **Data storage decisions** (database type, schema design patterns)
- **Integration patterns** (auth, realtime, API design)
- **Testing strategy** (frameworks, patterns, coverage)
- **Significant rewrites or deprecations** (framework upgrades, replacing established patterns)

### When NOT to write an ADR
- Bug fixes
- Small refactors
- Performance optimizations without architectural change
- Local development tooling

### Updating ADRs

If a decision is **superseded** or **deprecated**:
1. Change the `Status` to `Superseded by [0042](./0042-new-approach.md)` or `Deprecated`
2. Link to the new ADR
3. Create a new ADR with the updated decision
4. Both records stay in history

## Review checklist

When reviewing an ADR in a PR:

- [ ] **Context is clear** — Why did we need to make this choice?
- [ ] **Decision is specific** — What exactly did we choose?
- [ ] **Rationale explains trade-offs** — What were the alternatives? Why this one?
- [ ] **Consequences are realistic** — What does this commit us to?
- [ ] **Status is appropriate** — Is this accepted, tentative, pending?
- [ ] **Linked properly** — Does it reference related ADRs?

## Quick links

- **ARCHITECTURE.md** — System overview, module structure, data flows
- **DATABASE_DESIGN_PROPOSAL.md** — Schema, constraints, relationships
- **API_DESIGN_PLAN.md** — Endpoint conventions, request/response patterns
- **CODE_STYLE_READABILITY.md** — Naming, patterns, examples
