 # CryptoSandboxQA — Features Inventory

**Comprehensive list of all implemented features** for CryptoSandboxQA, a full-stack crypto exchange sandbox for QA training.

**Project Tech Stack:** NestJS backend (port 3001) · Next.js frontend (port 3000) · PostgreSQL · Prisma ORM · Socket.IO realtime · Playwright E2E

**Date Generated:** 2026-07-25

---

## Table of Contents

1. [Authentication & Security](#authentication--security)
2. [User Management](#user-management)
3. [Wallet & Balance Management](#wallet--balance-management)
4. [Trading Features](#trading-features)
5. [Order Management](#order-management)
6. [Deposits & Withdrawals](#deposits--withdrawals)
7. [Realtime & WebSocket](#realtime--websocket)
8. [Admin & Impersonation](#admin--impersonation)
9. [Portfolio & Analytics](#portfolio--analytics)
10. [Markets & Price Discovery](#markets--price-discovery)
11. [Payment Methods](#payment-methods)
12. [Transactional Email](#transactional-email)
13. [Advanced Charts & Visualization](#advanced-charts--visualization)
14. [QA Testing Features](#qa-testing-features)
15. [Observability & Metrics](#observability--metrics)
16. [Accessibility & UI Patterns](#accessibility--ui-patterns)

---

## Authentication & Security

### Feature: User Registration
**Purpose:** New users can create an account with email and password.

| Detail | Value |
|--------|-------|
| **Frontend Routes** | `/register`, `/` (with register link) |
| **Frontend Files** | `frontend/app/register/page.tsx` |
| **Backend Endpoint** | `POST /auth/register` (unauthenticated) |
| **Backend Module** | `backend/src/auth/` |
| **Key Service** | `AuthService.register()` → `UsersService.create()` + optional **welcome email** |
| **Database Models** | `users`, `user_profiles` (Prisma) |
| **Validation** | Email (max 254 chars), password (min 6 chars), optional display name (max 100 chars) |
| **Validation File** | `frontend/lib/authFieldConstraints.ts` |
| **Email Sent** | Welcome email via `MailService` after registration (logs if SMTP not set) |
| **Notes** | Registration with profile (`POST /auth/register-with-profile`) also supported; same welcome flow |

**Related DTOs:**
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/auth/dto/register-with-profile.dto.ts`

---

### Feature: User Login
**Purpose:** Authenticated users can log in with email and password, receive JWT token.

| Detail | Value |
|--------|-------|
| **Frontend Routes** | `/login`, `/` (landing page sign-in form) |
| **Frontend Files** | `frontend/app/login/page.tsx` |
| **Backend Endpoint** | `POST /auth/login` (unauthenticated) |
| **Backend Module** | `backend/src/auth/` |
| **Key Service** | `AuthService.login()` → JWT token + session record |
| **Session Persistence** | `user_sessions` table (revocation on logout) |
| **Database Models** | `users`, `user_sessions` |
| **Validation** | Email (max 254 chars), password (min 6 chars) |
| **Error Handling** | 401 Unauthorized for invalid credentials |
| **Guard** | `JwtAuthGuard` + `SessionGuard` for protected routes |
| **Notes** | Session-backed logout; JWT also stored in `Authorization: Bearer <token>` header |

**Related DTOs & Guards:**
- `backend/src/auth/dto/login.dto.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/auth/guards/` (JwtAuthGuard, SessionGuard, AdminGuard)

---

### Feature: Logout
**Purpose:** End user session and invalidate JWT token.

| Detail | Value |
|--------|-------|
| **Frontend Route** | Triggered via header menu; may also redirect from protected routes |
| **Backend Endpoint** | `POST /auth/logout` (authenticated) |
| **Backend Service** | `SessionsService.invalidate()` |
| **Session Invalidation** | Removes entry from `user_sessions` table |
| **Frontend Behavior** | Clears cached JWT, redirects to login page |
| **Notes** | All subsequent API calls return 401 Unauthorized |

---

### Feature: Password Reset (8-Digit Code)
**Purpose:** Users can reset forgotten password via email-delivered 8-digit code.

| Detail | Value |
|--------|-------|
| **Forgot Password Route** | `/forgot-password` |
| **Reset Password Route** | `/reset-password` |
| **Frontend Files** | `frontend/app/forgot-password/page.tsx`, `frontend/app/reset-password/page.tsx` |
| **Backend Endpoints** | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| **Backend Service** | `AuthService.forgotPassword()`, `AuthService.resetPassword()` |
| **Database Model** | `user_password_resets` (code_hash, expiry, one-time use) |
| **Code Storage** | Plain code never stored; DB keeps `HMAC-SHA256(pepper, code)` hash |
| **Code Format** | Exactly **8 digits**; numeric only; TTL **30 minutes** |
| **Code Delivery** | Email via SMTP (Mailpit in dev) or backend logs if SMTP not configured |
| **Anti-Enumeration** | Same JSON response whether email exists or not; **no email sent** if user not found |
| **Validation File** | `frontend/lib/authFieldConstraints.ts` |
| **Security** | New reset replaces previous unused reset; single-use enforcement |
| **Post-Reset** | All user sessions cleared (forces re-login on other devices) |
| **Pepper** | `PASSWORD_RESET_CODE_PEPPER` or `JWT_SECRET` env var |

**Related DTOs:**
- `backend/src/auth/dto/forgot-password.dto.ts`
- `backend/src/auth/dto/reset-password-with-code.dto.ts`

---

### Feature: Two-Factor Authentication (2FA / TOTP)
**Purpose:** Optional second factor for account security; setup, enable, verify, backup codes.

| Detail | Value |
|--------|-------|
| **Settings Location** | `/profile/settings` (2FA section) |
| **Frontend Component** | `frontend/components/TwoFactorSettingsSection.tsx` |
| **2FA Verification Modal** | `frontend/components/TwoFactorVerificationModal.tsx` |
| **Validation File** | `frontend/lib/twoFactorValidation.ts` (6-digit code) |
| **Backend Module** | `backend/src/auth/` (TwoFactorService) |
| **Database Model** | `user_two_factor` (secret, backup codes, verified flag) |
| **Flow** | Setup (QR code + secret) → enable → verify (6-digit code) → receive backup codes |
| **Login Flow** | If 2FA enabled, login returns temp token; must `POST /auth/2fa/verify` before full access |
| **Backend Service** | `TwoFactorService.setup()`, `.enable()`, `.verify()`, `.getBakupCodes()` |
| **TOTP Library** | `speakeasy` (RFC 6238 standard) |
| **Backup Codes** | One-time use; regenerable; stored hashed |

---

### Feature: Admin User Creation (API Key Bootstrap)
**Purpose:** Admins can create admin accounts via `ADMIN_API_KEY` without user interaction.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `POST /auth/admin/register` (API key guard) |
| **Env Var** | `ADMIN_API_KEY` (required; set in `.env`) |
| **Guard** | `AdminApiKeyGuard` (checks header: `X-Admin-Api-Key: <ADMIN_API_KEY>`) |
| **Database Model** | `users` with `role = 'admin'` |
| **Backend Service** | `AuthService.registerAdmin()` |
| **Admin Role** | `AdminGuard` required for admin-only routes |
| **Notes** | Bypasses user registration UI; direct API-only pathway for test setup |

**Related DTOs:**
- `backend/src/auth/dto/create-admin.dto.ts`

---

### Feature: Bulk User Import (CSV/JSON)
**Purpose:** Admins can import multiple users via CSV or JSON file.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/admin/import-users` |
| **Frontend Component** | `frontend/app/admin/import-users/page.tsx` |
| **Backend Endpoint** | `POST /auth/admin/bulk-import-users` (multipart, admin auth) |
| **Backend Service** | `AuthService.bulkImportUsers()` |
| **Parser** | `backend/src/auth/bulk-user-import.parse.ts` (CSV/JSON format detection) |
| **File Formats** | CSV or JSON with columns: email, password, firstName, lastName, username, etc. |
| **Validation** | Same rules as single user create; duplicates rejected |
| **Database** | Batch insert to `users` table |
| **Response** | List of created users (IDs, emails, usernames) |
| **Notes** | Password hashes never exposed in responses |

---

### Feature: Impersonation (Admin → User)
**Purpose:** Admins can act as a target user without knowing their password.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/admin/impersonate` |
| **Frontend Component** | `frontend/app/admin/impersonate/page.tsx` |
| **Backend Endpoints** | `POST /auth/impersonate` (body: `{ userId }`), `POST /auth/end-impersonation` |
| **Backend Service** | `AuthService.impersonate()`, `AuthService.endImpersonation()` |
| **Auth Requirement** | Admin JWT only |
| **Token Flow** | Returns JWT for target user + `backToAdminToken` to restore admin |
| **Database** | `user_sessions` tracks impersonation state |
| **UI Experience** | User dropdown shows "Impersonating: <username>" indicator |
| **Notes** | Full API access as the target user; audit trail in session records |

---

### Feature: Session Management
**Purpose:** Persistent session tracking and revocation.

| Detail | Value |
|--------|-------|
| **Database Model** | `user_sessions` (userId, JWT, createdAt, impersonated_by) |
| **Backend Service** | `SessionsService` (create, validate, invalidate) |
| **Guard** | `SessionGuard` (checks JWT + session record exists) |
| **Logout Invalidation** | Row deleted from `user_sessions`; subsequent calls return 401 |
| **Impersonation Flag** | Optional `impersonated_by` field tracks admin who started impersonation |
| **Deployment Note** | Each login creates a new session row; logout removes it |

---

## User Management

### Feature: User Profile & Settings
**Purpose:** Users can view and update their profile (name, email, avatar, bio).

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/profile`, `/profile/settings` |
| **Frontend Component** | `frontend/app/profile/page.tsx`, `frontend/app/profile/settings/page.tsx` |
| **Backend Endpoint** | `GET /users/me` (authenticated), `PATCH /users/me` (authenticated) |
| **Backend Module** | `backend/src/users/` (UsersService, UsersController) |
| **Database Models** | `users`, `user_profiles` |
| **User Profile Fields** | firstName, lastName, avatarUrl, bio, phone, dateOfBirth, gender, etc. |
| **API Response** | User object + extended profile fields |
| **Notes** | Optional fields can be null; updates via `PATCH /users/me` |

**Related DTOs:**
- `backend/src/users/dto/update-profile.dto.ts`

---

### Feature: User Profile Extended (Registration with Profile)
**Purpose:** During registration, users can provide profile info immediately.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `POST /auth/register-with-profile` (unauthenticated) |
| **Backend Service** | `AuthService.registerWithProfile()` |
| **Database Models** | `users` + `user_profiles` (created in same transaction) |
| **Profile Fields** | firstName, lastName, avatarUrl, bio, phone, dateOfBirth, gender |
| **Email Sent** | Welcome email (same as standard register) |
| **Related DTOs** | `RegisterWithProfileDto` |

---

### Feature: Admin User Export
**Purpose:** Admins can export user data (JSON or CSV) for analysis or migration.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /users/bulk/export?format=json\|csv&preset=first100\|last100\|dateRange&from=&to=` |
| **Backend Service** | `UsersService.exportUsers()` |
| **Auth Requirement** | Admin JWT only |
| **Presets** | `first100`, `last100` (by createdAt), or `dateRange` (with from/to ISO strings; up to 500 rows) |
| **Formats** | JSON (array of user objects) or CSV (comma-separated) |
| **Response** | User records **without** password hashes |
| **Notes** | Paged export; handy for bulk analysis or test data export |

---

## Wallet & Balance Management

### Feature: User Wallets & Balances
**Purpose:** Track cryptocurrency and fiat holdings per asset.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/dashboard` (wallet overview), `/assets` (detailed holdings) |
| **Frontend Components** | `frontend/components/WalletCard.tsx`, `frontend/components/PortfolioSummary.tsx` |
| **Backend Endpoints** | `GET /wallets` (authenticated), `GET /admin/users/:userId/wallets` (admin) |
| **Backend Module** | `backend/src/wallets/` (WalletsService, WalletsController) |
| **Database Models** | `user_balances` (userId, asset, balance, balance_locked) |
| **Balance Types** | `balance` (available) + `balance_locked` (in orders/deposits) |
| **Transaction Log** | `balance_transactions` (type: order_lock, order_unlock, order_fill, deposit, transfer, etc.) |
| **Assets** | Fiat (USD, EUR) + crypto (BTC, ETH, etc.) per `assets` table |
| **Notes** | Locked funds held in pending orders; unlock on cancel or partial fill |

**Related DTOs:**
- `backend/src/wallets/dto/wallet.dto.ts`

---

### Feature: Internal Crypto Transfer
**Purpose:** Users can send cryptocurrency to another registered user by email.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/assets/transfer` |
| **Frontend Component** | `frontend/app/assets/transfer/page.tsx` |
| **Backend Endpoint** | `POST /wallets/transfer` (authenticated) |
| **Backend Service** | `WalletsService.transferCrypto()` |
| **Database Models** | `user_balances` (debits sender, credits recipient), `balance_transactions` (type: transfer, refType: internal_transfer) |
| **User Lookup** | By email; `UserNotFound` error if recipient not registered |
| **Transaction Log** | Bilateral `balance_transactions` rows with `metadata` field (for peer hints) |
| **History Endpoint** | `GET /transactions/transfers` (shows sent + received) |
| **Assets Allowed** | Cryptocurrency only (fiat rejected via `assets.asset_type` check) |
| **Amount Validation** | Minimum, maximum, decimal places |
| **Notes** | One atomic transaction; no email notification sent (differs from deposits/orders) |

**Related DTOs:**
- `backend/src/wallets/dto/transfer.dto.ts`

---

### Feature: Cryptocurrency Withdrawal
**Purpose:** Users can withdraw crypto to an external destination (simulated).

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/assets/withdraw` |
| **Frontend Component** | `frontend/app/assets/withdraw/page.tsx` (three-step flow) |
| **Backend Endpoint** | `POST /wallets/withdraw` (authenticated) |
| **Backend Service** | `WalletsService.withdraw()` |
| **Database Models** | `withdrawals` (persistent record), `user_balances` (debit), `balance_transactions` |
| **Steps** | 1) Select crypto 2) Enter destination (simulated address) 3) Confirm amount |
| **Fiat Rejection** | Endpoint rejects fiat symbols via `assets.asset_type` check |
| **Validation** | Amount max (default 10 per env `WALLET_WITHDRAW_AMOUNT_MAX` or DTO default) |
| **Transaction Log** | `balance_transactions` (type: withdrawal) |
| **History** | `GET /transactions/withdrawals` (admin + user view) |
| **Notes** | Simulated destination (no actual blockchain integration); training-only |

**Related DTOs:**
- `backend/src/wallets/dto/withdraw.dto.ts`
- **Validation File:** `frontend/lib/withdrawValidation.ts` (amount, balance check)

---

### Feature: Balance Lock & Unlock (Order-Backed)
**Purpose:** Funds are locked when orders are opened, unlocked on cancel or fill.

| Detail | Value |
|--------|-------|
| **Mechanism** | Sell order locks base asset qty; buy order locks quote asset ≈ qty × limit price (or market price at submit) |
| **Lock Event** | `balance_transactions` row created with type `order_lock` |
| **Unlock Event** | `balance_transactions` row created with type `order_unlock` (on cancel or partial fill) |
| **Settle Event** | `balance_transactions` row created with type `order_fill` (trade matched) |
| **Database** | `user_balances.balance_locked` increases on lock, decreases on unlock |
| **Locked Formula** | Sell: base qty; Buy limit: qty × limitPrice; Buy market: qty × lastPrice (at submit) |
| **Notes** | Critical for balance validation in tests; simulated persist delay mimics settlement lag |

---

## Trading Features

### Feature: Spot Market Trading (Buy/Sell)
**Purpose:** Users can place limit and market orders on spot trading pairs.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/trade/spot`, `/market` |
| **Frontend Components** | `frontend/components/TradeOrderEntry.tsx`, `frontend/components/TradeCoinTable.tsx`, `frontend/components/TradeOrdersTabs.tsx` |
| **Backend Endpoint** | `POST /orders` (authenticated) |
| **Backend Module** | `backend/src/orders/` (OrdersService, OrdersController) |
| **Database Model** | `orders` (marketType: 'spot', side: buy/sell, type: limit/market/stop, status: open/filled/cancelled) |
| **Order Types** | Limit (price + qty) | Market (qty only) | Stop (stopPrice + limit/market) |
| **Matching** | FIFO-style via `MatchingService` (taker-initiated matching) |
| **Status Flow** | open → partially_filled → filled (or cancelled at any point) |
| **Email Notifications** | open, filled, cancelled statuses (order owner); maker filled (on match) |
| **Validation** | Amount/price positive, balance checks, decimal places |
| **Simulated Delay** | `SIMULATED_PERSIST_DELAY_MS` (default 1200ms) between validation and DB write |

**Related DTOs:**
- `backend/src/orders/dto/create-order.dto.ts`

---

### Feature: Futures Market Trading (UI)
**Purpose:** Futures UI is wired in the frontend; backend support exists.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/trade/futures` |
| **Frontend Component** | `frontend/components/TradeOrderEntryDual.tsx` (dual buy/sell) |
| **Backend Support** | `orders.market_type` = 'futures'; API treats same as spot |
| **Status** | Fully implemented; UI feature for testing |
| **Notes** | No leverage or position management yet; training-only |

---

### Feature: Stop Orders (Buy Stop & Sell Stop)
**Purpose:** Orders that convert to market orders when price reaches a trigger level.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/trade/spot`, `/trade/futures` (stop order type selector) |
| **Frontend Component** | `frontend/components/TradeOrderEntry.tsx` (stopPrice input when type = 'stop') |
| **Order Type** | Type `stop` with `stopPrice` field |
| **Trigger Logic** | Buy stop: triggers when price ≥ stopPrice; Sell stop: when price ≤ stopPrice |
| **Execution** | Converts to market order on trigger; requires frontend to remain open |
| **Database Field** | `orders.stop_price` (Prisma model) |
| **Frontend Trigger Logic** | `frontend/lib/orderTriggers.ts`, `frontend/lib/useOrderTriggers.ts` (real-time price check vs subscribed tickers) |
| **Notes** | Server-side trigger not implemented; frontend hooks poll tickers; training-only, not production-grade |

**Related Files:**
- `frontend/lib/orderTriggers.ts` (trigger detection logic)
- `frontend/lib/useOrderTriggers.ts` (React hook for monitoring)
- `backend/src/orders/dto/create-order.dto.ts` (stopPrice field)

---

## Order Management

### Feature: Order Creation & Lifecycle
**Purpose:** Core order placement, matching, and settlement.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `POST /orders` (authenticated) |
| **Backend Service** | `OrdersService.create()` → validation → simulated delay → DB write → `MatchingService.matchOrder()` → settlement |
| **Database Model** | `orders` (id, userId, symbol, side, type, qty, price, stopPrice, status, fills, etc.) |
| **Statuses** | `open`, `partially_filled`, `filled`, `cancelled`, `cancel_requested`, `cancel_failed` |
| **Validation** | Amount/price positive, balance sufficient (including locked), qty/price decimals |
| **Lock Mechanics** | Sell: lock base qty; Buy limit: lock ≈ qty × price; Buy market: lock ≈ qty × lastPrice |
| **Matching** | `MatchingService.matchOrder()` finds resting orders (opposite side, executable price); creates `trades` rows |
| **Settlement** | `WalletsService.settleOrderInTx()` moves locked → available; creates fill `balance_transactions` |
| **Email Notifications** | Sent after validation + after final status (open, filled, cancelled) |

**Related Entities:**
- `orders` table (Prisma)
- `trades` table (matched pairs)
- `backend/src/orders/matching.service.ts` (FIFO matching logic)

---

### Feature: Order Listing & Filtering
**Purpose:** Users can retrieve their orders, admins can query user orders.

| Detail | Value |
|--------|-------|
| **User Endpoint** | `GET /orders?limit=50&offset=0` (authenticated) |
| **User Filtering** | `GET /orders/by-date`, `GET /orders/by-coin?symbol=BTC_USD` |
| **Admin Endpoint** | `GET /admin/users/:userId/orders` (admin) |
| **Backend Service** | `OrdersService.findByUser()`, `OrdersService.findByDate()`, `.findByCoin()` |
| **Response Format** | `{ data: [...], total, meta: { total, limit, offset } }` |
| **Pagination** | Query params: `limit` (default 50), `offset` (default 0) |
| **Notes** | All endpoints respect asset/symbol filtering; responses include filled qty, fill price |

---

### Feature: Order Cancellation
**Purpose:** Users can cancel open or partially-filled orders.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `PUT /orders/:orderId/cancel` (authenticated) |
| **Backend Service** | `OrdersService.cancel()` |
| **Preconditions** | Order must exist, belong to user, have cancelable status |
| **Status Change** | `open` or `partially_filled` → `cancelled` |
| **Unlock Mechanism** | `WalletsService.unlock()` returns locked funds to available balance |
| **Email Notification** | Sent after cancel completes |
| **Response** | Updated order object with status `cancelled`, filledQty unchanged |

---

### Feature: Matching & Trade Settlement
**Purpose:** FIFO-style matching of opposing orders and settlement of trades.

| Detail | Value |
|--------|-------|
| **Mechanism** | After `OrdersService.create()`, call `MatchingService.matchOrder(newOrder)` |
| **Algorithm** | Find all resting (open) orders on opposite side, price-executable, sorted by time (FIFO) |
| **Trade Creation** | For each match, insert row into `trades` (takerOrderId, makerOrderId, qty, price, timestamp) |
| **Settlement** | `WalletsService.settleOrderInTx()` updates both users' balances and creates fill events |
| **Maker Email** | Sent when maker's order fully fills (from matching, not taker's create) |
| **Taker Email** | Sent when taker's order is filled (from create end-state) |
| **Database** | `orders` status updated; `trades` rows created; `balance_transactions` logged |

**Related Files:**
- `backend/src/orders/matching.service.ts` (MatchingService)
- `backend/src/wallets/wallets.service.ts` (settleOrderInTx, settleBuyOrder, settleSellOrder)

---

### Feature: Trade History
**Purpose:** Users can view all their completed trades.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/history` (activity tab or trades section) |
| **Backend Endpoint** | `GET /transactions?filter=trades` or `GET /orders/:orderId/trades` (admin) |
| **Database Model** | `trades` (takerOrderId, makerOrderId, qty, price, symbol, timestamp) |
| **Response** | List of trade records with order details, qty, fill price, timestamp |
| **Notes** | Accessible via order detail or transactions history |

---

## Deposits & Withdrawals

### Feature: Fiat Deposit (Card/SEPA)
**Purpose:** Users can add fiat currency (USD, EUR) to their wallets via card or SEPA transfer.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/deposit-cash`, `/assets/deposit` (fiat pane) |
| **Frontend Components** | `frontend/components/DepositCashForm.tsx`, `frontend/components/DashboardQuickDeposit.tsx` |
| **Backend Endpoint** | `POST /deposits/fiat` (authenticated) |
| **Backend Service** | `DepositsService.depositFiat()` → `WalletsService.credit()` |
| **Database Models** | `deposits_fiat` (userId, amount, currency, paymentMethodType, paymentMethodId, status), `user_balances` |
| **Payment Methods** | `card`, `sepa` (optional; default `card` if not specified) |
| **Saved Methods** | Link to `user_payment_methods.id` if `paymentMethodId` sent |
| **Amount Validation** | Min 1, max 50_000, max 2 decimal places |
| **Simulated Delay** | Awaits `SIMULATED_PERSIST_DELAY_MS` between validation and DB write |
| **Balance Update** | Credit fiat asset; create `balance_transactions` row (type: deposit) |
| **Email Notification** | Deposit receipt sent after success (logs if SMTP not set) |

**Related DTOs & Validation:**
- `backend/src/deposits/dto/deposit-fiat.dto.ts`
- `frontend/lib/depositCashValidation.ts` (amount, payment field rules)

---

### Feature: Cryptocurrency Deposit (Manual Address)
**Purpose:** Users can deposit cryptocurrency by obtaining a deposit address.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/deposit-crypto`, `/assets/deposit` (crypto pane) |
| **Frontend Components** | `frontend/components/DepositCryptoForm.tsx` |
| **Backend Endpoints** | `POST /deposits/crypto/address` (get address), `POST /deposits/crypto` (confirm deposit) |
| **Backend Service** | `DepositsService.getDepositAddress()`, `DepositsService.depositCrypto()` |
| **Database Models** | `deposits_crypto` (userId, amount, asset, address, txHash, status), `user_balances` |
| **Address Format** | Simulated; no blockchain validation |
| **Amount Validation** | Min 0.00001, max 100, max 8 decimal places |
| **Simulated Delay** | Awaits `SIMULATED_PERSIST_DELAY_MS` between validation and DB write |
| **Balance Update** | Credit crypto asset; create `balance_transactions` row (type: deposit) |
| **Email Notification** | Deposit receipt sent after success |
| **Notes** | Training-only; no actual blockchain scanning |

**Related DTOs & Validation:**
- `backend/src/deposits/dto/deposit-crypto.dto.ts`
- `frontend/lib/depositCryptoValidation.ts`

---

### Feature: Deposit History & Admin Inspection
**Purpose:** Users and admins can view deposit records.

| Detail | Value |
|--------|-------|
| **User Endpoint** | `GET /transactions/deposits` (paginated) |
| **Admin Endpoint** | `GET /admin/users/:userId/deposits/fiat` or `/deposits/crypto` (+ by id) |
| **Database Models** | `deposits_fiat`, `deposits_crypto` |
| **Response Format** | `{ data: [...], total, meta: { total, limit, offset } }` |
| **Fields** | Amount, currency/asset, paymentMethodType (fiat only), timestamp, status |
| **Notes** | All deposits visible to user + admin for the user |

---

### Feature: Payment Methods
**Purpose:** Users can save card and bank account details for quick deposit access.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/profile/settings` (payment methods section, if implemented) |
| **Backend Module** | `backend/src/payment-methods/` (PaymentMethodsService, PaymentMethodsController) |
| **Database Model** | `user_payment_methods` (userId, type: card/sepa, lastFour, cardBrand, expiryDate, etc.) |
| **Backend Endpoints** | `GET /payment-methods` (list), `POST /payment-methods` (create), `PUT /payment-methods/:id` (update), `DELETE /payment-methods/:id` (remove) |
| **Deposit Integration** | `POST /deposits/fiat` accepts optional `paymentMethodId`; resolves method type from saved record |
| **Admin Endpoint** | `GET /admin/users/:userId/payment-methods` (+ by id) |
| **Notes** | Simulated details (no actual card storage); training-only |

---

## Realtime & WebSocket

### Feature: Ticker WebSocket (Socket.IO)
**Purpose:** Real-time price updates pushed to clients via Socket.IO.

| Detail | Value |
|--------|-------|
| **Namespace** | `/ticker` |
| **Frontend Integration** | Socket.IO client listens on `/ticker` namespace |
| **Backend Gateway** | `TickerGateway` (WebSocketModule) |
| **Events** | Client sends `subscribe(symbol)` / `unsubscribe(symbol)` |
| **Broadcast** | Server emits `ticker` payload `{ symbol, lastPrice, volume24h }` to subscribed clients |
| **Update Frequency** | Every 2 seconds (via `TickersService.getAll()`) |
| **Database** | `tickers` table (symbol, lastPrice, volume24h) |
| **Price Source** | Seeded from `prisma/seed-market.js` (training data, not live external feed) |
| **Frontend Hook** | `frontend/lib/useOrderTriggers.ts` (subscribes to tickers for stop-order trigger checks) |
| **Chart Integration** | `/charts` page subscribes to real-time tickers for candlestick updates |

**Related Files:**
- `backend/src/websocket/ticker.gateway.ts` (TickerGateway)
- `backend/src/tickers/tickers.service.ts` (TickersService)
- `frontend/lib/useOrderTriggers.ts` (stop-order trigger monitor)

---

## Admin & Impersonation

### Feature: Admin Role & Guards
**Purpose:** Role-based access control for admin-only routes.

| Detail | Value |
|--------|-------|
| **Roles** | `user` (default), `admin` |
| **Database Field** | `users.role` |
| **Guard** | `AdminGuard` on controller methods requiring `@Admin()` decorator |
| **JWT Claim** | Role included in JWT payload |
| **Admin Routes** | Prefixed with `/admin/` (e.g., `/admin/users/:userId/wallets`) |
| **Notes** | Impersonation as user does not grant admin access (role reverts) |

---

### Feature: Admin User List & Query
**Purpose:** Admins can list and search registered users.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /users?limit=50&offset=0` (admin JWT) |
| **Backend Service** | `UsersService.findAll()` |
| **Response Format** | `{ data: [...], total, meta: { total, limit, offset } }` |
| **Fields** | userId, email, username, firstName, lastName, role, createdAt |
| **Pagination** | Query params: `limit`, `offset` |
| **Notes** | Passwords never included in responses |

---

### Feature: Admin Inspect User Wallets
**Purpose:** Admins can view any user's balance and transaction details.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /admin/users/:userId/wallets` (admin JWT) |
| **Backend Service** | `WalletsService.getBalances()` (admin flavor) |
| **Response** | List of assets with balance + balance_locked for that user |
| **Notes** | Critical for test debugging and user support |

---

### Feature: Admin Inspect User Orders
**Purpose:** Admins can view any user's order history and detail.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /admin/users/:userId/orders` (admin JWT) |
| **Backend Service** | `OrdersService.findByUserId()` (admin flavor) |
| **Response Format** | Paginated list of order records (same structure as user endpoint) |
| **Notes** | Useful for debugging match issues or order state |

---

### Feature: Admin Inspect User Deposits/Withdrawals
**Purpose:** Admins can view any user's funding activity.

| Detail | Value |
|--------|-------|
| **Backend Endpoints** | `GET /admin/users/:userId/deposits/fiat`, `/deposits/crypto`, `/deposits/{id}` |
| **Backend Endpoints** | `GET /admin/users/:userId/withdrawals` (if implemented) |
| **Response** | Deposit/withdrawal record(s) with all details |
| **Notes** | Fiat deposits include payment method type |

---

### Feature: Admin Inspect User Transactions
**Purpose:** Admins can view unified transaction history for a user.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /admin/users/:userId/transactions` (admin JWT) |
| **Filters** | `?type=deposits\|trades\|withdrawals\|transfers` |
| **Response** | Paginated list of transactions (unified view) |
| **Notes** | Includes balance_transactions metadata for peer hints on transfers |

---

### Feature: Admin Inspect User Portfolio
**Purpose:** Admins can view a user's portfolio summary and allocation.

| Detail | Value |
|--------|-------|
| **Backend Endpoints** | `GET /admin/users/:userId/portfolio/*` (summary, allocation, balances) |
| **Backend Service** | `PortfolioService` (admin flavor) |
| **Response** | Total balance, per-asset allocation, holdings |
| **Notes** | Useful for portfolio snapshot at any point in time |

---

## Portfolio & Analytics

### Feature: Portfolio Summary
**Purpose:** Users can view total holdings and asset breakdown.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/dashboard` (top section), `/profile/portfolio` (detailed) |
| **Frontend Component** | `frontend/components/PortfolioSummary.tsx`, `frontend/app/profile/portfolio/page.tsx` |
| **Backend Endpoint** | `GET /portfolio/summary` (authenticated) |
| **Backend Service** | `PortfolioService.getSummary()` |
| **Response** | totalBalance (USD equivalent), perAssetBreakdown, holdings (qty per asset) |
| **Notes** | Real-time calculation from `user_balances` table |

---

### Feature: Portfolio Allocation
**Purpose:** Pie chart or visual breakdown of holdings by asset.

| Detail | Value |
|--------|-------|
| **Backend Endpoint** | `GET /portfolio/allocation` (authenticated) |
| **Backend Service** | `PortfolioService.getAllocation()` |
| **Response** | { asset: qty, ... } keyed by symbol |
| **Notes** | Used by `DashboardCharts` component for visualization |

---

### Feature: Dashboard Portfolio Analytics (Reorderable)
**Purpose:** Interactive chart dashboard with customizable layout and drag-and-drop reordering.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/dashboard` (Portfolio Analytics section) |
| **Frontend Component** | `frontend/components/DashboardCharts.tsx` |
| **Features** | Reorder cards by dragging, shuffle layout, customize (hide/show blocks), add blocks |
| **State Persistence** | `sessionStorage` keys: `portfolio-analytics-block-order`, `portfolio-analytics-block-hidden` |
| **DnD Library** | **@dnd-kit** (Sortable) |
| **QA Selectors** | `customize-analytics-layout`, `add-analytics-block-menu`, `add-analytics-block-<id>`, `remove-analytics-block-<id>`, `analytics-undo-remove`, `analytics-blocks-empty` |
| **Chart IDs** | Existing chart `data-testid`s (e.g., `portfolio-pie-chart`, `asset-breakdown-bar`) |
| **Legacy Migration** | Old sessionStorage format (full order only) auto-migrated on read |

**Related Files:**
- `frontend/components/DashboardCharts.tsx` (main component)

---

## Markets & Price Discovery

### Feature: Markets Cryptocurrency Table (with Modals)
**Purpose:** Browse all cryptocurrencies with price, volume, and market info.

| Detail | Value |
|--------|-------|
| **Frontend Routes** | `/markets/prices` (main), `/markets/rankings/spot`, `/markets/trading-data/overview` |
| **Frontend Component** | `frontend/components/MarketsCryptoTable.tsx` (in Suspense) |
| **Backend Endpoint** | `GET /cryptos` (unauthenticated, for market listings) |
| **Database Model** | `cryptos` (symbol, name, imageUrl, marketCap, volume, etc.) |
| **Modals** | Detail view (`?detail=SYMBOL`), about/methodology, reset confirm (alertdialog), nested stacked dialogs |
| **Search** | `markets-search-input` (max 128 chars; client-side filter) |
| **Validation File** | `frontend/lib/searchFieldConstraints.ts` |
| **Related Component** | `frontend/components/MarketsCryptoDetailModal.tsx` (detail modal) |
| **Notes** | QA practice surface for modal state management and nested dialogs |

---

### Feature: Trade Coin Selection Table
**Purpose:** Quick coin picker when entering orders on `/trade/spot` or `/trade/futures`.

| Detail | Value |
|--------|-------|
| **Frontend Component** | `frontend/components/TradeCoinTable.tsx` |
| **Search** | Client-side filter on coin name/symbol (max 128 chars) |
| **Action** | Clicking row selects coin; closes picker, populates order form |
| **Data Source** | `GET /cryptos` + paired trading pairs from `GET /tickers` |
| **Notes** | Embedded in trade form, not a standalone route |

---

### Feature: Order Book (Price Chart)
**Purpose:** Visualize current buy/sell orders for a trading pair.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/market` (embedded), `/trade/spot` (may show context) |
| **Frontend Component** | `frontend/components/TradePriceChart.tsx`, `frontend/components/TradingCharts.tsx` |
| **Data Source** | `GET /orders` filtered by symbol and side (buy/sell) |
| **Chart Type** | Bar or stacked chart showing open orders by price level |
| **Real-time** | Updated when orders are filled or cancelled (Socket.IO ticker updates trigger refresh) |
| **Notes** | Training visualization; not a live order book like real exchanges |

---

## Advanced Charts & Visualization

### Feature: Advanced Candlestick Charts
**Purpose:** Interactive OHLC chart viewer with zoom, pan, crosshair, and indicators.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/charts` (header **Charts** link) |
| **Frontend Component** | `frontend/components/AdvancedChart.tsx` |
| **Chart Library** | **TradingView Lightweight Charts** (canvas, high performance) |
| **Data Source** | Mock OHLC data from `frontend/lib/chartMockData.ts` (deterministic for testing) |
| **Series Types** | Candlestick (default), line, area |
| **Toggles** | Coin select (dropdown), interval (1m, 5m, 15m, 1h, etc.), volume on/off |
| **Live Tick** | Pausable real-time ticker updates (subscribes to `/ticker` WebSocket) |
| **Crosshair** | DOM readout of price/time at mouse position |
| **Order Trigger Visualization** | Displays working stop orders that would trigger at current price (via `lib/orderTriggers.ts`) |
| **QA Practice** | Canvas-based interaction; useful for chart interaction automation |

**Related Files:**
- `frontend/components/AdvancedChart.tsx`
- `frontend/lib/chartMockData.ts` (deterministic mock OHLC)
- `frontend/lib/orderTriggers.ts` (trigger visualization logic)

---

## Transactional Email

### Feature: Welcome Email (Registration)
**Purpose:** Notify new users after successful registration.

| Detail | Value |
|--------|-------|
| **Trigger** | After `AuthService.register()` or `registerWithProfile()` completes |
| **Recipient** | User email address |
| **Content** | Welcome message, app intro, link to login |
| **Delivery** | SMTP via `MailService` or backend logs (if SMTP not configured) |
| **Error Handling** | Logged; registration still succeeds if email fails |
| **Mailpit** | Viewable at `http://localhost:8025` (dev SMTP UI) |
| **Notes** | Optional in production; Mailpit included in Compose |

---

### Feature: Password Reset Code Email
**Purpose:** Deliver 8-digit code for password reset.

| Detail | Value |
|--------|-------|
| **Trigger** | After `POST /auth/forgot-password` (if email exists) |
| **Recipient** | User email address |
| **Content** | **8-digit code**, reset link hint, expiry (30 min) |
| **Delivery** | SMTP via `MailService` or backend logs |
| **Error Handling** | **Throws** on SMTP failure (user sees error); differs from other email types |
| **Anti-Enumeration** | Same 200 response even if email not found; no email sent in that case |
| **Mailpit** | Easily discoverable in UI for QA testing |
| **Notes** | Code valid for 30 minutes; single-use per reset request |

---

### Feature: Order Status Email
**Purpose:** Notify user when order status changes (open, filled, cancelled).

| Detail | Value |
|--------|-------|
| **Trigger Points** | After `OrdersService.create()` (final status), `.cancel()`, `.setStatus()` |
| **Recipient** | Order owner email |
| **Content** | Order symbol, side, qty, status, filled qty, fill price (if filled) |
| **Maker Filled** | Separate email sent by `MatchingService` when maker's resting order fully fills |
| **Delivery** | SMTP or logs |
| **Error Handling** | Logged; order state still persisted if email fails |
| **Distinction** | Maker emails sent from match (avoiding duplicate taker-filled mail) |

---

### Feature: Deposit Receipt Email (Fiat & Crypto)
**Purpose:** Confirm deposit after balance is credited.

| Detail | Value |
|--------|-------|
| **Trigger** | After `DepositsService.depositFiat()` or `.depositCrypto()` succeeds + balance updated |
| **Recipient** | User email |
| **Content** | Deposit amount, asset/currency, deposit type (card/sepa/crypto), timestamp |
| **Delivery** | SMTP or logs |
| **Error Handling** | Logged; deposit balance still credited if email fails |
| **Fiat Fields** | Payment method type (card/sepa) included in email |

---

### Feature: Training Credit Deposit Email
**Purpose:** Notify when admin credits user's wallet as a training deposit.

| Detail | Value |
|--------|-------|
| **Trigger** | Via admin wallet credit action (if implemented) |
| **Recipient** | User email |
| **Content** | Similar to deposit receipt |
| **Notes** | May also appear as `type: deposit` in `balance_transactions` |

---

### Feature: SMTP Configuration (Mailpit or Custom)
**Purpose:** Email delivery via configured SMTP host and port.

| Detail | Value |
|--------|-------|
| **Env Vars** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (true/false for TLS), `SMTP_USER` (optional), `SMTP_PASS` (optional), `MAIL_FROM` |
| **Default Dev** | Mailpit: `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false` |
| **No SMTP** | If `SMTP_HOST` unset, `MailService` logs message body to backend console (full code visible) |
| **Provider** | Backend uses **nodemailer** library |
| **Mailpit UI** | `http://localhost:8025` (inspect/resend emails) |
| **Response Time** | Mailpit instant; external providers delayed |

**Related Files:**
- `backend/src/mail/mail.service.ts` (MailService)
- `docker-compose.yml` (Mailpit service definition)

---

## QA Testing Features

### Feature: QA Iframe Practice Surface
**Purpose:** Same-origin iframe for testing iframe automation and isolation.

| Detail | Value |
|--------|-------|
| **Frontend Route** | `/qa/iframe-practice` |
| **Frontend Page** | `frontend/app/qa/iframe-practice/page.tsx` |
| **Iframe Source** | `/qa/iframe-form.html` (served as static asset) |
| **Iframe Form** | `frontend/public/qa/iframe-form.html` (form with labeled inputs) |
| **Automation Practice** | Frame switching, input fill (by `data-testid` / labels), submit, in-frame assertions |
| **Form Fields** | Typically email, password, submit button (structure may vary) |
| **QA Use Case** | Learn iframe scoping in Playwright, Cypress, or Selenium |

---

### Feature: Input Field Rules & Client Validation
**Purpose:** Documented constraints and error messages for all form inputs (auth, deposit, trade, etc.).

| Detail | Value |
|--------|-------|
| **Auth Fields** | Email (max 254, required), password (min 6, required), display name (max 100, optional) |
| **Reset Code** | Exactly 8 digits (non-digits stripped) |
| **Search** | Max 128 chars (clamped on change) |
| **Deposit Cash** | Amount 1–50_000 USD/EUR, max 2 decimals |
| **Deposit Crypto** | Amount 0.00001–100 BTC/ETH, max 8 decimals |
| **Withdraw** | Amount < 10 (env configurable), crypto-only |
| **Trade** | Amount/price positive, decimals per asset, balance checks |
| **2FA Code** | 6 digits (TOTP-style) |
| **Documentation** | Full table in [docs/QA_TESTING_FEATURES.md](docs/QA_TESTING_FEATURES.md) (Input field rules) |

---

### Feature: Form Error Handling (Client & Server)
**Purpose:** Consistent error messages from frontend validation and API error responses.

| Detail | Value |
|--------|-------|
| **Client Errors** | Inline validation blocks submit; no network call for that submit; error copy from `AuthMessages`, validators |
| **API Errors** | Invalid data passing client checks (e.g., wrong password on login) returns API error (401, 400, 422, etc.) |
| **Error Messages** | Aligned between frontend `lib/` validators and backend DTOs (`@IsEmail`, `@MinLength`, `@MaxLength`, etc.) |
| **Examples** | "Email is required", "Email must be at most 254 characters", "Password must be at least 6 characters" |

---

### Feature: Admin User Management UI
**Purpose:** Frontend admin panel for creating, importing, and inspecting users.

| Detail | Value |
|--------|-------|
| **Routes** | `/admin/import-users`, `/admin/impersonate` |
| **Components** | `frontend/app/admin/import-users/page.tsx`, `frontend/app/admin/impersonate/page.tsx` |
| **Import Flow** | File upload (CSV/JSON), preview, confirm, result feedback |
| **Impersonate Flow** | Search user by email/username, click to impersonate, UI shows impersonation badge, click end to restore |
| **Backend Integration** | Calls `POST /auth/admin/bulk-import-users`, `POST /auth/impersonate`, `POST /auth/end-impersonation` |
| **Notes** | Requires admin JWT; useful for test data setup |

---

### Feature: Timing & Async Waits (Simulated Persist Delay)
**Purpose:** Intentional training UX that mimics gateway/settlement lag before DB writes.

| Detail | Value |
|--------|-------|
| **Delay Duration** | `SIMULATED_PERSIST_DELAY_MS` env var (default 1200ms; set to 0 to disable) |
| **Where Applied** | `OrdersService.create()`, `DepositsService.depositFiat()`, `.depositCrypto()` |
| **Effect** | After validation + before DB write, wait for delay (e.g., 1.2s UI pause) |
| **Training Use** | Teaches QA to design stable waits instead of hard sleeps; realistic UX feel |
| **Quick Testing** | Set `SIMULATED_PERSIST_DELAY_MS=0` in `.env` for instant testing |

---

## Observability & Metrics

### Feature: Prometheus Metrics Endpoint
**Purpose:** Export application metrics in Prometheus text format.

| Detail | Value |
|--------|-------|
| **Endpoint** | `GET /metrics` (unauthenticated) |
| **Format** | Prometheus text format (lines of `metric_name metric_value`) |
| **Library** | `prom-client` (Node.js Prometheus client) |
| **Scrape Target** | Add to Prometheus config to collect metrics |
| **Use Case** | Feed into Grafana dashboard, alerting, or monitoring tools |

---

### Feature: Prometheus & Grafana Stack (Docker Compose)
**Purpose:** Full observability stack for load and performance testing.

| Detail | Value |
|--------|-------|
| **Services** | Backend, PostgreSQL, Prometheus, Grafana |
| **Command** | `npm run stack:up` or `docker compose --profile observability up -d` |
| **Prometheus URL** | `http://localhost:9090` (metrics collection) |
| **Grafana URL** | `http://localhost:3002` (visualization; login: admin/admin) |
| **Backend Metrics** | `http://localhost:3001/metrics` (scraped by Prometheus) |
| **Notes** | Full stack in containers; useful for performance investigation |

---

### Feature: Swagger API Documentation
**Purpose:** Interactive API explorer and schema documentation.

| Detail | Value |
|--------|-------|
| **URL** | `http://localhost:3001/api/docs` (live) |
| **Spec** | OpenAPI 3.0 JSON at `http://localhost:3001/api/docs-json` |
| **Static Spec** | `openapi.json` (repo root) for offline tools (Postman, Insomnia) |
| **Example Payloads** | Maintained in `backend/src/openapi/response-examples.ts` |
| **Regeneration** | `npm run openapi:generate` after API changes |
| **Notes** | Auto-generated from NestJS decorators + custom example payloads |

---

## Accessibility & UI Patterns

### Feature: Theme Support (Light/Dark Mode)
**Purpose:** Consistent emerald branding across both themes; user-selectable theme.

| Detail | Value |
|--------|-------|
| **Theme Toggle** | User preference stored (typically in `localStorage` or system preference) |
| **Tailwind Utilities** | `group-data-[theme=light]` and `@media (prefers-color-scheme: dark)` CSS patterns |
| **Primary Color** | Emerald (e.g., `bg-emerald-500/10 text-emerald-400` dark; `bg-emerald-50 text-emerald-700` light) |
| **Button Pattern** | `rounded-lg px-4 py-2 text-sm font-medium transition-colors` with hover states |
| **Compact Variant** | `px-3 py-1.5` instead of `px-4 py-2` for smaller buttons |

---

### Feature: Modal & Dialog Management
**Purpose:** Accessible modals with focus trap, stacked dialog support, and keyboard navigation.

| Detail | Value |
|--------|-------|
| **QA Testing** | Markets detail modal (`?detail=SYMBOL`), about/methodology, reset confirm (`alertdialog`), nested stacked dialogs |
| **Components** | `frontend/components/MarketsModal.tsx`, `frontend/components/MarketsCryptoDetailModal.tsx` |
| **Accessibility** | Focus trap, Escape key to close, `role="alertdialog"` for confirms |
| **URL State** | Query param `?detail=SYMBOL` persists detail modal open state |
| **Nesting** | Supports nested modals (detail → about → nested confirm) |

---

### Feature: Form Accessibility
**Purpose:** Labeled inputs, error messaging, field validation feedback.

| Detail | Value |
|--------|-------|
| **Labels** | `<label htmlFor={inputId}>` linked to input by id |
| **Error Display** | `aria-invalid="true"` + error text below input |
| **Required** | `required` attribute + visual indicator (e.g., asterisk) |
| **Input Types** | `type="email"`, `inputMode="numeric"` for contextual keyboard |
| **Testing Hooks** | `data-testid` on all inputs and buttons for automation |

---

### Feature: Keyboard Navigation & Drag-and-Drop
**Purpose:** Keyboard support for sorting, reordering, and complex interactions.

| Detail | Value |
|--------|-------|
| **Dashboard Reorder** | Drag-and-drop portfolio analytics cards via mouse **or** keyboard shortcuts via @dnd-kit |
| **Arrow Keys** | May enable sorting/navigation in tables (future) |
| **Focus Management** | Tab order follows visual hierarchy; focus trap in modals |
| **Keyboard Shortcuts** | Examples documented in UI or help section (future) |

---

### Feature: Loading & Feedback UI
**Purpose:** Visual indicators while async operations complete (submit loading bar, spinners).

| Detail | Value |
|--------|-------|
| **Submit Loading Bar** | `frontend/components/SubmitLoadingBar.tsx` (indeterminate progress bar + label) |
| **Minimum Duration** | `frontend/lib/submitLoadingMinDuration.ts` (`awaitMinElapsedSince`) enforces ~3.5s visible bar even on fast responses |
| **Where Used** | Buy/sell, fiat/crypto deposits, trade order entry |
| **UX Goal** | Prevents jarring instant feedback; teaches users to wait for confirmation |

---

### Feature: Responsive Layout (Mobile-Friendly)
**Purpose:** Flexible layouts that work on mobile, tablet, and desktop.

| Detail | Value |
|--------|-------|
| **Breakpoints** | Tailwind defaults (sm, md, lg, xl, 2xl) |
| **Patterns** | Grid for responsive tables, flexbox for layouts, max-width containers |
| **Navigation** | Header adapts; mobile may show hamburger menu (implementation detail) |
| **Forms** | Full-width inputs on mobile, narrower on desktop |
| **Notes** | Not a primary design goal; training focus, not production mobile app |

---

## Additional Utilities & Configurations

### Feature: Database Seeding
**Purpose:** Populate initial market data and optional demo users.

| Detail | Value |
|--------|-------|
| **Market Seed** | `backend/prisma/seed-market.js` — loaded by `npm run setup` (one-time) |
| **Market Data** | Trading pairs (e.g., BTC_USD, ETH_USD), initial prices, volumes |
| **Demo Users** | `backend/prisma/seed-demo.js` — loaded by `npm run db:seed` (optional) |
| **Demo Accounts** | `demo@example.com` / `password123`, `qa@example.com` / `qa123` |
| **Notes** | Market data rarely changes; demo users helpful for shared team testing |

---

### Feature: Environment Configuration
**Purpose:** Flexible env var loading for local, test, and production deployments.

| Detail | Value |
|--------|-------|
| **Config Module** | NestJS `ConfigModule` loads `.env` files via `nestEnvFilePaths()` |
| **Monorepo Loading** | Loads from `process.cwd()` first (usually `backend/`), then `__dirname` (usually `backend/dist`), then repo root |
| **Backend .env** | `backend/.env` (first priority) |
| **Root .env** | Repo root `.env` (second priority; SMTP, DB settings here) |
| **Env Vars Used** | `DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `ADMIN_API_KEY`, `SIMULATED_PERSIST_DELAY_MS`, `JWT_SECRET`, `PASSWORD_RESET_CODE_PEPPER`, `WALLET_WITHDRAW_AMOUNT_MAX`, `NEXT_PUBLIC_API_URL`, etc. |
| **Example** | `.env.example` (repo root) — copy and customize |

---

### Feature: OpenAPI Schema Generation
**Purpose:** Auto-generate OpenAPI spec from NestJS decorators and maintain it in repo.

| Detail | Value |
|--------|-------|
| **Command** | `npm run openapi:generate` (from repo root) |
| **Output** | `openapi.json` (repo root) |
| **Library** | `@nestjs/swagger` + custom example payloads |
| **Examples** | Maintained in `backend/src/openapi/response-examples.ts` + decorators |
| **Use Case** | Import into Postman, Insomnia, or other API tools; offline reference |

---

### Feature: Prisma Studio (Database Inspector)
**Purpose:** Web UI for browsing and editing database records directly.

| Detail | Value |
|--------|-------|
| **Command** | `npm run prisma:studio` (from repo root) |
| **URL** | `http://localhost:5555` (in browser) |
| **Capabilities** | View all tables, filter/sort records, add/edit/delete rows, inspect relationships |
| **Use Case** | Debugging balance issues, inspecting order state, managing test data |
| **Notes** | Handy for QA to understand schema without SQL knowledge |

---

### Feature: Database Migrations (Prisma)
**Purpose:** Version-controlled schema changes with rollback capability.

| Detail | Value |
|--------|-------|
| **Migrations Dir** | `backend/prisma/migrations/` (timestamped folders with `.sql` files) |
| **Generate** | `npm run db:migrate` (interactive; creates new migration files) |
| **Apply** | `npm run db:migrate` applies pending migrations to live DB |
| **Reset** | `npm run db:reset` (careful!) drops and recreates schema with fresh seed |
| **Rollback** | Manual (NestJS + Prisma `db push` mode doesn't auto-rollback; migrations folder gives history) |
| **Schema Source** | `backend/prisma/schema.prisma` (Prisma model definitions) |

---

### Feature: Docker Compose Services
**Purpose:** Containerized dependencies for local development and testing.

| Detail | Value |
|--------|-------|
| **File** | `docker-compose.yml` (repo root) |
| **Services** | PostgreSQL (`crypto-postgres`), Mailpit (`mailpit`), Prometheus, Grafana (optional `--profile observability`) |
| **Postgres Port** | 5432 (internal); exposed to host via `.env` `DATABASE_URL` |
| **Mailpit Ports** | SMTP: 1025, Web UI: 8025 |
| **Commands** | `npm run db:up` (Postgres + Mailpit), `npm run db:down` (stop, keep volumes), `npm run db:reset` (stop + delete volumes), `npm run stack:up` (full stack with observability) |

---

### Feature: npm Workspaces
**Purpose:** Monorepo organization for backend, frontend, and shared configs.

| Detail | Value |
|--------|-------|
| **Workspaces** | Root `package.json` defines: `backend/`, `frontend/`, optional shared libs |
| **Commands** | `npm install` (installs all), `npm run dev` (runs backend + frontend concurrently) |
| **Benefits** | Single node_modules, shared dependencies, single lockfile |
| **Scripts** | Root package orchestrates `db:up`, `setup`, `openapi:generate` across workspaces |

---

## Summary

This inventory covers **35+ core features** across:

- **Authentication**: registration, login, 2FA, password reset, admin bootstrap, impersonation
- **Trading**: spot orders, futures UI, limit/market/stop order types, matching, settlement
- **Funding**: fiat deposits, crypto deposits, withdrawals, internal transfers, payment methods
- **Portfolio**: holdings summary, allocation, analytics dashboard with reorderable cards
- **Markets**: price discovery tables, coin pickers, order books
- **Realtime**: WebSocket ticker broadcasts, stop-order triggers
- **Admin**: bulk import, user inspection, impersonation
- **Email**: welcome, password reset codes, order statuses, deposit receipts
- **Observability**: Prometheus metrics, Swagger docs, Grafana stack
- **QA**: iframe practice, input field rules, accessibility patterns, simulated persistence delay
- **Architecture**: Prisma ORM, Docker Compose, npm workspaces, OpenAPI generation

**For Product & Architecture Work:** Use this list to identify which features need PRD documentation, ADRs for design decisions, and component/module specs for implementation clarity.

