# CryptoSandboxQA — Production Database Schema Design Proposal

**Branch:** `feature/database-schema`  
**Status:** Implemented (Prisma schema, seed, backend services updated)

---

## Codebase Analysis Summary

### Current Implementation
| Area | Backend | Frontend | DB Support |
|------|---------|----------|-------------|
| **Users** | UsersService, AuthService | Profile, Settings | `users` |
| **Auth** | JWT, bcrypt | Login, Register | No sessions table |
| **2FA** | Not implemented | Mock UI (QR, backup codes) | None |
| **Wallets** | WalletsService | Dashboard, Deposit (simple) | `wallets`, `wallet_transactions` |
| **Orders** | OrdersService, MatchingService | Market, History, TradeOrdersTabs | `orders`, `trades` |
| **Deposit Fiat** | None (UI only) | DepositCashForm (card/SEPA/Apple Pay) | None |
| **Deposit Crypto** | None (UI only) | DepositCryptoForm, wallet addresses | None |
| **Cryptos** | CryptosService | Markets, BuyCrypto, CryptoSearchSelect | `cryptos` |
| **Tickers** | TickersService | WebSocket, trade matching | `tickers` |
| **Portfolio** | None | Mock from `mockUser` | None |
| **Order Filters** | status, symbol | date ranges, sort, coin, status | Partial |

### Planned / Future Features (from UI)
- Two-Factor Authentication (backend integration)
- Fiat deposits (card, SEPA, Apple Pay) with payment methods
- Crypto deposits (wallet addresses per asset)
- Profile photo (storage URL or blob)
- User sessions (for logout-all, session management)
- Payment methods (stored for users)
- Transaction history (unified: deposits, withdrawals, trades)
- Portfolio (from wallets + prices)
- Order history with date filters, sorting
- Failed transaction tracking
- Verification / KYC status

---

## Step 1 — Database Design and Relationships

### Design Principles
1. **Normalize** where it aids clarity; denormalize sparingly for read-heavy paths (e.g. portfolio snapshots).
2. **Audit trail** — all financial moves via transaction tables; immutable logs.
3. **Status lifecycle** — orders, deposits, withdrawals use explicit statuses for testing transitions.
4. **Extensibility** — payment methods, fiat currencies, assets are configurable.

### Entity Overview

| Entity | Purpose |
|--------|---------|
| **users** | Core user identity (email, password hash, profile) |
| **user_profiles** | Extensible profile fields (photo URL, username, verification) |
| **user_two_factor** | 2FA setup: secret, backup codes, enabled flag |
| **user_sessions** | Active sessions for auth / logout-all |
| **user_payment_methods** | Saved payment methods (card/SEPA/Apple Pay) |
| **user_balances** | Per-user, per-asset: available, locked |
| **balance_transactions** | Unified ledger for all balance changes (deposits, withdrawals, trades) |
| **assets** | Supported assets (crypto + fiat), wallet address per crypto |
| **trading_pairs** | Symbol definitions (base/quote) |
| **crypto_prices** | Price history / last price per symbol (for analytics) |
| **orders** | Limit/market orders with full lifecycle |
| **trades** | Executed fills linking buyer/seller orders |
| **deposits_fiat** | Fiat deposit requests (amount, currency, payment method, status) |
| **deposits_crypto** | Crypto deposit requests (asset, amount, wallet address, tx hash, status) |
| **withdrawals** | Withdrawal requests (asset, amount, destination, status) |

### Relationships (High Level)
- User → 1:N: profiles, 2FA, sessions, payment methods, balances, orders, deposits, withdrawals
- Order → 1:N: trades (as taker)
- Trade → N:1: taker_order, maker_order (two orders per trade)
- Balance → 1:N: balance_transactions
- Asset → 1:N: balances, deposits, withdrawals
- Trading_pair → 1:N: orders, crypto_prices

---

## Step 2 — Table Relationship Overview (ERD-style)

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────────────┐
│     users       │──1:N──│   user_profiles      │       │   user_two_factor       │
│ id (PK)         │       │ id (PK), user_id     │       │ id (PK), user_id       │
│ email (UK)      │──1:N──│ photo_url, username  │       │ secret, enabled        │
│ password_hash   │       │ verification_status  │       │ backup_codes (JSON)    │
│ display_name    │       └──────────────────────┘       └─────────────────────────┘
│ created_at      │──1:N──┌──────────────────────┐
│ updated_at      │       │   user_sessions     │
└────────┬────────┘       │ id (PK), user_id    │
         │                │ token_hash, expires │
         │1:N             └──────────────────────┘
         │
         ├──────────────────────────────────────────────────────┐
         │                                                        │
         ▼                                                        ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│ user_payment_methods   │    │      user_balances      │    │       orders        │
│ id (PK), user_id       │    │ id (PK), user_id        │    │ id (PK), user_id    │
│ type (card/sepa/apple)  │    │ asset_id               │    │ symbol              │
│ masked_details (JSON)   │    │ balance_available      │    │ side, type          │
│ is_default             │    │ balance_locked         │    │ quantity, price     │
└─────────────────────────┘    └───────────┬────────────┘    │ filled_quantity     │
                                           │                 │ status             │
         ┌─────────────────────────────────┼─────────────────┴───────────┬────────┘
         │                                 │                             │
         ▼                                 ▼                             ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│   balance_transactions  │    │        assets           │    │       trades         │
│ id (PK)                 │    │ id (PK)                 │    │ id (PK)             │
│ user_id, balance_id     │    │ symbol (UK), name       │    │ taker_order_id      │
│ type, amount, ref_id    │    │ type (crypto/fiat)      │    │ maker_order_id      │
│ balance_before          │    │ wallet_address (crypto) │    │ quantity, price     │
└─────────────────────────┘    └─────────────────────────┘    └─────────────────────┘
         │
         │  type IN (deposit, withdraw, trade_buy, trade_sell, order_lock, order_unlock)
         │
         ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│    deposits_fiat        │    │    deposits_crypto      │
│ id (PK), user_id        │    │ id (PK), user_id       │
│ fiat_currency, amount   │    │ asset_id, amount        │
│ payment_method_id       │    │ wallet_address          │
│ status, failure_reason  │    │ tx_hash, status         │
└─────────────────────────┘    └─────────────────────────┘

┌─────────────────────────┐    ┌─────────────────────────┐
│   trading_pairs         │    │    crypto_prices        │
│ symbol (PK)             │    │ id (PK)                 │
│ base_asset_id, quote_id  │    │ symbol (FK)            │
│ is_active               │    │ price, volume_24h       │
└─────────────────────────┘    │ recorded_at            │
                               └─────────────────────────┘
```

### Key Relationships
- **users ↔ user_balances**: One balance per (user, asset)
- **orders ↔ trades**: A trade links taker_order and maker_order; each order has many trades (partial fills)
- **balance_transactions**: Central ledger; `ref_type` + `ref_id` point to orders, deposits, withdrawals
- **assets**: Single source of truth for symbols; crypto has wallet_address for deposits

---

## Step 3 — PostgreSQL SQL Schema

```sql
-- =============================================================================
-- CRYPTOSANDBOXQA - Production Database Schema
-- PostgreSQL 16+
-- =============================================================================

-- Extensions (optional, for UUID generation if not using gen_random_uuid())
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. USERS & AUTH
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  display_name      VARCHAR(100),
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (LOWER(email));
CREATE INDEX idx_users_created_at ON users (created_at);

-- -----------------------------------------------------------------------------
-- 2. USER PROFILES (extensible)
-- -----------------------------------------------------------------------------

CREATE TABLE user_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  photo_url            VARCHAR(512),
  username             VARCHAR(50) UNIQUE,
  verification_status  VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles (user_id);

-- -----------------------------------------------------------------------------
-- 3. TWO-FACTOR AUTHENTICATION
-- -----------------------------------------------------------------------------

CREATE TABLE user_two_factor (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  secret         VARCHAR(64) NOT NULL,
  backup_codes    JSONB DEFAULT '[]',  -- array of hashed codes
  enabled        BOOLEAN NOT NULL DEFAULT false,
  enabled_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_user_two_factor_user_id ON user_two_factor (user_id);

-- -----------------------------------------------------------------------------
-- 4. USER SESSIONS
-- -----------------------------------------------------------------------------

CREATE TABLE user_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,
  user_agent   VARCHAR(512),
  ip_address   INET,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);

-- -----------------------------------------------------------------------------
-- 5. ASSETS (crypto + fiat)
-- -----------------------------------------------------------------------------

CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          VARCHAR(20) NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  asset_type      VARCHAR(10) NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  wallet_address  VARCHAR(255),  -- for crypto deposits; null for fiat
  decimals        SMALLINT NOT NULL DEFAULT 8,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_symbol ON assets (symbol);
CREATE INDEX idx_assets_asset_type ON assets (asset_type);

-- -----------------------------------------------------------------------------
-- 6. TRADING PAIRS
-- -----------------------------------------------------------------------------

CREATE TABLE trading_pairs (
  symbol        VARCHAR(20) PRIMARY KEY,
  base_asset_id  UUID NOT NULL REFERENCES assets (id),
  quote_asset_id UUID NOT NULL REFERENCES assets (id),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_asset_id, quote_asset_id)
);

-- -----------------------------------------------------------------------------
-- 7. USER BALANCES (available + locked)
-- -----------------------------------------------------------------------------

CREATE TABLE user_balances (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_id           UUID NOT NULL REFERENCES assets (id),
  balance_available  DECIMAL(30, 8) NOT NULL DEFAULT 0 CHECK (balance_available >= 0),
  balance_locked     DECIMAL(30, 8) NOT NULL DEFAULT 0 CHECK (balance_locked >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset_id)
);

CREATE INDEX idx_user_balances_user_id ON user_balances (user_id);
CREATE INDEX idx_user_balances_asset_id ON user_balances (asset_id);

-- -----------------------------------------------------------------------------
-- 8. BALANCE TRANSACTIONS (unified ledger)
-- -----------------------------------------------------------------------------

CREATE TABLE balance_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  balance_id      UUID NOT NULL REFERENCES user_balances (id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES assets (id),
  type            VARCHAR(30) NOT NULL CHECK (type IN (
    'deposit', 'withdraw', 'trade_buy', 'trade_sell',
    'order_lock', 'order_unlock', 'trade_fee', 'transfer'
  )),
  amount          DECIMAL(30, 8) NOT NULL,  -- positive = credit, negative = debit
  balance_before  DECIMAL(30, 8) NOT NULL,
  balance_after   DECIMAL(30, 8) NOT NULL,
  ref_type        VARCHAR(20),   -- 'order', 'trade', 'deposit_fiat', 'deposit_crypto', 'withdrawal'
  ref_id          UUID,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_balance_transactions_user_id ON balance_transactions (user_id);
CREATE INDEX idx_balance_transactions_balance_id ON balance_transactions (balance_id);
CREATE INDEX idx_balance_transactions_created_at ON balance_transactions (created_at);
CREATE INDEX idx_balance_transactions_ref ON balance_transactions (ref_type, ref_id);
CREATE INDEX idx_balance_transactions_user_created ON balance_transactions (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 9. PAYMENT METHODS
-- -----------------------------------------------------------------------------

CREATE TABLE user_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('card', 'sepa', 'applepay')),
  masked_details  JSONB NOT NULL,  -- e.g. {"last4":"4242","brand":"visa"} or {"iban_masked":"DE89****3000"}
  is_default      BOOLEAN NOT NULL DEFAULT false,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_payment_methods_user_id ON user_payment_methods (user_id);

-- -----------------------------------------------------------------------------
-- 10. CRYPTO PRICES (tickers + optional history)
-- -----------------------------------------------------------------------------

CREATE TABLE crypto_prices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol      VARCHAR(20) NOT NULL REFERENCES trading_pairs (symbol),
  price       DECIMAL(30, 8) NOT NULL,
  volume_24h   DECIMAL(30, 8) NOT NULL DEFAULT 0,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_crypto_prices_symbol_latest ON crypto_prices (symbol, recorded_at DESC);
-- Alternative: single row per symbol (upsert) — use (symbol) as PK for "last price" table
-- For analytics, keep history; for simple ticker, use upsert on symbol.

-- Simplified tickers table (current behavior: one row per symbol, last price)
CREATE TABLE tickers (
  symbol      VARCHAR(20) PRIMARY KEY REFERENCES trading_pairs (symbol),
  last_price  DECIMAL(30, 8) NOT NULL,
  volume_24h   DECIMAL(30, 8) NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 11. ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  symbol          VARCHAR(20) NOT NULL REFERENCES trading_pairs (symbol),
  side            VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type      VARCHAR(10) NOT NULL CHECK (order_type IN ('limit', 'market')),
  quantity        DECIMAL(30, 8) NOT NULL CHECK (quantity > 0),
  price           DECIMAL(30, 8),  -- NULL for market orders
  filled_quantity  DECIMAL(30, 8) NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
  order_status    VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (order_status IN (
    'open', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired'
  )),
  failure_reason  VARCHAR(255),  -- for rejected/failed orders
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ  -- when filled or cancelled
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_symbol ON orders (symbol);
CREATE INDEX idx_orders_order_status ON orders (order_status);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX idx_orders_user_status_symbol ON orders (user_id, order_status, symbol);

-- -----------------------------------------------------------------------------
-- 12. TRADES (executed fills)
-- -----------------------------------------------------------------------------

CREATE TABLE trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          VARCHAR(20) NOT NULL REFERENCES trading_pairs (symbol),
  taker_order_id  UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  maker_order_id  UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  taker_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  maker_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  quantity        DECIMAL(30, 8) NOT NULL CHECK (quantity > 0),
  price           DECIMAL(30, 8) NOT NULL CHECK (price > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trades_taker_order_id ON trades (taker_order_id);
CREATE INDEX idx_trades_maker_order_id ON trades (maker_order_id);
CREATE INDEX idx_trades_symbol ON trades (symbol);
CREATE INDEX idx_trades_created_at ON trades (created_at DESC);
CREATE INDEX idx_trades_taker_user_id ON trades (taker_user_id);
CREATE INDEX idx_trades_maker_user_id ON trades (maker_user_id);

-- -----------------------------------------------------------------------------
-- 13. DEPOSITS (FIAT)
-- -----------------------------------------------------------------------------

CREATE TABLE deposits_fiat (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  fiat_currency     VARCHAR(10) NOT NULL,
  amount            DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
  fee               DECIMAL(20, 2) NOT NULL DEFAULT 0,
  payment_method_id UUID REFERENCES user_payment_methods (id),
  payment_method_type VARCHAR(20),  -- card, sepa, applepay
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  failure_reason     VARCHAR(255),
  external_ref      VARCHAR(100),  -- payment provider reference
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_deposits_fiat_user_id ON deposits_fiat (user_id);
CREATE INDEX idx_deposits_fiat_status ON deposits_fiat (status);
CREATE INDEX idx_deposits_fiat_created_at ON deposits_fiat (created_at DESC);

-- -----------------------------------------------------------------------------
-- 14. DEPOSITS (CRYPTO)
-- -----------------------------------------------------------------------------

CREATE TABLE deposits_crypto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES assets (id),
  amount          DECIMAL(30, 8) NOT NULL CHECK (amount > 0),
  wallet_address  VARCHAR(255) NOT NULL,
  tx_hash         VARCHAR(128),  -- blockchain tx once confirmed
  confirmations   SMALLINT DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirming', 'completed', 'failed', 'cancelled'
  )),
  failure_reason   VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_deposits_crypto_user_id ON deposits_crypto (user_id);
CREATE INDEX idx_deposits_crypto_asset_id ON deposits_crypto (asset_id);
CREATE INDEX idx_deposits_crypto_status ON deposits_crypto (status);
CREATE INDEX idx_deposits_crypto_created_at ON deposits_crypto (created_at DESC);

-- -----------------------------------------------------------------------------
-- 15. WITHDRAWALS
-- -----------------------------------------------------------------------------

CREATE TABLE withdrawals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES assets (id),
  amount          DECIMAL(30, 8) NOT NULL CHECK (amount > 0),
  destination    VARCHAR(255) NOT NULL,  -- address or IBAN
  fee             DECIMAL(30, 8) DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  failure_reason   VARCHAR(255),
  tx_hash         VARCHAR(128),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_withdrawals_user_id ON withdrawals (user_id);
CREATE INDEX idx_withdrawals_status ON withdrawals (status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals (created_at DESC);

-- -----------------------------------------------------------------------------
-- 16. CRYPTOS (market listings - from existing schema, optional)
-- -----------------------------------------------------------------------------

CREATE TABLE cryptos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  symbol      VARCHAR(20) NOT NULL UNIQUE,
  price       DECIMAL(30, 8) NOT NULL,
  change_24h   DECIMAL(10, 4) NOT NULL,
  volume_24h   DECIMAL(30, 8) NOT NULL DEFAULT 0,
  popular      BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Triggers: updated_at
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['users','user_profiles','user_two_factor','assets','trading_pairs',
      'user_balances','user_payment_methods','tickers','orders','deposits_fiat','deposits_crypto','withdrawals'])
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;  -- table may not exist yet
END $$;
```

---

## Step 4 — Sample Queries for Testing

### 1. Complex Joins — Order History with Trade Details
```sql
SELECT
  o.id AS order_id,
  o.symbol,
  o.side,
  o.order_type,
  o.quantity,
  o.filled_quantity,
  o.price,
  o.order_status,
  o.created_at,
  json_agg(
    json_build_object(
      'trade_id', t.id,
      'quantity', t.quantity,
      'price', t.price,
      'created_at', t.created_at
    )
  ) FILTER (WHERE t.id IS NOT NULL) AS trades
FROM orders o
LEFT JOIN trades t ON t.taker_order_id = o.id OR t.maker_order_id = o.id
WHERE o.user_id = $1
  AND o.created_at BETWEEN $2 AND $3
  AND o.order_status IN ('filled', 'cancelled')
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 50;
```

### 2. Portfolio Calculation (from balances + current prices)
```sql
SELECT
  a.symbol,
  ub.balance_available + ub.balance_locked AS total_balance,
  COALESCE(t.last_price, c.price) AS current_price,
  (ub.balance_available + ub.balance_locked) * COALESCE(t.last_price, c.price) AS total_value_usd
FROM user_balances ub
JOIN assets a ON a.id = ub.asset_id
LEFT JOIN tickers t ON t.symbol = a.symbol || '_USD'
LEFT JOIN cryptos c ON c.symbol = a.symbol
WHERE ub.user_id = $1
  AND (ub.balance_available + ub.balance_locked) > 0;
```

### 3. Aggregation — Trading Volume by User (last 30 days)
```sql
SELECT
  u.id,
  u.email,
  SUM(t.quantity * t.price) AS volume_usd
FROM users u
JOIN trades t ON t.taker_user_id = u.id OR t.maker_user_id = u.id
WHERE t.created_at >= now() - interval '30 days'
GROUP BY u.id, u.email
ORDER BY volume_usd DESC;
```

### 4. Order History with Filters (status, symbol, date range)
```sql
SELECT *
FROM orders
WHERE user_id = $1
  AND ($2::text IS NULL OR order_status = $2)
  AND ($3::text IS NULL OR symbol = $3)
  AND ($4::timestamptz IS NULL OR created_at >= $4)
  AND ($5::timestamptz IS NULL OR created_at <= $5)
ORDER BY created_at DESC
LIMIT $6 OFFSET $7;
```

### 5. Transaction History (unified: deposits, withdrawals, trades)
```sql
SELECT
  bt.id,
  bt.type,
  bt.amount,
  bt.balance_after,
  bt.ref_type,
  bt.ref_id,
  bt.created_at,
  a.symbol
FROM balance_transactions bt
JOIN assets a ON a.id = bt.asset_id
WHERE bt.user_id = $1
  AND bt.created_at BETWEEN $2 AND $3
ORDER BY bt.created_at DESC
LIMIT 100;
```

### 6. Failed Transactions (for QA)
```sql
SELECT *
FROM deposits_fiat
WHERE status = 'failed'
  AND created_at >= $1;

SELECT *
FROM deposits_crypto
WHERE status = 'failed'
  AND created_at >= $1;

SELECT *
FROM orders
WHERE order_status = 'rejected'
  AND created_at >= $1;
```

### 7. Partial Order Analysis
```sql
SELECT
  o.id,
  o.symbol,
  o.quantity,
  o.filled_quantity,
  o.quantity - o.filled_quantity AS remaining,
  o.order_status
FROM orders o
WHERE o.order_status = 'partially_filled'
  AND o.user_id = $1;
```

### 8. Deposit Summary by Payment Method
```sql
SELECT
  payment_method_type,
  status,
  COUNT(*) AS count,
  SUM(amount) AS total_amount
FROM deposits_fiat
WHERE user_id = $1
  AND created_at >= $2
GROUP BY payment_method_type, status;
```

---

## Migration Path from Current Schema

| Current Table | Action | New Table(s) |
|---------------|--------|--------------|
| users | Extend | users (add email_verified_at); user_profiles |
| wallets | Replace | user_balances (available + locked) |
| wallet_transactions | Replace | balance_transactions |
| orders | Extend | orders (order_type, order_status, failure_reason, completed_at) |
| trades | Extend | trades (taker/maker order + user IDs) |
| tickers | Keep | tickers |
| cryptos | Keep | cryptos |
| — | Add | assets, trading_pairs, user_two_factor, user_sessions, user_payment_methods, deposits_fiat, deposits_crypto, withdrawals, crypto_prices |

---

## Next Steps After Approval

1. Create Prisma schema (or raw SQL migrations) from this design.
2. Update seed script for demo data.
3. Add migration to migrate existing `wallets` → `user_balances`, `wallet_transactions` → `balance_transactions`.
4. Implement backend services for new tables (2FA, deposits, etc.) in separate PRs.

---

*Document generated for review. No migrations have been implemented yet.*
