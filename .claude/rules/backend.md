---
description: Backend API patterns, NestJS workflows, and database management
paths:
  - "backend/**/*"
---

# CLAUDE.md — Backend

Guidance for working with the backend in CryptoSandboxQA.

## Environment loading (non-obvious)

NestJS loads **repo-root `.env` first**, then `backend/.env` (overrides). Put `DATABASE_URL` and `SMTP_*` in repo root, not just in `backend/` — `ConfigModule` walks up. Same pattern for Playwright (`tests/ui-tests/.env` overrides root) and pytest (`tests/backend_tests/.env` via `utils/env_loader.py`).

## Add a new API endpoint

1. Define request/response DTOs in `backend/src/[module]/dto/` using class-validator decorators (`@IsString()`, `@IsNumber()`, etc.)
2. Implement service method in `backend/src/[module]/[domain].service.ts` (contains business logic)
3. Add controller method with `@Get()`, `@Post()`, `@Put()` decorators in `backend/src/[module]/[domain].controller.ts`, include `@ApiOperation()`, `@ApiResponse()`, `@UseGuards(JwtAuthGuard)` for auth
4. Verify in Swagger UI (`http://localhost:3001/api/docs`) — swagger docs auto-generated from decorators
5. Write tests in `tests/backend_tests/tests/api/[domain]/test_*.py` using API client (`user.api.orders.create(...)`, etc.)
6. Run `npm run openapi:generate` to regenerate static spec (required before merging)

## Modify order validation or settlement

- Check `backend/src/orders/orders.service.ts` for creation, cancellation, settlement logic
- Check `backend/src/wallets/wallets.service.ts` for balance updates, settlement mechanics, lock/unlock
- Check `backend/prisma/schema.prisma` for `orders` table structure (`stop_price`, `filled_qty`, status fields)
- Verify order flow: validation → lock → delay → DB write → match → settle → update balances
- Test with `/run-backend-tests @orders` to ensure no regressions

## Prisma workflows

Local dev uses `prisma db push` (no migration files), done by `npm run setup`. For named migrations (pre-prod/prod): `cd backend && npm run prisma:migrate` (interactive, creates file in `prisma/migrations/`). Production deploys use `prisma migrate deploy` (applies pre-generated migrations). When you alter `prisma/schema.prisma`, always flag that `npm run prisma:migrate` is needed before the change works.
