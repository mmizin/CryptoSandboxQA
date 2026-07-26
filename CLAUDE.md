# CLAUDE.md

Guidance for working in CryptoSandboxQA — a full-stack crypto exchange sandbox for QA training.

**Stack:** NestJS backend (port 3001), Next.js frontend (port 3000), PostgreSQL, Prisma ORM, Socket.IO realtime. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for full module breakdown.

## Quick start

**One-time setup:**
```bash
npm install
npm run db:up                # Start PostgreSQL + Mailpit
npm run setup                # Copy .env, run migrations, seed baseline
```

**Daily development:**
```bash
npm run dev                  # Concurrent backend + frontend
npm run db:down              # Stop containers (keep volumes)
npm run db:reset             # Full reset with volume deletion
npm run db:seed              # Seed demo users beyond baseline
npm run db:migrate           # Interactive Prisma migrations
npm run prisma:studio        # Inspect database (localhost:5555)
npm run openapi:generate     # Regenerate OpenAPI spec after API changes
npm run stack:up             # Full stack with Prometheus + Grafana
npm run stack:down           # Stop observability stack
```

## How to work here

**1. State assumptions explicitly.** Don't assume. Surface tradeoffs immediately. Ask if unclear. For non-trivial changes, create a plan file.

**2. Simplicity first.** Minimum code that solves the problem. No speculative features, abstractions for single-use, error handling for impossible scenarios, or "flexibility" that wasn't requested.

**3. Surgical changes only.** Touch only what your task requires. Don't "improve" adjacent code, refactor unrelated modules, or delete pre-existing dead code (mention it instead). Your test: every changed line traces to the user's request.

**4. No auto-commits.** Wait for explicit instruction before committing or pushing.

## Key patterns & non-obvious behavior

**Order lifecycle & locking:** Order creation validates amounts and balance, locks funds in `user_balances.balance_locked` (sell order locks base qty; buy order locks quote value ≈ qty × limit price, or market price for market buys), waits `SIMULATED_PERSIST_DELAY_MS` (default 1200ms, env var — set to 0 for fast tests), writes to DB, matches orders via FIFO, settles via `WalletsService.settle*InTx` (moves locked → available). Lock/unlock events logged in `balance_transactions` as `order_lock` / `order_unlock` records. This mechanics is **critical for testing** — verify balances before and after order flows.

**Stop orders:** Stored on backend with `stop_price` field. Buy stop triggers when `price >= stopPrice`; sell stop when `price <= stopPrice`, then converts to market order. **Frontend must stay open** — no server-side trigger. See `.claude/rules/frontend.md` for frontend implementation details.

**Simulated persistence delay:** Intentional training UX. Orders and deposits wait `SIMULATED_PERSIST_DELAY_MS` (default 1200ms) between validation and DB write, mimicking gateway/settlement lag. Set `SIMULATED_PERSIST_DELAY_MS=0` in `.env` to disable for fast test loops.

**Admin operations:** Impersonate a user: `POST /auth/impersonate` (body: `userId`) returns JWT for that user; `POST /auth/end-impersonation` restores. Bulk import users: `POST /auth/admin/bulk-import-users` (multipart) accepts CSV or JSON with same columns as single create. Query user data: `GET /admin/users/:userId/wallets`, `/orders`, `/deposits`, `/portfolio`, `/transactions`, etc.

**Email & SMTP:** If `SMTP_HOST` unset, `MailService` logs message body to backend terminal instead of sending. For Mailpit (SMTP mock): set `SMTP_HOST=localhost SMTP_PORT=1025` in repo-root `.env`. Mailpit UI at `localhost:8025`.

## Common workflows

See `.claude/rules/backend.md` for API endpoint and Prisma workflows.

**Inspect the database:**
- Interactive: `cd backend && npm run prisma:studio` → `http://localhost:5555` (web UI to view/edit all records)
- Direct query: `docker exec crypto-postgres psql -U postgres` (requires SQL knowledge; useful for complex queries)
- Check current balances: `SELECT user_id, asset, balance, balance_locked FROM user_balances;`

**Create and manage admin users:**
- Create: `POST /auth/admin/create-user` (requires `ADMIN_API_KEY` in `.env`); payload matches single user create DTO
- Impersonate: `POST /auth/impersonate` (body: `{ userId: "..." }`) → returns JWT for that user (no password needed); `POST /auth/end-impersonation` to restore
- List: `GET /users` (admin-only endpoint, returns paginated users)
- Export: `GET /users/bulk/export?format=json&limit=100` (exports user data without passwords)
- Bulk import: `POST /auth/admin/bulk-import-users` (multipart, CSV/JSON with same columns: email, password, firstName, lastName, username, etc.)

## Git workflow

- **Branch naming:** `type/description` (e.g. `feat/stop-orders`, `fix/order-lock`, `test/deposit-validation`)
- **No auto-commit:** Wait for explicit instruction before committing
- **PRs target `master`:** Don't merge until user approves
- **After merge:** `git fetch origin && git checkout master && git pull origin master`, then delete the feature branch
- **One branch at a time:** Ask before switching branches mid-work

## Knowledge base

Most-used references:
- **Architecture & modules:** [`ARCHITECTURE.md`](ARCHITECTURE.md) — backend module diagrams, frontend stack, data flows
- **API design:** [`docs/architecture/history/API_DESIGN_PLAN.md`](docs/architecture/history/API_DESIGN_PLAN.md) — endpoint conventions, request/response shapes
- **Database schema:** [`docs/architecture/history/DATABASE_DESIGN_PROPOSAL.md`](docs/architecture/history/DATABASE_DESIGN_PROPOSAL.md) — table relationships, constraints
- **Code style:** [`docs/engineering/CODE_STYLE_READABILITY.md`](docs/engineering/CODE_STYLE_READABILITY.md) — naming, patterns, examples
- **OpenAPI spec:** [`openapi.json`](openapi.json) — regenerate with `npm run openapi:generate` after API changes

## Troubleshooting & common issues

**Port conflicts:** Backend wants 3001, frontend wants 3000, Postgres wants 5432, Mailpit wants 1025. If already in use, check `npm run db:down` or kill processes. `lsof -i :3001` on macOS/Linux.

**Migrations failing:** If `npm run prisma:migrate` fails, check that migrations are in `backend/prisma/migrations/` and database is running (`npm run db:up`). Can't rollback in `db push` mode; use `db reset` for local dev.

**Balance mismatches:** Orders lock funds in `balance_locked`. Verify flow: locked → DB write → match → settle. Check `balance_transactions` table for `order_lock` / `order_unlock` / `order_fill` events. If balance seems wrong, inspect via Prisma Studio.

**Email not sending:** If `SMTP_HOST` is unset, mail goes to backend logs, not inbox. Check backend terminal or add Mailpit: `SMTP_HOST=localhost SMTP_PORT=1025` in `.env`.

**Schema out of sync:** After pulling code with Prisma changes, run `npm run db:migrate` (if migrations exist) or `npm run setup` (if using `db push`).

## Policies

- **No refactoring of unrelated code.** If adjacent code looks bad, mention it in your summary — don't fix it.
- **Commit only on explicit request.** Never commit or push without being asked.
