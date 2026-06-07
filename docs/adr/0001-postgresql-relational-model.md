# Use PostgreSQL as the primary relational database

**Status:** Accepted

**Date:** 2024-03-01

## Context

CryptoSandboxQA is a financial trading platform where correctness and data integrity are critical. Users trade virtual assets, manage balances, and execute orders that must be settled atomically. We needed to choose a database system that could:

- Enforce ACID guarantees for financial transactions
- Handle complex relational queries (users → wallets → balances → orders)
- Support migrations and schema versioning in a team environment
- Provide reliable backups and recovery
- Allow introspection during development (e.g., Prisma Studio)

The project started with schema-first design documented in `docs/DATABASE_DESIGN_PROPOSAL.md`, which assumes relational integrity constraints.

## Decision

We chose **PostgreSQL** as the primary relational database.

## Rationale

### Pros of PostgreSQL
- **ACID compliance** — Strong guarantees for balance updates and order settlement (critical for financial correctness)
- **Relational integrity** — Foreign keys, constraints, and complex joins prevent data inconsistencies
- **Migrations** — Schema versioning fits naturally with Prisma and version control
- **Rich query language** — SQL handles complex reporting (e.g., portfolio analytics, order history)
- **Open source & free** — No licensing costs; widely adopted; excellent community support
- **Development tooling** — Prisma Studio, pgAdmin, psql introspection make debugging easier
- **Observability** — pg_stat_statements, query logs help identify bottlenecks

### Cons of PostgreSQL
- **Vertical scaling focus** — Not designed for horizontal sharding (acceptable for this training platform)
- **Operational overhead** — Requires backup/recovery planning (mitigated by Docker Compose in dev)
- **Not schema-less** — Requires migrations for schema changes (mitigated: this is a feature, not a bug)

### Alternatives considered

**MongoDB (NoSQL document store):**
- Pros: Flexible schema, horizontal scaling, good for unstructured data
- Cons: No ACID multi-document transactions in older versions; weaker consistency guarantees; harder to enforce balance/order invariants; requires application-level validation
- **Rejected:** Financial transactions require strong ACID guarantees and relational integrity that MongoDB's eventual consistency cannot reliably provide

**SQLite (Embedded SQL):**
- Pros: Zero setup, file-based, works offline
- Cons: No concurrent writes; no multi-user; poor performance at scale; no network access (required for Docker-based deployment)
- **Rejected:** Not suitable for multi-user web application; lacking concurrent write capability

**Firebase (Managed NoSQL):**
- Pros: Managed, automatic scaling, good for real-time sync
- Cons: Vendor lock-in; expensive at scale; difficult to enforce complex constraints; limited query flexibility
- **Rejected:** Not aligned with self-hosted, on-premises training platform goals

## Consequences

### Positive consequences
- Strong data integrity — balance and order invariants are enforced at the database level
- Confidence in financial correctness — atomic transactions guarantee no phantom balance updates
- Clear schema evolution — Prisma migrations are reviewed in PRs, visible to the team
- Developer experience — Prisma Studio and psql make data inspection straightforward
- Compatibility with Prisma — Type-safe queries reduce runtime errors

### Negative consequences / Risks
- Operational responsibility — Must plan backups, monitor disk space, manage connections
- Migration overhead — Schema changes require careful planning (usually run during dev; on production, coordinate with team)
- Vertical scaling limits — Not designed for horizontal sharding (acceptable for a training platform with ~100-1000 concurrent users)

### Mitigation strategies
- **Backups:** Docker Compose includes `docker compose cp` and volume backup scripts in `scripts/`
- **Monitoring:** Prometheus + Grafana stack (`npm run stack:up`) exposes `pg_exporter` metrics
- **Local reset:** `npm run db:reset` quickly recovers from dev mistakes; data is not precious in dev
- **Testing:** Schema changes tested via pytest before merge; Prisma migrations validated in CI

## Related ADRs

- [0003: Prisma ORM](./0003-prisma-orm.md) — Chosen ORM for PostgreSQL access
- [0005: Socket.IO Realtime](./0005-socket-io-realtime.md) — Complements database with real-time ticker updates

## References

- Schema design: [`docs/DATABASE_DESIGN_PROPOSAL.md`](../DATABASE_DESIGN_PROPOSAL.md)
- Setup guide: [`CLAUDE.md` § Database setup](../../CLAUDE.md#quick-start)
- Prisma docs: https://www.prisma.io/docs/
