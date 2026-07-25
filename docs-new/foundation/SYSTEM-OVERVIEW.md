# System Overview — CryptoSandboxQA

**Status:** Draft
**Source:** `ARCHITECTURE.md`, `CLAUDE.md`

## One-paragraph summary

CryptoSandboxQA is a NestJS backend + Next.js frontend application, backed by
PostgreSQL via Prisma, with Socket.IO realtime pricing. Users register, hold
per-asset balances (fiat and crypto), place spot/futures orders (limit,
market, stop) that lock funds, match FIFO against resting orders, and settle
into final balances. Deposits (fiat/crypto), withdrawals, internal transfers,
and portfolio views sit around this core. Admins can inspect any user's data
and impersonate them. An intentional simulated persistence delay
(`SIMULATED_PERSIST_DELAY_MS`) mimics real gateway/settlement lag, which is
part of the training design, not incidental latency.

## Top-level components

| Component | Role |
|---|---|
| Frontend (Next.js, port 3000) | User-facing UI: auth, trading, wallets, deposits, admin panels, charts |
| Backend (NestJS, port 3001) | REST API + Socket.IO gateway; owns all business logic and validation |
| PostgreSQL (via Prisma) | System of record for users, balances, orders, trades, deposits, sessions |
| SMTP (Mailpit in dev) | Transactional email: welcome, password reset, order status, deposit receipts |
| Socket.IO `/ticker` namespace | Realtime price broadcast to subscribed clients |

## Backend feature modules

See `ARCHITECTURE.md` § Backend application for the authoritative module
diagram and full list. Summary of what exists (also see `GLOSSARY.md` for
term definitions):

- **AuthModule** — registration, login, session management, password reset,
  2FA, admin bootstrap, impersonation
- **UsersModule** — profile CRUD, admin bulk export
- **WalletsModule** — per-asset balances, locking, internal transfer,
  withdrawal
- **OrdersModule** — order lifecycle, matching, settlement, stop-order data
- **TickersModule** / **WebSocketModule** — price data and realtime broadcast
- **DepositsModule** / **PaymentMethodsModule** — fiat/crypto funding
- **PortfolioModule** — aggregated holdings views
- **TransactionsModule** — unified history endpoints
- **MetricsModule** — Prometheus `/metrics`

## Core data flow: the order lifecycle

This is the mechanic every trading-related feature depends on (detailed in
`CLAUDE.md` and `DOMAIN-MODEL.md`):

1. Validate order (amount, price, balance sufficiency)
2. Lock funds (`user_balances.balance_locked`) — sell locks base asset qty,
   buy locks quote value
3. Wait `SIMULATED_PERSIST_DELAY_MS` (simulated settlement lag)
4. Write order to database
5. Match via FIFO (`MatchingService`) against resting opposite-side orders
6. Settle matched trades — move locked funds to final owner
   (`WalletsService.settle*InTx`)

Every lock/unlock/fill is logged in `balance_transactions`, which is the
audit trail QA scenarios are built to inspect.

## Cross-cutting concerns

- **Admin inspection** — every major domain (wallets, orders, deposits,
  portfolio, transactions) has an admin-only read endpoint mirroring the
  user-facing one, plus impersonation to act as any user.
- **Transactional email** — welcome, password reset code, order status
  changes, deposit receipts; falls back to backend log output when no SMTP
  host is configured.
- **Realtime pricing** — all live-price-dependent UI (charts, stop-order
  triggers, dashboard) subscribes to the same `/ticker` Socket.IO namespace.

## Related

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — full module breakdown, ER
  detail, mermaid diagrams
- [`FEATURES_INVENTORY.md`](../../FEATURES_INVENTORY.md) — feature-by-feature
  detail (endpoints, DTOs, files)
- [`DOMAIN-MODEL.md`](DOMAIN-MODEL.md) — entity relationships
- [`C4-CONTEXT.md`](C4-CONTEXT.md) — system boundary diagram
