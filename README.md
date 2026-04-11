# CryptoSandboxQA

**Crypto exchange training sandbox for QA** — practice manual exploration, API checks, and browser automation without real funds. Simulate trades, validate transactions, and sharpen testing skills in a safe, full-stack environment.

*Stack:* NestJS · Next.js · PostgreSQL · Prisma · Socket.IO · Playwright (E2E in-repo)

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Documentation](#documentation)
- [Testing & automation](#testing--automation)
- [Docker Compose (full stack with observability)](#docker-compose-full-stack-with-observability)
- [Docker Compose (Jira)](#docker-compose-jira)
- [Detailed setup](#detailed-setup)
- [Usage](#usage)
- [Password reset & Mailpit (dev)](#password-reset--mailpit-dev)
- [Environment variables](#environment-variables)
- [OpenAPI (Swagger)](#openapi-swagger)

## Tech stack

- **Backend**: NestJS (TypeScript), Prisma, PostgreSQL, Socket.IO
- **Frontend**: Next.js (React), Zustand, Socket.IO client
- **Dev mail**: [Mailpit](https://mailpit.axllent.org/) (Docker) — local SMTP + inbox UI for **transactional email**: password reset (8-digit codes), **welcome** after register / register-with-profile, **order** open / filled / canceled (incl. maker filled on match), and **fiat & crypto deposit** receipts (deposits API and training wallet credits)

## Quick start

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

## Documentation

| Doc | What it is |
|-----|------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Repository layout, Nest modules, auth, realtime, env loading, and how pieces fit together. |
| [docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md) | Purpose-built QA surfaces: `data-testid` maps, client/API validation, Mailpit flows, iframe practice, Portfolio Analytics, simulated delays, Markets modals. |
| [docs/openapi.json](docs/openapi.json) | Static OpenAPI spec (import into Postman, Insomnia, etc.) without running the backend. |
| [docs/API_DESIGN_PLAN.md](docs/API_DESIGN_PLAN.md) | Design-time API notes and history (see banner in file; current behavior is in ARCHITECTURE and Swagger). |
| [docs/DATABASE_DESIGN_PROPOSAL.md](docs/DATABASE_DESIGN_PROPOSAL.md) | Schema rationale and history; **source of truth** for tables is `backend/prisma/schema.prisma`. |
| [LICENSE](LICENSE) | License for the project. |

This [README](#cryptosandboxqa) is the entry point; use the table of contents above to jump to setup, testing, and env reference.

---

## Testing & automation

Use the running app plus the artifacts below to practice **manual**, **API**, **email**, **E2E**, and **performance** testing.

- **Browser E2E (Playwright)** — The repo includes [`tests/ui-tests/`](tests/ui-tests/) (`@playwright/test`, Allure reporter in [`playwright.config.ts`](tests/ui-tests/playwright.config.ts)). From the project root, install and run:

  ```bash
  cd tests/ui-tests
  npm install
  cp .env.example .env   # optional: set PLAYWRIGHT_BASE_URL / BASE_URL (default http://localhost:3000)
  npx playwright test
  ```

  Config loads the **repository root** `.env` first, then **`tests/ui-tests/.env`** (overrides). Start the app (`npm run dev` from the repo root) before running tests. Contributors can align tags (`@smoke`, `@merge-gate`, `@client-validation`) with [`.cursor/rules/playwright-ui-tests.mdc`](.cursor/rules/playwright-ui-tests.mdc).

- **API contract testing** — Interactive [Swagger UI](http://localhost:3001/api/docs) when the backend is up; static spec in [`docs/openapi.json`](docs/openapi.json). Regenerate after API changes: `npm run openapi:generate` (see [OpenAPI (Swagger)](#openapi-swagger)).

- **Transactional email** — [Mailpit](http://localhost:8025) for password reset, welcome, orders, deposits. Configure SMTP in the repo root `.env` (see [Password reset & Mailpit](#password-reset--mailpit-dev)).

- **Load / metrics** — `npm run stack:up` exposes Prometheus and Grafana for scraping and dashboards (see [Docker Compose](#docker-compose-full-stack-with-observability)).

Hands-on feature catalog for selectors and flows: **[docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md)**.

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
| **Mailpit** | http://localhost:8025 | Dev SMTP inbox (transactional mail); SMTP to `localhost:1025` |
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

## Docker Compose (Jira)

Optional **[Jira Software](https://www.atlassian.com/software/jira)** (official `atlassian/jira-software` image) with a **dedicated PostgreSQL** container for local QA or process practice. This is **not** the application database (`cryptosandbox`).

**Start** (also starts unprofiled services such as Postgres + Mailpit if they are not already running):

```bash
npm run jira:up
# or: docker compose --profile jira up -d
```

**Stop** Jira and its database container:

```bash
npm run jira:down
# or: docker compose --profile jira down
```

| Item | Detail |
|------|--------|
| **URL** | http://localhost:8080 (override with `JIRA_HTTP_PORT` in `.env`) |
| **First run** | Open the URL and complete Atlassian setup (admin user, **evaluation/trial** license when prompted). First startup can take several minutes. |
| **Resources** | The Jira container is capped at **3 GiB** RAM with a **2048 MiB** JVM heap; allow enough Docker Desktop / host memory. |
| **Data** | Named volumes persist Jira home and Jira Postgres data across `jira:down`. **`npm run db:reset`** removes **all** Compose project volumes, including Jira’s, if they exist. |

Configure database user, password, DB name, and HTTP port via `.env` — see [Environment variables](#environment-variables) (`JIRA_*`).

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
6. **Other mail (with SMTP / Mailpit):** after **register**, **place/cancel/fill orders**, or **deposit** fiat/crypto (or training credit), check Mailpit for the matching notification — or the API log if `SMTP_HOST` is unset (same behavior as reset; see [Password reset & Mailpit](#password-reset--mailpit-dev)).

For a structured list of QA surfaces and skills, see **[docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md)** and [Testing & automation](#testing--automation) above.

---

## Password reset & Mailpit (dev)

Mailpit and `SMTP_*` / `MAIL_FROM` drive **all** backend mail: reset codes, welcome, order updates, and deposit receipts ([`MailService`](backend/src/mail/mail.service.ts) via [`MailModule`](backend/src/mail/mail.module.ts)).

| Step | What to do |
|------|------------|
| 1 | Run `npm run db:up` (starts **Postgres + Mailpit**). Open [http://localhost:8025](http://localhost:8025). |
| 2 | In **repo root** `.env`, set `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false` (see [`.env.example`](.env.example)). Restart `npm run dev` after editing. |
| 3 | Use **Forgot password** only for emails that **exist** in `users` (e.g. registered or seeded accounts). The API always returns the same success text even for unknown emails — no mail is sent in that case. |
| 4 | Read the code in Mailpit, then finish on `/reset-password`. |

- **No SMTP:** leave `SMTP_HOST` unset — the backend **logs** the full message (reset codes, welcome, order, deposit bodies — each prefixed in logs); check the terminal running the API.
- **Typo trap:** the variable must be **`SMTP_HOST`**, not `MTP_HOST`.
- **Transactional mail checklist:** [docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md) § *Transactional email (welcome, orders, deposits)*.
- **Details:** [ARCHITECTURE.md](ARCHITECTURE.md) (password reset, transactional mail, env loading), [docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md) (API, troubleshooting, automation).

---

## Environment Variables

`.env` is auto-created from `.env.example` during `npm run setup`. Override these for custom setup:


| Variable              | Default                                                       | Description                                                         |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5432/cryptosandbox` | PostgreSQL connection                                               |
| `JWT_SECRET`          | `your-super-secret-jwt-key-change-in-production`              | JWT signing secret                                                  |
| `ADMIN_API_KEY`       | *(empty)*                                                     | Required for `POST /auth/admin/register`. Set a strong value in prod |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`                                       | Backend API URL (frontend)                                          |
| `SMTP_HOST` | *(unset)* | If set (e.g. `localhost`), nodemailer sends **transactional** mail (password reset, welcome, order status, deposit receipts). With Mailpit + `db:up`: host `localhost`, port **1025**. |
| `SMTP_PORT` | `587` if using generic SMTP; **1025** for Mailpit | Mailpit SMTP port (host machine). |
| `SMTP_SECURE` | *(omit or `false` for Mailpit)* | Use `true` only for TLS-on-connect setups. |
| `SMTP_USER` / `SMTP_PASS` | *(unset)* | Optional; Mailpit usually needs no auth. |
| `MAIL_FROM` | *(see `.env.example`)* | `From:` for all transactional emails. |
| `PASSWORD_RESET_CODE_PEPPER` | falls back to `JWT_SECRET` | Optional extra secret for hashing reset codes. |
| `MAILPIT_HTTP_PORT` / `MAILPIT_SMTP_PORT` | `8025` / `1025` | Published ports for the `mailpit` Compose service. |
| `JIRA_POSTGRES_USER` / `JIRA_POSTGRES_PASSWORD` / `JIRA_POSTGRES_DB` | `jira` / `jira` / `jira` | Jira-only Postgres (Compose profile `jira`); not the app DB. |
| `JIRA_HTTP_PORT` | `8080` | Host port for the Jira web UI (`npm run jira:up`). |

Put SMTP and secrets in the **repository root** `.env` when using `npm run dev` — Nest loads it even though the API process cwd is `backend/`. See [ARCHITECTURE.md](ARCHITECTURE.md).


---

## OpenAPI (Swagger)

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

See [ARCHITECTURE.md](ARCHITECTURE.md) for full architecture details. For the documentation index and testing overview, see [Documentation](#documentation) and [Testing & automation](#testing--automation) at the top of this README.