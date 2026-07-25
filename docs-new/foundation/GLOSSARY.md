# Glossary — CryptoSandboxQA

**Status:** Draft
**Source:** `ARCHITECTURE.md`, `CLAUDE.md`, `FEATURES_INVENTORY.md`

One line per term: name · canonical definition · boundary (what it is NOT).
Alphabetical.

- **Asset** — a fiat currency (USD, EUR) or cryptocurrency (BTC, ETH, etc.)
  that can be held, traded, deposited, or withdrawn, per the `assets` table.
  NOT a trading pair — a trading pair (e.g. `BTC_USD`) relates two assets.
- **Balance (available)** — the portion of a user's holding in `user_balances.balance`
  free to trade, withdraw, or transfer. NOT `balance_locked` — locked funds
  are reserved and excluded from what's spendable.
- **Balance (locked)** — the portion of a user's holding in
  `user_balances.balance_locked`, reserved while an order is open. NOT a
  separate balance — it's a hold against the same asset, released on cancel
  or moved on settlement.
- **Deposit** — funds added to a user's wallet from outside the sandbox
  (fiat via card/SEPA, or crypto via a simulated address), recorded in
  `deposits_fiat` / `deposits_crypto`. NOT a transfer — a transfer moves
  funds between two existing sandbox users.
- **Fund locking** — reserving a portion of a user's balance while an order
  is live so it can't be double-spent, released on cancel or settle. NOT
  settlement — locking holds funds temporarily, settlement moves them to
  their final owner.
- **Impersonation** — an admin acting as a target user (full API access as
  that user) without knowing their password, via `POST /auth/impersonate`,
  reversible via `POST /auth/end-impersonation`. NOT a role change — the
  underlying admin's role does not transfer to the impersonated session.
- **Order** — a request to buy or sell an asset at a given price/type
  (limit, market, or stop), tracked through validation, locking, matching,
  and settlement. See *Order lifecycle*.
- **Order lifecycle** — the full path of an order from validation → fund
  lock → persist → match → settle. NOT order matching — matching is one step
  (pairing a buy and a sell), the lifecycle is the whole sequence around it.
- **Session** — a persisted login record (`user_sessions`) backing JWT
  validation; deleted on logout, invalidating the JWT. NOT the JWT itself —
  the JWT is a bearer token; the session is the server-side record that
  makes it revocable.
- **Settlement** — moving locked funds to their final owner after an order
  matches (base to the buyer, quote to the seller). NOT fund locking —
  settlement is the final transfer, locking is the temporary hold that
  precedes it.
- **Trade** — a record of one matched pair of orders (taker + maker) at a
  given qty/price, stored in `trades`. NOT an order — an order is a request;
  a trade is the outcome when two orders match.
- **QA scenario** — a curated, guided test exercise a learner completes
  against the sandbox (e.g. verify balance locks on a limit order). NOT a
  test case — a scenario bundles setup, steps and an expected outcome for
  training, whereas a test case is one atomic assertion.
- **User** — a registered account (`users` + `user_profiles`) with a role of
  `user` or `admin`, holding balances, placing orders, and owning sessions.
- **Wallet** — the set of a user's per-asset balances (`user_balances`
  rows), covering both available and locked amounts. NOT a single balance —
  a wallet spans all assets a user holds.
- **Withdrawal** — funds removed from a user's wallet to a simulated
  external destination, recorded in `withdrawals`. NOT a transfer — a
  withdrawal leaves the sandbox (simulated); a transfer stays within it.
