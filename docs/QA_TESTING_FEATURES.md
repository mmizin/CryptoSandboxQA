# QA testing features

This document lists **purpose-built surfaces** in CryptoSandboxQA for manual checks and automation practice (selectors, frames, API-backed flows). Add a new section here whenever you introduce another training or testability feature.

---

## Form validation and input rules (client-side)

The Next.js app applies **client-side** checks before many auth API calls so QA can run **positive** (valid data → request proceeds) and **negative** (invalid data → inline errors, **no** request) scenarios. Messages and limits are defined in [`frontend/lib/authFieldConstraints.ts`](../frontend/lib/authFieldConstraints.ts) (`AuthMessages`, validators aligned with Nest `class-validator` DTOs). Other shared limits: [`searchFieldConstraints.ts`](../frontend/lib/searchFieldConstraints.ts) (search inputs), [`trainingDepositConstraints.ts`](../frontend/lib/trainingDepositConstraints.ts) (dashboard training deposit).

### Auth screens (`data-testid` for assertions)

| Screen | Path | Key rules | Error `data-testid` suffixes |
|--------|------|-----------|------------------------------|
| Sign in | `/` | Email format + max length 254; password min length **6** | `login-email`, `login-password`, `login-email-error`, `login-password-error` |
| Register | `/register` | Same + optional display name max **100** chars | `register-email`, `register-display-name`, `register-password`, `*-error` |
| Forgot password | `/forgot-password` | Email format + max length | `forgot-password-email`, `forgot-password-email-error` |
| Reset password | `/reset-password` | Email; **8-digit** code (digits only); new password min **6**; confirm must match | `reset-password-email`, `reset-password-code`, `reset-password-new`, `reset-password-confirm`, `*-error` |

**Stable message strings** (assert in Playwright; keep in sync with `AuthMessages`):

- `Enter a valid email address` — invalid or empty email (empty email may also show `Email is required` depending on field).
- `Password must be at least 6 characters` — password too short.
- `Display name must be at most 100 characters` — optional display name too long.
- `Reset code must be 8 digits` — code not exactly eight digits.
- `Passwords do not match` — reset form confirm mismatch (same as before).

### Other inputs

| Area | Behavior |
|------|----------|
| Markets / trade search | Max **128** characters (`SEARCH_MAX_LENGTH`), clamped in `onChange` — [`markets-search-input`](../frontend/components/MarketsCryptoTable.tsx) on markets tables. |
| Crypto combobox search | Same clamp — [`CryptoSearchSelect`](../frontend/components/CryptoSearchSelect.tsx). |
| Admin impersonate search | Same clamp — `admin-impersonate-search`. |
| Dashboard training deposit | Positive amount only, max **1_000_000_000** — messages `Enter a positive amount` / `Amount must be at most …`; `data-testid="dashboard-deposit-amount"`. Server still enforces `DepositDto` (`IsPositive`). |

### Automation

- Use Playwright (or other runners) against the `data-testid` values and **Stable message strings** above when you add your own specs. If you change `AuthMessages` in [`authFieldConstraints.ts`](../frontend/lib/authFieldConstraints.ts), keep any assertions in your tests aligned with the updated strings.

### API vs client

- **Client validation** blocks submit and shows inline errors (no network call for that submit).
- **Invalid data that passes client checks** (e.g. wrong login password) still returns **API errors** — use [`tests/ui-tests/tests/e2e/login.spec.ts`](../tests/ui-tests/tests/e2e/login.spec.ts) for invalid-credentials server responses.

---

## Auth: forgot password (8-digit email code)

End-to-end password reset for QA: code is delivered by **SMTP** (Mailpit in dev) or appears in the **backend log** if SMTP is not configured.

### UI & entry points

| Step | Location |
|------|----------|
| Request code | [`/forgot-password`](../frontend/app/forgot-password/page.tsx) — also linked from **Forgot password?** on the home sign-in form ([`/`](../frontend/app/page.tsx)). |
| Apply code | [`/reset-password`](../frontend/app/reset-password/page.tsx) — email + **8-digit code** + new password (with confirmation). |

### API (unauthenticated)

| Method | Path | Body | Notes |
|--------|------|------|------|
| `POST` | `/auth/forgot-password` | `{ "email": "user@example.com" }` | Always **200** + generic message (no email enumeration). |
| `POST` | `/auth/reset-password` | `{ "email", "code", "newPassword" }` | `code`: 8 digits (spaces stripped server-side). `newPassword`: min length **6** (same as register). **400** if code wrong/expired or email unknown. Success invalidates **all** sessions for that user. |

Client helpers: [`authApi.forgotPassword` / `authApi.resetPasswordWithCode`](../frontend/lib/api.ts).

### Prerequisites for “real” mail in Mailpit

1. **Database:** `user_password_resets` table must exist — run **`npm run setup`** or **`npm run db:migrate`** so Prisma `db push` applies [`schema.prisma`](../backend/prisma/schema.prisma).
2. **Mailpit:** `npm run db:up` starts Postgres + Mailpit (see root [`docker-compose.yml`](../docker-compose.yml)). SMTP **1025**, UI **8025** (ports overridable via `MAILPIT_SMTP_PORT` / `MAILPIT_HTTP_PORT`).
3. **Env (repo root `.env` recommended):** `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_SECURE=false`. Optional: `MAIL_FROM`. Nest loads root `.env` when the API runs from the `backend/` workspace—see [`nestEnvFilePaths()`](../backend/src/app.module.ts) in [ARCHITECTURE.md](../ARCHITECTURE.md).
4. **Registered user:** Forgot-password **sends nothing** if `email` is not in `users` (response still looks like success). Use a seeded account (e.g. `demo@example.com` after `npm run db:seed`) or register first.

### Manual test checklist

1. Open Mailpit: [http://localhost:8025](http://localhost:8025).
2. Submit forgot-password for a **known** user email.
3. Open the new message; copy the **8-digit** code from the body.
4. On `/reset-password`, paste code, set new password, submit → expect redirect to sign-in; login with new password.

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Mailpit empty, API “success” | Email not in DB; or SMTP misread — check backend log for **`[no SMTP_HOST — email was not sent]`** (fix `SMTP_HOST`, not `MTP_HOST`; restart `npm run dev`). |
| Mailpit empty, log shows code | Expected when **`SMTP_HOST` unset** — use the code from the **terminal** on `/reset-password`, or set SMTP and retry. |
| Reset returns “Invalid or expired” | Wrong code, expired (**30 min**), or typo in email; request a new code. |
| Connection errors in log | Mailpit not running or wrong port (**1025** for SMTP from host). |

### Automation hints

- Mailpit exposes a **REST API** on the same port as the UI (e.g. list messages) for E2E tests that need to read the code without the browser—see [Mailpit API docs](https://mailpit.axllent.org/docs/api-v1/).
- Static OpenAPI: [`docs/openapi.json`](./openapi.json) (`/auth/forgot-password`, `/auth/reset-password`).

---

## Transactional email (welcome, orders, deposits)

Same **SMTP / Mailpit / log-if-no-host** pipeline as forgot-password ([`MailService`](../backend/src/mail/mail.service.ts)). Plain-text messages; inspect **Mailpit** at [http://localhost:8025](http://localhost:8025) when `SMTP_HOST` is set, or the **API terminal** for `[no SMTP_HOST — email was not sent]` plus the full body.

| Notification | When | Notes |
|--------------|------|--------|
| **Welcome** | After successful `POST /auth/register` or `POST /auth/register-with-profile` | Not sent for admin bootstrap (`POST /auth/admin/register`), `POST /auth/admin/create-user`, or bulk import. |
| **Order status** | **Open**, **filled**, or **canceled** (`cancelled` in API) for the user’s order | One email after order **create** (reflects state after matching — e.g. filled immediately). **Cancel** and admin/testing **set status** paths also notify. When a resting **maker** is fully filled during match, that user gets a **filled** email from matching (the **taker** is covered by create’s end-state mail — no duplicate). |
| **Deposit (fiat / crypto)** | After successful deposit persist + credit | **`POST /deposits/fiat`**, **`POST /deposits/crypto`**, and **training** wallet credits that create `deposits_fiat` / `deposits_crypto` rows ([`WalletsService.credit`](../backend/src/wallets/wallets.service.ts) with no `refType`). |

**Failure behavior:** Password reset still propagates SMTP errors to the client when mail is configured. Welcome, order, and deposit sends **log errors** and do not fail the main API operation.

### Manual checklist

1. Configure `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` (see [forgot password prerequisites](#auth-forgot-password-8-digit-email-code)).
2. **Register** a new user → Mailpit (or log) shows **Welcome to CryptoSandboxQA**.
3. **Deposit** fiat or crypto (UI or API) → **Deposit received** message with id, currency/asset, amount.
4. **Place** an order → **Order opened** (or **filled** if matched fully at once); **cancel** an open order → **Order canceled**; optionally exercise admin **set order status** → matching subject/body for open/filled/canceled.

### Automation

- Reuse Mailpit’s [REST API](https://mailpit.axllent.org/docs/api-v1/) to assert subjects or bodies after API calls (register, orders, deposits).
- OpenAPI: register/deposit/order routes in [`docs/openapi.json`](./openapi.json).

---

## Admin: bulk user import & export

- **Page:** [`/admin/import-users`](../frontend/app/admin/import-users/page.tsx) — CSV/JSON upload uses **`POST /auth/admin/bulk-import-users`** (multipart `file`). Export card calls **`GET /users/bulk/export`** with presets (first 100, last 100, date range) and format JSON/CSV.
- **`data-testid`:** `admin-bulk-export-panel`, `admin-bulk-export-format`, `admin-bulk-export-first100`, `admin-bulk-export-last100`, `admin-bulk-export-from`, `admin-bulk-export-to`, `admin-bulk-export-daterange`, `admin-bulk-export-error`, `admin-import-skipped-section`.

## Iframe automation practice

The app serves a **same-origin** training form inside an iframe so you can practice frame-scoped selectors without third-party widgets or cross-origin blocks.

- **Page:** [http://localhost:3000/qa/iframe-practice](http://localhost:3000/qa/iframe-practice)
- **Embedded document:** `/qa/iframe-form.html` (static file under [`frontend/public/qa/`](../frontend/public/qa/))

**Playwright sketch** (run in your own test project; the repo does not ship Playwright):

```ts
const frame = page.frameLocator('[data-testid="practice-iframe"]');
await frame.getByTestId('iframe-email').fill('qa@example.com');
await frame.getByTestId('iframe-amount').fill('100');
await frame.getByTestId('iframe-terms').check();
await frame.getByTestId('iframe-submit').click();
await expect(frame.getByTestId('iframe-success')).toBeVisible();
```

**Selenium / Cypress:** switch to the frame (or use frame-scoped queries), then locate by the same `data-testid` or by label (`Email`, `Amount (USD)`, etc.).

---

## Portfolio Analytics: drag-and-drop, shuffle, add/remove blocks (dashboard)

The **Portfolio Analytics** section on [`/dashboard`](../frontend/app/dashboard/page.tsx) (see [`DashboardCharts`](../frontend/components/DashboardCharts.tsx)) exposes six chart/progress blocks in a **sortable grid**:

- **Drag:** Drag **anywhere on the card** (grip, title, padding, or chart area); a **~6px** pointer move starts the drag so simple clicks/tooltips on charts still behave.
- **Shuffle:** Button **Shuffle blocks** (`data-testid="shuffle-analytics-blocks"`) randomizes **visible** block order (disabled when fewer than two visible blocks; retries briefly if the permutation matches the previous order).
- **Customize / remove:** **Customize layout** (`data-testid="customize-analytics-layout"`) toggles per-card **remove** controls (`data-testid="remove-analytics-block-<id>"`, e.g. `remove-analytics-block-balance-pie`). Removing the **last** visible block asks for confirmation.
- **Add blocks:** **Add block** (`data-testid="add-analytics-block-menu"`) opens a menu of hidden blocks; each row is `data-testid="add-analytics-block-<id>"`. When every block is visible, the menu control is **disabled** (tooltip: all blocks visible). Empty grid: **`data-testid="analytics-blocks-empty"`** with **Add a block** (`data-testid="analytics-empty-add-block"`).
- **Undo:** After removing a block, an undo bar appears: **`data-testid="analytics-undo-remove"`** with **`data-testid="analytics-undo-remove-button"`** (auto-dismiss ~5s).
- **Persistence:** **Visible order** is saved under `portfolio-analytics-block-order`; **hidden ids** under `portfolio-analytics-block-hidden` (both **`sessionStorage`**, per tab). Legacy tabs that only have a full-length order array are **migrated** (all blocks visible, same order).
- **Keyboard:** Focus a chart card and use **arrow keys** (@dnd-kit keyboard sensor) to move blocks where supported.
- **UI / theme (visual checks):** Toolbar actions (**Customize layout**, **Add block**, **Shuffle blocks**) and the add-block **dropdown rows** use **neutral slate** borders and fills (same family as selects elsewhere), not emerald fills. **Remove** controls (`remove-analytics-block-*`) are **slate-bordered** on the card when Customize is on; **hover / keyboard focus** use **red** accent for the destructive action. Root **`button`** defaults come from [`globals.css`](../frontend/app/globals.css) (`var(--input-bg)` / `var(--text)`), so unstyled buttons are theme-neutral, not hardcoded green.

Chart containers keep their existing **`aria-label`** and **`data-testid`** values (e.g. `chart-balance-pie`, `chart-area-portfolio`).

---

## Backend: delay before DB writes (simulated processing)

Orders and deposits **do not hit PostgreSQL immediately** after validation. The API waits a short, configurable period to mimic real-world payment/settlement or sync latency before the first persist.

- **Applies to:** `POST /orders` (order creation), `POST /deposits/fiat`, `POST /deposits/crypto` — see [`simulatedPersistDelay`](../backend/src/common/simulated-persist-delay.ts) and call sites in `OrdersService` / `DepositsService`.
- **Default:** **1200 ms** if `SIMULATED_PERSIST_DELAY_MS` is unset.
- **Disable:** set `SIMULATED_PERSIST_DELAY_MS=0` in the backend environment.
- **Tune:** set `SIMULATED_PERSIST_DELAY_MS` to any positive milliseconds (capped at 60s in code) for slower/faster “processing” in demos or stability tests.

The frontend may also keep submit loading UI visible for a minimum duration; together these delays affect **how long** automations should wait after click before asserting success (see [`ARCHITECTURE.md`](../ARCHITECTURE.md) and `.env.example`).

---

## Markets: modal QA surfaces (`MarketsCryptoTable`)

On **`/markets/prices`**, **`/markets/rankings/spot`**, and **`/markets/trading-data/overview`**, the shared [`MarketsCryptoTable`](../frontend/components/MarketsCryptoTable.tsx) exposes several dialogs for manual and automated checks (backdrop, scroll lock, focus trap, stacked dialogs, routing).

| Scenario | How to open | `data-testid` (panel / key controls) |
|----------|-------------|--------------------------------------|
| Short info modal | **About this data** | `markets-about-modal`, `markets-about-dismiss` |
| Long scroll inside modal | **Data methodology (long scroll)** | `markets-methodology-modal`, `markets-methodology-dismiss` |
| `alertdialog`, no backdrop close | **Reset filters…** → confirm | `markets-reset-confirm-modal`, `markets-reset-cancel`, `markets-reset-confirm` |
| Row detail + async reload | Click a row (or focus row + Enter/Space) | `markets-detail-modal`, `markets-detail-reload`, `markets-detail-nested-open`, `markets-detail-error`, `markets-detail-loading` |
| Stacked second dialog | In detail modal: **Open nested QA dialog** | `markets-nested-modal`, `markets-nested-dismiss` |
| Table rows / filters | — | `markets-row-<SYMBOL>`, `markets-search-input`, `markets-limit-select` |

**Deep link:** With default props, opening a row sets **`?detail=SYMBOL`** (uppercase) on the current path; closing the detail modal clears it. Useful for shareable URLs and browser Back/forward checks.

**Shared primitives:** [`MarketsModal`](../frontend/components/MarketsModal.tsx) (focus trap, ref-counted body scroll lock via [`useBodyScrollLock`](../frontend/lib/useBodyScrollLock.ts)), [`MarketsCryptoDetailModal`](../frontend/components/MarketsCryptoDetailModal.tsx) (detail + nested stack).
