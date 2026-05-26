# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CryptoSandboxQA is a full-stack crypto exchange training sandbox for QA practice. Stack: NestJS backend (port 3001), Next.js frontend (port 3000), PostgreSQL, Prisma ORM, Socket.IO; Playwright UI tests under `tests/ui-tests/`; pytest API tests under `tests/backend_tests/`.

## Setup and run

```bash
# One-time setup
npm install
npm run db:up        # start Postgres + Mailpit (Docker)
npm run setup        # copy .env, run migrations, seed baseline data

# Day-to-day
npm run dev          # backend + frontend
npm run stack:up     # full observability stack (+ Prometheus, Grafana)
```



## Environment loading (non-obvious)

NestJS loads **repo root `.env`** even though the backend process runs from `backend/` — `ConfigModule` walks up to the root. Do not put `DATABASE_URL` or `SMTP_*` only in `backend/.env`; put them in the repo-root `.env`.

Playwright loads: repo root `.env` → `tests/ui-tests/.env` (overrides).
pytest loads: repo root `.env` → `tests/backend_tests/.env` (overrides), via `utils/env_loader.py`.

## Non-obvious behavior

**Simulated persistence delay:** Orders and deposits wait `SIMULATED_PERSIST_DELAY_MS` (default 1200 ms) after validation but before the DB write — intentional training UX. Set `SIMULATED_PERSIST_DELAY_MS=0` to disable in tests.

**Order lock mechanics:** Placing an order locks funds in `user_balances.balance_locked` (sell → base qty; buy → quote value). Settlement via `WalletsService.settle*InTx`. The `balance_transactions` table records `order_lock` / `order_unlock` events.

**Email without SMTP:** If `SMTP_HOST` is not set, `MailService` logs the full message body to the backend terminal instead of sending. Add `SMTP_HOST=localhost` + `SMTP_PORT=1025` in root `.env` for Mailpit.

**Socket.IO realtime:** Ticker namespace is `/ticker`; frontend subscribes to last price + 24h volume per trading pair.

**Prisma migrations:** `npm run setup` uses `prisma db push` (no migration files) for local bootstrap. Use `prisma migrate dev` for named migrations; `prisma migrate deploy` for production.

## Architecture doc

@ARCHITECTURE.md

Update `ARCHITECTURE.md` in the same change set when meaningful system shape changes: new/removed NestJS modules or controllers, Prisma models or major fields, auth or realtime behavior, main frontend routes, observability, or OpenAPI workflow. Skip trivial fixes.

## Code style (applies to new and edited code)

@docs/CODE_STYLE_READABILITY.md
@docs/examples/code-style-templates.md

## Knowledge base

@knowledge/llm-wiki/wiki/00-START-HERE.md

Deep-dive references (read when the task touches that area):
- `docs/QA_TESTING_FEATURES.md` — test surfaces, selectors, form validation rules, timing quirks, iframe practice
- `docs/API_DESIGN_PLAN.md` — API design conventions and endpoint descriptions
- `docs/DATABASE_DESIGN_PROPOSAL.md` — DB schema rationale and table relationships
- `openapi.json` (repo root) — static OpenAPI spec; regenerate with `npm run openapi:generate`

## Git workflow

- **Branch naming:** `type/description` (e.g. `feat/2fa-login`, `test/orders-validation`, `fix/wallet-lock`).
- **Do not commit automatically** after finishing work — wait for explicit instruction.
- **PRs target `master`** unless told otherwise. Do not merge until the user explicitly approves.
- **After merge:** `git fetch origin && git checkout master && git pull origin master`, then delete the feature branch.
- **One feature branch at a time.** Ask before switching or starting another branch while work is in progress.

## Do not add tests unless explicitly asked

Do not create, extend, or modify automated tests unless the user explicitly requests it. This applies to all test types (unit, API, E2E).

## Backend: Prisma migration reminder

When a feature change adds or alters Prisma models, flag that `cd backend && npm run prisma:migrate` (interactive) is needed before the change can be used. Production uses `prisma migrate deploy`.

