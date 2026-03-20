# CryptoSandboxQA

Crypto exchange training platform for QA practice. Simulate trades, validate transactions, and test automation on a safe environment.

## Tech Stack

- **Backend**: NestJS (TypeScript), Prisma, PostgreSQL, Socket.IO
- **Frontend**: Next.js (React), Zustand, Socket.IO client
- **Dev mail**: [Mailpit](https://mailpit.axllent.org/) (Docker) — local SMTP + inbox UI for **password reset** 8-digit codes

## Quick Start

Clone the repo, `cd` into it, and run these commands (from project root):

```bash
# 1. Install dependencies (root + backend + frontend)
npm install

# 2. Start PostgreSQL + Mailpit (Docker)
npm run db:up

# 3. Setup DB & create .env (one-time)
npm run setup

# 4. Run the app
npm run dev

# 5. (Optional) Seed demo data (run after setup)
npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000) and register. Use demo accounts from step 5 if you ran the seed (`demo@example.com` / `password123`, etc.).

After `setup`, add **SMTP** lines to the **repository root** `.env` if you want reset emails in Mailpit (see [Password reset & Mailpit](#password-reset--mailpit-dev)). The backend startup log lists API, frontend, and Mailpit URLs.

### Prerequisites

- **Node.js** 18+
- **Docker** (for PostgreSQL) — or use a local PostgreSQL instance and set `DATABASE_URL` in `.env`

---

## Docker Compose (Full Stack with Observability)

Production-like stack for **load and performance testing**. Run the backend, PostgreSQL, Prometheus, and Grafana with one command:

```bash
npm run stack:up
# or: docker compose --profile observability up -d
```

To stop all services:

```bash
npm run stack:down
# or: docker compose --profile observability down
```

> **Tip:** `stack:up` includes PostgreSQL — you don't need `npm run db:up`. Use either **Quick Start** (db:up + dev for local backend/frontend) or **stack:up** (full stack in Docker) — not both at once.

| Service | URL | Description |
|---------|-----|-------------|
| **Mailpit** | http://localhost:8025 | Dev SMTP inbox (reset codes); SMTP to `localhost:1025` |
| **Backend API** | http://localhost:3001 | REST API |
| **Swagger** | http://localhost:3001/api/docs | Interactive API docs |
| **Metrics** | http://localhost:3001/metrics | Prometheus metrics (for scraping) |
| **Prometheus** | http://localhost:9090 | Metrics collection & queries |
| **Grafana** | http://localhost:3002 | Metrics visualization (login: admin/admin) |

**Mailpit** is an unprofiled Compose service: it starts with **`npm run db:up`** and with **`npm run stack:up`** (SMTP **:1025**, UI **:8025**).

**Validation checklist:**
1. Backend connects to database — `curl http://localhost:3001/` returns API info
2. Prometheus scrapes metrics — open http://localhost:9090/targets, target `backend` should be UP
3. Grafana connects to Prometheus — open http://localhost:3002, add a panel and query `up{job="backend"}`

Ports are configurable via `.env` (e.g. `BACKEND_PORT`, `PROMETHEUS_PORT`, `GRAFANA_PORT`). See [Environment Variables](#environment-variables).

---

## Detailed Setup

### 1. Install dependencies

```bash
npm install
```

Installs root, backend, and frontend dependencies (npm workspaces).

### 2. Start PostgreSQL

Using Docker (recommended):

```bash
npm run db:up
# or: docker compose up -d
```

To stop and remove the database container (data **persists** in named volume):

```bash
npm run db:down
```

Prompts to create a DB dump before stopping if the database has data.

**Reset database** (removes all data, including volumes):

```bash
npm run db:reset
```

After `db:reset`, run `db:up` then `setup` to start fresh. If you created a dump before reset, `setup` will automatically restore it.

> **Note:** If you have an existing database and pull schema changes that are incompatible (e.g. major schema redesign), run `db:reset` then `db:up` and `setup` to apply the new schema.

**Dump data** (save current DB state before reset, only if DB has data):

```bash
npm run db:dump
```

> **Requires `db:up` and `setup` first.** The database must be running with tables created.

Saves to `data/postgres-dump.sql`. Run before `db:reset` to preserve state.

**Restore from dump** (manual restore; also runs automatically during `setup` if dump exists):

```bash
npm run db:restore
```

> **Requires `db:up` and `setup` first.** Schema must exist before restoring data.

**Seed demo data** (demo users with wallets, tickers):

```bash
npm run db:seed
```

> **Requires `setup` first.** Run `npm run setup` before seeding to create the database schema.

Creates `demo@example.com` / `password123` and `qa@example.com` / `qa123` with BTC, ETH, USD wallets. Run after `setup` when you want reproducible sample data. Safe to run multiple times (skips existing users).

Or install PostgreSQL locally and ensure a database `cryptosandbox` exists.

### 3. Setup (creates `.env` + runs migrations)

```bash
npm run setup
```

> **Requires `db:up` first.** PostgreSQL must be running (Docker or local).

This script:

- Copies `.env.example` → `.env` (only if `.env` doesn't exist)
- Waits for PostgreSQL to be ready
- Runs Prisma migrations
- Generates Prisma client
- Restores from `data/postgres-dump.sql` if the file exists (e.g. after `db:reset`)

**No manual `.env` editing needed** — defaults work with the Docker Postgres.

### 4. Run the app

**Both backend and frontend** (recommended):

```bash
npm run dev
```

**Or separately:**

```bash
npm run backend:dev   # Backend on port 3001
npm run frontend:dev  # Frontend on port 3000
```

---

## Usage

1. Register at [http://localhost:3000/register](http://localhost:3000/register) — or run `npm run db:seed` (after `setup`) for demo accounts (`demo@example.com` / `password123`, `qa@example.com` / `qa123`)
2. Login and deposit USD (training mode)
3. Go to Market to place orders
4. View order history
5. **Forgot password:** [Forgot password?](http://localhost:3000/forgot-password) → get an **8-digit code** (Mailpit or backend log) → [reset password](http://localhost:3000/reset-password) → sign in with the new password

Hands-on fixtures for automation (iframe practice, password reset, etc.): **[docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md)**.

---

## Password reset & Mailpit (dev)

| Step | What to do |
|------|------------|
| 1 | Run `npm run db:up` (starts **Postgres + Mailpit**). Open [http://localhost:8025](http://localhost:8025). |
| 2 | In **repo root** `.env`, set `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false` (see [`.env.example`](.env.example)). Restart `npm run dev` after editing. |
| 3 | Use **Forgot password** only for emails that **exist** in `users` (e.g. registered or seeded accounts). The API always returns the same success text even for unknown emails — no mail is sent in that case. |
| 4 | Read the code in Mailpit, then finish on `/reset-password`. |

- **No SMTP:** leave `SMTP_HOST` unset — the backend **logs** the full message (including the code); check the terminal running the API.
- **Typo trap:** the variable must be **`SMTP_HOST`**, not `MTP_HOST`.
- **Details:** [ARCHITECTURE.md](ARCHITECTURE.md) (password reset & env loading), [docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md) (API, troubleshooting, automation).

---

## Environment Variables

`.env` is auto-created from `.env.example` during `npm run setup`. Override these for custom setup:


| Variable              | Default                                                       | Description                                                         |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5432/cryptosandbox` | PostgreSQL connection                                               |
| `JWT_SECRET`          | `your-super-secret-jwt-key-change-in-production`              | JWT signing secret                                                  |
| `ADMIN_API_KEY`       | *(empty)*                                                     | Required for `POST /auth/admin/register`. Set a strong value in prod |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`                                       | Backend API URL (frontend)                                          |
| `SMTP_HOST` | *(unset)* | If set (e.g. `localhost`), nodemailer sends **password reset** mail. With Mailpit + `db:up`: use host `localhost`, port **1025**. |
| `SMTP_PORT` | `587` if using generic SMTP; **1025** for Mailpit | Mailpit SMTP port (host machine). |
| `SMTP_SECURE` | *(omit or `false` for Mailpit)* | Use `true` only for TLS-on-connect setups. |
| `SMTP_USER` / `SMTP_PASS` | *(unset)* | Optional; Mailpit usually needs no auth. |
| `MAIL_FROM` | *(see `.env.example`)* | `From:` for reset emails. |
| `PASSWORD_RESET_CODE_PEPPER` | falls back to `JWT_SECRET` | Optional extra secret for hashing reset codes. |
| `MAILPIT_HTTP_PORT` / `MAILPIT_SMTP_PORT` | `8025` / `1025` | Published ports for the `mailpit` Compose service. |

Put SMTP and secrets in the **repository root** `.env` when using `npm run dev` — Nest loads it even though the API process cwd is `backend/`. See [ARCHITECTURE.md](ARCHITECTURE.md).


---

### OpenAPI (Swagger)

**For testers:** A static OpenAPI spec is available in the repo:

- **Static spec file**: [`docs/openapi.json`](docs/openapi.json) — use this for API testing tools (Postman, Insomnia, REST Assured, etc.). You can import it without running the backend.

Interactive API docs are available when the backend is running:

- **Swagger UI**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI JSON**: [http://localhost:3001/api/docs-json](http://localhost:3001/api/docs-json)

Use the Swagger UI "Authorize" button to add your JWT token (from login) to test protected endpoints.

**For developers:** After changing API routes or DTOs, regenerate the spec with:

```bash
npm run openapi:generate
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full architecture details.