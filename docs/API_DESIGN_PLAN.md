# CryptoSandboxQA — Backend API Design Plan

> **Historical / design-time document.** The NestJS backend has been extended since this plan was written. For **current** modules, routes, and behavior, see [ARCHITECTURE.md](../ARCHITECTURE.md), live Swagger at `/api/docs`, and [`docs/openapi.json`](openapi.json).

**Branch:** `feature/backend-api`  
**Status:** Retained for context — not an active approval gate; implemented behavior is documented in [ARCHITECTURE.md](../ARCHITECTURE.md).  
**Date:** March 16, 2025

---

## Technology Stack (Existing)

Per [ARCHITECTURE.md](../ARCHITECTURE.md), the project uses:

| Layer | Technology |
|-------|------------|
| **Backend** | NestJS (TypeScript) |
| **ORM** | Prisma |
| **Database** | PostgreSQL |
| **Auth** | JWT, bcrypt |

> **Note:** The task spec mentioned Express/Fastify; the codebase uses **NestJS** per architecture. This plan extends the existing NestJS backend.

---

# Step 1 — Backend Architecture Overview

## 1.1 Current State

The backend has the following modules:

| Module | Status | Notes |
|--------|--------|-------|
| AuthModule | ✅ Exists | Login, register, JWT. No logout, no 2FA. |
| UsersModule | ✅ Exists | Get profile, update profile. |
| WalletsModule | ✅ Exists | Generic deposit/withdraw (training mode). No fiat/crypto-specific flows. |
| OrdersModule | ✅ Exists | Create, cancel, list, get. No date range, no pagination. |
| TickersModule | ✅ Exists | Last price per symbol. |
| CryptosModule | ✅ Exists | List with search/filter/sort. No single crypto, no price history. |
| WebSocketModule | ✅ Exists | Ticker broadcast. |

## 1.2 Proposed Folder Structure

```
backend/
├── src/
│   ├── auth/                    # Auth, 2FA, sessions
│   ├── users/                   # User profile
│   ├── wallets/                 # Balances, simple deposit/withdraw (training)
│   ├── cryptos/                 # Cryptocurrency list, single, price history
│   ├── tickers/                 # Last price (existing)
│   ├── orders/                  # Orders + trading engine
│   ├── deposits/                # NEW: Fiat + Crypto deposit flows
│   ├── portfolio/               # NEW: Portfolio summary, asset allocation
│   ├── transactions/            # NEW: Unified transaction history
│   ├── payment-methods/         # NEW: Card/SEPA/Apple Pay (for fiat deposits)
│   ├── prisma/                  # Prisma service
│   ├── websocket/               # Ticker gateway
│   ├── common/                  # NEW: Shared pipes, guards, DTOs, validators
│   │   ├── pipes/               # Validation pipes
│   │   ├── guards/              # JWT, 2FA guards
│   │   └── filters/             # Exception filters (HTTP status mapping)
│   ├── config/                  # Config module (optional)
│   └── app.module.ts
```

## 1.3 Database Schema (Already Implemented)

The Prisma schema (`backend/prisma/schema.prisma`) already includes:

- **users**, **user_profiles**, **user_two_factor**, **user_sessions**
- **user_payment_methods**
- **assets**, **trading_pairs**, **tickers**
- **user_balances**, **balance_transactions**
- **orders**, **trades**
- **deposits_fiat**, **deposits_crypto**, **withdrawals**
- **cryptos**

No schema changes required for this plan; only new/modified endpoints and services.

## 1.4 Data Flow Overview

```
┌─────────────┐     HTTP/REST      ┌─────────────────────────────────────────┐
│   Frontend  │ ◄────────────────► │              Backend API                │
│  (Next.js)  │     WebSocket      │  Controllers → Services → Auth/Guards   │
└─────────────┘     (tickers)       └────────────────────┬──────────────────┘
                                                          │
                                                          ▼
                                                ┌─────────────────┐
                                                │    Prisma ORM   │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   PostgreSQL    │
                                                └─────────────────┘
```

---

# Step 2 — List of All API Endpoints

## 2.1 User Management

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Register user | — |
| POST | `/auth/login` | Login | — |
| POST | `/auth/logout` | Logout (invalidate session) | JWT |
| GET | `/users/me` | Get current user profile | JWT |
| PATCH | `/users/me` | Update profile (displayName, etc.) | JWT |

## 2.2 Authentication & 2FA

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/auth/2fa/setup` | Get 2FA setup (QR, secret) | JWT |
| POST | `/auth/2fa/enable` | Enable 2FA (with code) | JWT |
| POST | `/auth/2fa/disable` | Disable 2FA (with code) | JWT |
| GET | `/auth/2fa/backup-codes` | Get backup codes | JWT |
| POST | `/auth/2fa/backup-codes/regenerate` | Regenerate backup codes | JWT |
| POST | `/auth/2fa/verify` | Verify 2FA during login (tempToken + code) | — |

## 2.3 Cryptocurrencies

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/cryptos` | List cryptos (paginated, search, filter, sort) | — |
| GET | `/cryptos/:symbol` | Get single crypto by symbol | — |
| GET | `/cryptos/:symbol/price-history` | Get price history (from tickers/crypto_prices) | — |

## 2.4 Trading

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/orders` | Create order (market/limit) | JWT |
| POST | `/orders/:id/cancel` | Cancel order | JWT |
| GET | `/orders` | List orders (status, symbol, from, to, limit, offset) | JWT |
| GET | `/orders/:id` | Get order by ID | JWT |
| GET | `/orders/by-date` | Orders by date range | JWT |
| GET | `/orders/by-coin` | Orders by coin/symbol | JWT |

## 2.5 Portfolio

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/portfolio/balances` | User balances (all assets) | JWT |
| GET | `/portfolio/summary` | Portfolio summary (total value, per-asset) | JWT |
| GET | `/portfolio/allocation` | Asset allocation (pie-style) | JWT |

## 2.6 Deposits — Fiat

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/deposits/fiat` | Deposit USD/EUR (validate payment, create tx, update balance) | JWT |
| GET | `/deposits/fiat` | List fiat deposits (paginated, date range) | JWT |
| GET | `/deposits/fiat/:id` | Get deposit by ID | JWT |

## 2.7 Deposits — Crypto

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/deposits/crypto/address` | Generate wallet address for crypto (mock) | JWT |
| POST | `/deposits/crypto` | Create crypto deposit record (amount, wallet) | JWT |
| GET | `/deposits/crypto` | List crypto deposits | JWT |
| GET | `/deposits/crypto/:id` | Get deposit by ID | JWT |

## 2.8 Payment Methods (for fiat deposits)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/payment-methods` | List user payment methods | JWT |
| POST | `/payment-methods` | Add payment method (card/SEPA/Apple Pay) | JWT |
| DELETE | `/payment-methods/:id` | Remove payment method | JWT |
| PATCH | `/payment-methods/:id/default` | Set default | JWT |

## 2.9 Transactions (Unified)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/transactions` | Unified: deposits, withdrawals, trades | JWT |
| GET | `/transactions/deposits` | Deposit history | JWT |
| GET | `/transactions/trades` | Trading history | JWT |
| GET | `/transactions/withdrawals` | Withdrawal history (future) | JWT |

## 2.10 Wallets (Existing — Extend)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/wallets` | List all user balances | JWT |
| GET | `/wallets/:asset` | Get balance by asset | JWT |
| POST | `/wallets/deposit` | Simple deposit (training mode, existing) | JWT |
| POST | `/wallets/withdraw` | Simple withdraw (existing) | JWT |

---

# Step 3 — Request/Response Examples

## 3.1 User Management

### POST /auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "displayName": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

**Errors:** 400 (validation), 409 (email exists)

---

### POST /auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

**If 2FA required:**
```json
{
  "requires2FA": true,
  "tempToken": "short-lived-token-for-2fa-verify"
}
```

**Errors:** 401 (invalid credentials)

---

### POST /auth/logout

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{ "success": true }
```

---

### GET /users/me

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "profile": {
    "photoUrl": null,
    "username": null,
    "verificationStatus": "unverified"
  }
}
```

---

### PATCH /users/me

**Request:**
```json
{
  "displayName": "Jane Doe"
}
```

**Response (200 OK):** Same as GET /users/me

---

## 3.2 Two-Factor Authentication

### GET /auth/2fa/setup

**Response (200 OK):**
```json
{
  "qrCodeUrl": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

---

### POST /auth/2fa/enable

**Request:**
```json
{ "code": "123456" }
```

**Response (200 OK):**
```json
{ "success": true }
```

**Errors:** 400 (invalid code)

---

### POST /auth/2fa/verify (during login)

**Request:**
```json
{
  "tempToken": "from-login-response",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "...", "email": "...", "displayName": "..." }
}
```

---

## 3.3 Cryptocurrencies

### GET /cryptos?limit=20&offset=0&search=BTC&sortBy=volume24h&sortOrder=desc

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Bitcoin",
      "symbol": "BTC",
      "price": "97500",
      "change24h": "2.34",
      "volume24h": "48500000000",
      "popular": true
    }
  ],
  "total": 100
}
```

---

### GET /cryptos/BTC

**Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Bitcoin",
  "symbol": "BTC",
  "price": "97500",
  "change24h": "2.34",
  "volume24h": "48500000000",
  "popular": true
}
```

**Errors:** 404 (symbol not found)

---

### GET /cryptos/BTC/price-history?from=2025-01-01&to=2025-03-16&interval=1d

**Response (200 OK):**
```json
{
  "symbol": "BTC",
  "data": [
    { "timestamp": "2025-01-01T00:00:00Z", "price": "42000" },
    { "timestamp": "2025-01-02T00:00:00Z", "price": "43500" }
  ]
}
```

*Note: Price history may come from `crypto_prices` or `tickers` depending on schema. If no history table, return last price only or mock.*

---

## 3.4 Trading

### POST /orders

**Request:**
```json
{
  "symbol": "BTC_USD",
  "side": "buy",
  "type": "limit",
  "quantity": 0.001,
  "price": 50000
}
```

**Market order:** `"price"` omitted.

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "symbol": "BTC_USD",
  "side": "buy",
  "type": "limit",
  "quantity": "0.001",
  "price": "50000",
  "filledQuantity": "0",
  "status": "open",
  "trades": [],
  "createdAt": "2025-03-16T12:00:00Z"
}
```

**Errors:** 400 (validation, insufficient balance, invalid symbol)

---

### GET /orders?status=open&symbol=BTC_USD&from=2025-01-01&to=2025-03-16&limit=50&offset=0

**Response (200 OK):**
```json
{
  "data": [ /* order objects */ ],
  "total": 42
}
```

---

### GET /orders/by-date?from=2025-01-01&to=2025-03-16

Alias for `GET /orders` with date filters.

---

### GET /orders/by-coin?symbol=BTC_USD

Alias for `GET /orders?symbol=BTC_USD`.

---

## 3.5 Portfolio

### GET /portfolio/balances

**Response (200 OK):**
```json
{
  "balances": [
    {
      "asset": "USD",
      "available": "10000",
      "locked": "0",
      "total": "10000"
    },
    {
      "asset": "BTC",
      "available": "0.5",
      "locked": "0.1",
      "total": "0.6"
    }
  ]
}
```

---

### GET /portfolio/summary

**Response (200 OK):**
```json
{
  "totalValueUsd": "48750",
  "assets": [
    {
      "symbol": "USD",
      "amount": "10000",
      "priceUsd": "1",
      "valueUsd": "10000"
    },
    {
      "symbol": "BTC",
      "amount": "0.6",
      "priceUsd": "97500",
      "valueUsd": "58500"
    }
  ]
}
```

---

### GET /portfolio/allocation

**Response (200 OK):**
```json
{
  "allocations": [
    { "symbol": "USD", "percentage": 20.5, "valueUsd": "10000" },
    { "symbol": "BTC", "percentage": 79.5, "valueUsd": "38750" }
  ]
}
```

---

## 3.6 Deposits — Fiat

### POST /deposits/fiat

**Request:**
```json
{
  "fiatCurrency": "USD",
  "amount": 100.50,
  "paymentMethodId": "uuid-of-saved-method"
}
```

*Or with inline payment (no saved method):*
```json
{
  "fiatCurrency": "USD",
  "amount": 100.50,
  "paymentMethod": {
    "type": "card",
    "last4": "4242",
    "brand": "visa"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "fiatCurrency": "USD",
  "amount": "100.50",
  "fee": "2.01",
  "status": "completed",
  "createdAt": "2025-03-16T12:00:00Z",
  "completedAt": "2025-03-16T12:00:01Z"
}
```

**Errors:** 400 (validation, invalid payment method), 402 (payment failed)

---

## 3.7 Deposits — Crypto

### POST /deposits/crypto/address

**Request:**
```json
{ "symbol": "BTC" }
```

**Response (200 OK):**
```json
{
  "symbol": "BTC",
  "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "expiresAt": null
}
```

*Mock: Uses `assets.walletAddress` or generates deterministic address per user+asset.*

---

### POST /deposits/crypto

**Request:**
```json
{
  "symbol": "BTC",
  "amount": 0.001,
  "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "txHash": "abc123..." // optional, for confirmation
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "assetId": "uuid",
  "amount": "0.001",
  "walletAddress": "bc1q...",
  "status": "pending",
  "createdAt": "2025-03-16T12:00:00Z"
}
```

---

## 3.8 Transactions

### GET /transactions?type=deposit&from=2025-01-01&to=2025-03-16&limit=50&offset=0

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "deposit",
      "asset": "USD",
      "amount": "100",
      "status": "completed",
      "createdAt": "2025-03-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "type": "trade_buy",
      "asset": "BTC",
      "amount": "0.01",
      "refType": "trade",
      "refId": "uuid",
      "createdAt": "2025-03-14T15:30:00Z"
    }
  ],
  "total": 25
}
```

---

## 3.9 Error Response Format

All errors return consistent structure:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    { "field": "amount", "message": "Amount must be positive" }
  ]
}
```

| Status | Use Case |
|--------|----------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation, business rule) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (2FA required, insufficient rights) |
| 404 | Not Found |
| 409 | Conflict (e.g. email exists) |
| 500 | Internal Server Error |

---

# Step 4 — Database Interaction Explanation

## 4.1 Deposit Flow (Fiat)

1. **Validate** request: `fiatCurrency` (USD/EUR), `amount` (positive, within limits), `paymentMethodId` or inline payment.
2. **Lookup** asset by `fiatCurrency` (e.g. USD).
3. **Create** `deposits_fiat` record with status `pending` or `processing`.
4. **Validate payment** (mock: always succeed; production: call payment provider).
5. **Transaction:**
   - Update `user_balances`: `balance_available += amount - fee`.
   - Create `balance_transactions` (type: `deposit`, ref: `deposits_fiat`, ref_id: deposit id).
   - Update `deposits_fiat.status` = `completed`, `completed_at` = now.
6. Return deposit record.

## 4.2 Deposit Flow (Crypto)

1. **POST /deposits/crypto/address**
   - Find `Asset` by symbol where `asset_type = 'crypto'`.
   - Return `asset.wallet_address` or generate mock: `bc1q{userId_hash}{asset_symbol_hash}`.

2. **POST /deposits/crypto**
   - Validate: symbol, amount, wallet_address.
   - Create `deposits_crypto` record (status: `pending`).
   - *Optional:* When tx is "confirmed" (mock webhook), update balance and status. For MVP: UI may call a "confirm" endpoint or we simulate instant credit for testing.

## 4.3 Order Flow (Trading Engine)

1. **Validate** order: symbol, side, type, quantity, price (for limit).
2. **Check balance:**
   - Sell: user must have enough base asset.
   - Buy: user must have enough quote asset (quantity × price for limit; quantity × last_price for market).
3. **Create** `orders` record (status: `open`).
4. **Lock balance** (if limit): `balance_locked += quantity` (sell) or `quantity × price` (buy). Create `balance_transactions` (type: `order_lock`).
5. **Match** via `MatchingService` (existing logic).
6. For each fill:
   - Create `trades` record.
   - Update both users’ `user_balances` (credit base, debit quote for buyer; opposite for seller).
   - Create `balance_transactions` (type: `trade_buy` / `trade_sell`).
   - Update `orders.filled_quantity`, `order_status`.
7. Unlock any remaining locked amount on cancel/partial fill.

## 4.4 Profile Endpoint

- **GET /users/me:** Read `users` + `user_profiles`; exclude `password_hash`.

## 4.5 Portfolio Endpoints

- **GET /portfolio/balances:** Read `user_balances` joined with `assets`.
- **GET /portfolio/summary:** Same + join `tickers` or `cryptos` for prices; compute total value.
- **GET /portfolio/allocation:** Same data; compute percentages.

## 4.6 Transaction History

- **GET /transactions:** Query `balance_transactions` filtered by `user_id`, optional `type`, `from`, `to`; paginate.

---

# Implementation Phases (After Approval)

| Phase | Scope | Endpoints |
|-------|-------|-----------|
| **Phase 1** | Auth & Sessions | logout, 2FA (setup, enable, disable, verify, backup codes) |
| **Phase 2** | Deposits | deposits/fiat, deposits/crypto, payment-methods |
| **Phase 3** | Portfolio & Transactions | portfolio/*, transactions/* |
| **Phase 4** | Orders Enhancements | date range, by-coin, pagination |
| **Phase 5** | Cryptos Enhancements | single crypto, price-history |
| **Phase 6** | Validation & OpenAPI | Request validation, error codes, Swagger update |

---

# OpenAPI (Swagger) Requirements

- All endpoints documented with `@ApiOperation`, `@ApiBody`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`.
- Request/response schemas via DTOs with `class-validator` + `@ApiProperty`.
- Error responses: 400, 401, 404, 500 with example payloads.
- Security: `@ApiBearerAuth()` on protected routes.

---

# Validation Requirements Summary

| Area | Validations |
|------|-------------|
| Auth | email format, password min 6 chars, displayName max 100 |
| Orders | symbol in allowlist, side in [buy,sell], type in [limit,market], quantity > 0, price > 0 for limit |
| Deposits Fiat | currency in [USD,EUR], amount min/max, payment method valid |
| Deposits Crypto | symbol valid crypto, amount > 0, wallet format |
| Pagination | limit 1–100, offset >= 0 |
| Date range | ISO 8601, from <= to |

---

**End of API Design Plan**

*Awaiting approval before implementing code.*
