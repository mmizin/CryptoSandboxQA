---
name: db-manage
description: >-
  Guided database workflow for CryptoSandboxQA: dump, reset, restore, seed, and status.
  Use when the user asks to reset the database, restore a dump, seed demo users, or check
  DB state. Prevents accidental data loss from running db:reset without dumping first.
disable-model-invocation: true
---

# Database management

When the user invokes `/db-manage $ARGUMENTS`, run the appropriate workflow below.

## Workflows

### `dump` — save current DB state

```bash
npm run db:dump
```

Saves to `data/postgres-dump.sql` (idempotent; overwrites previous dump).

### `reset` — full reset (DESTRUCTIVE)

This destroys all data in Docker volumes. Always ask the user to confirm, and offer to dump first:

1. Offer: "Do you want to dump the current DB before resetting? (`npm run db:dump`)"
2. If yes: `npm run db:dump`
3. Then reset:
   ```bash
   npm run db:reset    # stops containers + removes volumes
   npm run db:up       # restart Postgres + Mailpit
   npm run setup       # migrate, seed baseline data, restore dump if present
   ```

### `restore` — restore from dump

```bash
npm run db:restore
```

Restores `data/postgres-dump.sql` into the running Postgres container. Requires the DB to be up (`npm run db:up`).

### `seed` — add demo accounts

```bash
npm run db:seed
```

Creates `demo@example.com` / `password123` and `qa@example.com` / `qa123` (idempotent — safe to re-run).

### `status` — check what's running

```bash
docker ps --filter "name=cryptosandbox" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Reports which containers (Postgres, Mailpit, backend, Prometheus, Grafana) are running.

### `up` — start DB containers only

```bash
npm run db:up
```

Starts Postgres (port 5432) and Mailpit (SMTP 1025, UI 8025).

### `down` — stop containers (preserve data)

```bash
npm run db:down
```

Stops containers but keeps volumes (data is preserved).

## Notes

- `npm run db:reset` removes volumes — data is gone unless you dumped first.
- `npm run setup` auto-restores from `data/postgres-dump.sql` if that file exists.
- Prisma Studio: `cd backend && npm run prisma:studio` opens at `http://localhost:5555`.
