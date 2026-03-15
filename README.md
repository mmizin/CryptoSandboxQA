# CryptoSandboxQA

Crypto exchange training platform for QA practice. Simulate trades, validate transactions, and test automation on a safe environment.

## Tech Stack

- **Backend**: NestJS (TypeScript), Prisma, PostgreSQL, Socket.IO
- **Frontend**: Next.js (React), Zustand, Socket.IO client

## Quick Start

Clone the repo, `cd` into it, and run these commands (from project root):

```bash
# 1. Install dependencies (root + backend + frontend)
npm install

# 2. Start PostgreSQL (Docker)
npm run db:up

# 3. Setup DB & create .env (one-time)
npm run setup

# 4. Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register. Done!

### Prerequisites

- **Node.js** 18+
- **Docker** (for PostgreSQL) — or use a local PostgreSQL instance and set `DATABASE_URL` in `.env`

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

To stop and remove the database container (data in volumes **persists**):

```bash
npm run db:down
```

**Reset database** (removes all data, including volumes):

```bash
npm run db:reset
```

After `db:reset`, run `db:up` then `setup` to start fresh.

**Seed demo data** (demo users with wallets, tickers):

```bash
npm run db:seed
```

Creates `demo@example.com` / `password123` and `qa@example.com` / `qa123` with BTC, ETH, USD wallets. Run after `setup` when you want reproducible sample data. Safe to run multiple times (skips existing users).

Or install PostgreSQL locally and ensure a database `cryptosandbox` exists.

### 3. Setup (creates `.env` + runs migrations)

```bash
npm run setup
```

This script:

- Copies `.env.example` → `.env` (only if `.env` doesn't exist)
- Waits for PostgreSQL to be ready
- Runs Prisma migrations
- Generates Prisma client

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

1. Register at [http://localhost:3000/register](http://localhost:3000/register) — or run `npm run db:seed` for demo accounts (`demo@example.com` / `password123`, `qa@example.com` / `qa123`)
2. Login and deposit USD (training mode)
3. Go to Market to place orders
4. View order history

---

## Environment Variables

`.env` is auto-created from `.env.example` during `npm run setup`. Override these for custom setup:


| Variable              | Default                                                       | Description                |
| --------------------- | ------------------------------------------------------------- | -------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5432/cryptosandbox` | PostgreSQL connection      |
| `JWT_SECRET`          | `your-super-secret-jwt-key-change-in-production`              | JWT signing secret         |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`                                       | Backend API URL (frontend) |


---

### OpenAPI (Swagger)

Interactive API docs are available when the backend is running:

- **Swagger UI**: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- **OpenAPI JSON**: [http://localhost:3001/api/docs-json](http://localhost:3001/api/docs-json)

Use the Swagger UI "Authorize" button to add your JWT token (from login) to test protected endpoints.

See [ARCHITECTURE.md](ARCHITECTURE.md) for full architecture details.