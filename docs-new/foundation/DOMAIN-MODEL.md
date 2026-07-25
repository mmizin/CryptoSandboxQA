# Domain Model — CryptoSandboxQA

**Status:** Draft
**Source:** `ARCHITECTURE.md` § Database (Prisma), `CLAUDE.md`,
`FEATURES_INVENTORY.md`

Core entities and relationships, at the level a PRD or ADR should reference
rather than re-derive. See `backend/prisma/schema.prisma` for full DDL and
`docs/DATABASE_DESIGN_PROPOSAL.md` for narrative detail.

## Entity relationship overview

```
User ──1:1── UserProfile
User ──1:N── UserSession
User ──1:1── UserTwoFactor
User ──1:N── UserPasswordReset
User ──1:N── UserPaymentMethod
User ──1:N── UserBalance ──N:1── Asset
User ──1:N── Order ──N:1── TradingPair
User ──1:N── DepositFiat / DepositCrypto
User ──1:N── Withdrawal
Order ──1:N── Trade (as maker or taker)
UserBalance ──1:N── BalanceTransaction
```

## Entities

| Entity | Table(s) | Key relationships |
|---|---|---|
| User | `users`, `user_profiles` | Owns balances, orders, sessions, deposits, withdrawals, payment methods |
| UserSession | `user_sessions` | Belongs to User; tracks `impersonated_by` when applicable |
| UserBalance | `user_balances` | Belongs to User + Asset; has `balance` and `balance_locked` |
| BalanceTransaction | `balance_transactions` | Belongs to UserBalance; typed log (`order_lock`, `order_unlock`, `order_fill`, `deposit`, `withdrawal`, `transfer`) |
| Order | `orders` | Belongs to User + TradingPair; has type (limit/market/stop), side (buy/sell), status, optional `stop_price` |
| Trade | `trades` | References two Orders (taker + maker); qty, price, timestamp |
| Asset | `assets` | Fiat or crypto; referenced by UserBalance, TradingPair |
| TradingPair | `trading_pairs` | Pairs two Assets (e.g. BTC_USD); referenced by Order, Ticker |
| Ticker | `tickers` | Last price + 24h volume per TradingPair |
| DepositFiat / DepositCrypto | `deposits_fiat`, `deposits_crypto` | Belongs to User; credits UserBalance on success |
| Withdrawal | `withdrawals` | Belongs to User; debits UserBalance |
| UserPaymentMethod | `user_payment_methods` | Belongs to User; optionally referenced by DepositFiat |

## Balance mechanics (the model's central invariant)

`UserBalance.balance` (available) and `UserBalance.balance_locked` (reserved)
together represent a user's total holding per asset. State transitions:

1. **Lock** — placing an order moves value from implicit availability into
   `balance_locked` (sell: base asset qty; buy: quote value ≈ qty × limit
   price, or last price for market buys). Logged as `order_lock`.
2. **Unlock** — cancelling or partially/fully filling releases the locked
   portion back or moves it to settlement. Logged as `order_unlock`.
3. **Settle** — on trade match, locked funds move to the counterparty's
   `balance` (available), not back to the original owner. Logged as
   `order_fill`.

Every transition has a corresponding `balance_transactions` row — this is
the audit trail that makes balance state independently verifiable, and the
reason `CLAUDE.md` flags this mechanic as critical for testing.

## Open questions

- [ ] Whether `TradingPair` is a distinct Prisma model or derived from
      `Asset` pairs embedded in `Order.symbol` is not fully disambiguated in
      `ARCHITECTURE.md`'s table list (it lists `trading_pairs` as a model but
      most feature descriptions reference `orders.symbol` directly) — owner:
      mmizin, resolve via architecture-discovery when Order Creation &
      Lifecycle (Phase 5) is documented.

## Related

- [`GLOSSARY.md`](GLOSSARY.md) — term definitions
- [`SYSTEM-OVERVIEW.md`](SYSTEM-OVERVIEW.md) — order lifecycle narrative
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) § Database (Prisma) — full DDL reference
