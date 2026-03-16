# CryptoSandboxQA — Architecture

A small crypto exchange training platform for QA practice. Simulate trades, validate transactions, and test automation on a safe environment.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS (TypeScript) |
| Frontend | Next.js (React) |
| Database | PostgreSQL |
| Realtime | WebSocket |

---

## Backend Modules

```mermaid
flowchart TB
    subgraph nestjs [NestJS Backend]
        AuthModule[AuthModule]
        UsersModule[UsersModule]
        WalletsModule[WalletsModule]
        OrdersModule[OrdersModule]
        TickersModule[TickersModule]
        WebSocketModule[WebSocket Gateway]
    end
    
    AuthModule --> UsersModule
    WalletsModule --> UsersModule
    OrdersModule --> WalletsModule
    OrdersModule --> TickersModule
    WebSocketModule --> TickersModule
    nestjs --> PostgreSQL[(PostgreSQL)]
```

| Module | Responsibility |
|--------|----------------|
| **AuthModule** | Register, login (JWT), password hashing (bcrypt), guards for protected routes |
| **UsersModule** | User profile CRUD (id, email, displayName) |
| **WalletsModule** | Per-user wallets: balance per asset (USD, BTC, ETH). Deposit/withdraw for training |
| **OrdersModule** | Create/cancel/list orders (limit/market). Simple order matching |
| **TickersModule** | Last price + 24h stats per symbol. Feeds WebSocket |
| **WebSocketModule** | Broadcasts price updates. Clients subscribe by symbol |

---

## Database Tables

The schema has been extended to a production-style design. See [docs/DATABASE_DESIGN_PROPOSAL.md](docs/DATABASE_DESIGN_PROPOSAL.md) for the full design.

**Core tables in use:**
- **users**: id, email (unique), passwordHash, displayName, createdAt, updatedAt
- **assets**: id, symbol, name, assetType (crypto/fiat), walletAddress (for crypto deposits)
- **trading_pairs**: symbol (PK), baseAssetId, quoteAssetId — defines tradeable pairs (e.g. BTC_USD)
- **user_balances**: id, userId, assetId, balanceAvailable, balanceLocked. Unique (userId, assetId)
- **balance_transactions**: audit trail for all balance changes (deposit, withdraw, trade_*)
- **orders**: id, userId, symbol, side, orderType (limit/market), quantity, price, filledQuantity, orderStatus, createdAt
- **trades**: id, takerOrderId, makerOrderId, takerUserId, makerUserId, quantity, price, createdAt
- **tickers**: symbol (PK), lastPrice, volume24h — last price per trading pair
- **cryptos**: market listings for Markets pages (100+ coins)

**Additional tables (for future features):** user_profiles, user_two_factor, user_sessions, user_payment_methods, deposits_fiat, deposits_crypto, withdrawals

---

## Services

| Service | Module | Responsibility |
|---------|--------|----------------|
| **AuthService** | AuthModule | Hash password, validate credentials, issue JWT |
| **UsersService** | UsersModule | Create user, find by id/email, update profile |
| **WalletsService** | WalletsModule | Get/create wallet, credit/debit balance |
| **OrdersService** | OrdersModule | Create order, cancel, list. Validates balance and calls matching |
| **MatchingService** | OrdersModule | Match orders (FIFO), create trades, update wallets |
| **TickersService** | TickersModule | Get/set last price per symbol. Used by WebSocket |
| **WebSocketGateway** | WebSocketModule | Broadcast ticker updates when client subscribes by symbol |

---

## WebSocket Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant TickersService
    
    Client->>Gateway: connect + subscribe(BTC_USD)
    Gateway->>TickersService: get last price
    TickersService-->>Gateway: price
    Gateway->>Client: ticker update
    loop every N ms or on change
        Gateway->>TickersService: get prices
        Gateway->>Client: broadcast ticker
    end
```

- Client connects and sends `subscribe: "BTC_USD"` (or similar).
- Server emits `ticker` events with `{ symbol, lastPrice, volume24h }`.
- Prices are mock/simulated (no external APIs).

---

## Frontend Structure

- **App Router** pages: `/login`, `/register`, `/dashboard` (wallets + open orders), `/market` (order book + place order), `/history`.
- **API client**: REST for auth and orders; WebSocket for live prices.
- **State**: React state or Zustand for user, wallets, live ticker.

---

## UI Conventions

### Button Styling (Branding)

Use consistent emerald branding for primary/secondary action buttons (dropdown triggers, Back, Logout, Load more, sort headers):

```
rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none 
bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 
group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 
group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800
```

For compact buttons (e.g. table headers): use `px-3 py-1.5` instead of `px-4 py-2`.

---

## QA Scenarios

1. **Auth**: Register → Login → Logout.
2. **Wallets**: Deposit USD → Verify balance.
3. **Orders**: Place limit buy → Check order status → Fill (or cancel).
4. **Realtime**: Connect WebSocket → Subscribe to symbol → Assert ticker updates.
