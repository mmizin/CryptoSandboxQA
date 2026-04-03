# QA testing features

This document is for **QA engineers, testers, and engineers** who want a realistic crypto-exchange surface to practice **manual exploration**, **API checks**, **browser automation**, and **email-backed flows** without production risk.

**Skills you can sharpen here**

| Area | What you practice |
|------|-------------------|
| **Forms & client validation** | Boundary values, max lengths, stable error copy, and **`data-testid`** discipline before and after submit. |
| **Auth & security** | Password reset with **anti-enumeration**, session invalidation, 8-digit codes, and flows that split client vs server errors. |
| **Email-backed testing** | Mailpit (or SMTP), reading codes and subjects, optional **Mailpit HTTP API** for automation. |
| **Rich UI & a11y** | Modals, focus trap, stacked dialogs, URL query params (Markets); keyboard **drag-and-drop** on Portfolio Analytics. |
| **Timing & async** | **Simulated persist delay** before DB writes — designing waits and stable assertions. |
| **Admin & bulk** | Import/export, impersonation-related surfaces; **iframe** same-origin frame switching. |
| **Performance awareness** | Optional Docker stack with **Prometheus / Grafana** (see root [README](../README.md)). |

This document lists **purpose-built surfaces** in CryptoSandboxQA for manual checks and automation practice (selectors, frames, API-backed flows). Add a new section here whenever you introduce another training or testability feature.

### In-repo Playwright (E2E)

The repository ships **Playwright** tests under [`tests/ui-tests/`](../tests/ui-tests/). Configuration loads the repo root `.env` then [`tests/ui-tests/.env`](../tests/ui-tests/.env) (see [`playwright.config.ts`](../tests/ui-tests/playwright.config.ts)); set `PLAYWRIGHT_BASE_URL` or `BASE_URL` for the app origin. Run from `tests/ui-tests/` with `npm install` and `npx playwright test`. Reports use **Allure** (`allure-playwright` in config). Tag vocabulary for contributors (`@smoke`, `@merge-gate`, `@client-validation`, …) lives in [`.cursor/rules/playwright-ui-tests.mdc`](../.cursor/rules/playwright-ui-tests.mdc). Optional **API-shaped TypeScript types** (users, markets/cryptos, orders, balances, payments) are exported from [`tests/ui-tests/src/models/index.ts`](../tests/ui-tests/src/models/index.ts). For setup from the repo root, see [README § Testing & automation](../README.md#testing--automation).

---

## Input field rules and restrictions (client-side)

This section is the **reference for allowed values, lengths, and formats** on inputs that enforce rules in the browser before submit. Use it for **positive** tests (valid input → submit proceeds) and **negative** tests (invalid input → inline error, **no** request).

Implementation lives in:

| Module | Purpose |
|--------|---------|
| [`frontend/lib/authFieldConstraints.ts`](../frontend/lib/authFieldConstraints.ts) | Auth forms: constants (`PASSWORD_MIN_LENGTH`, `EMAIL_MAX_LENGTH`, …), `AuthMessages`, validators |
| [`frontend/lib/searchFieldConstraints.ts`](../frontend/lib/searchFieldConstraints.ts) | Search/filter text: `SEARCH_MAX_LENGTH`, `clampSearchInput` |
| [`frontend/lib/trainingDepositConstraints.ts`](../frontend/lib/trainingDepositConstraints.ts) | Dashboard training deposit amount |

**Backend parity:** Shared limits in [`backend/src/common/validation.constants.ts`](../backend/src/common/validation.constants.ts) (`EMAIL_MAX_LENGTH` **254**, `WALLET_DEPOSIT_AMOUNT_MAX` **1_000_000_000**) match the frontend modules above. DTOs apply `@IsEmail()` + `@MaxLength(254)` on email and `@IsPositive()` + `@Max(WALLET_DEPOSIT_AMOUNT_MAX)` on [`DepositDto`](../backend/src/wallets/dto/deposit.dto.ts) amount. Same email cap on [`RegisterDto`](../backend/src/auth/dto/register.dto.ts), [`LoginDto`](../backend/src/auth/dto/login.dto.ts), [`ForgotPasswordDto`](../backend/src/auth/dto/forgot-password.dto.ts), [`ResetPasswordWithCodeDto`](../backend/src/auth/dto/reset-password-with-code.dto.ts), [`RegisterWithProfileDto`](../backend/src/auth/dto/register-with-profile.dto.ts), [`CreateAdminDto`](../backend/src/auth/dto/create-admin.dto.ts), and admin user DTOs with an `email` field.

### Rules by field (auth)

| Screen | Input / `data-testid` | Type | Restrictions | Typical error messages (`AuthMessages`) |
|--------|------------------------|------|----------------|----------------------------------------|
| **Sign in** `/` | Email `login-email` | Email string | Required after trim; max **254** chars; must match app email regex (see `authFieldConstraints`) | `Email is required`, `Email must be at most 254 characters`, `Enter a valid email address` |
| **Sign in** `/` | Password `login-password` | Password | Required; min **6** chars (no max enforced in UI) | `Password is required`, `Password must be at least 6 characters` |
| **Register** `/register` | Email `register-email` | Email string | Same as sign-in | Same as email row above |
| **Register** `/register` | Display name `register-display-name` | Plain text | Optional; if non-empty, max **100** chars | `Display name must be at most 100 characters` |
| **Register** `/register` | Password `register-password` | Password | Required; min **6** chars | Same as password row above |
| **Forgot password** `/forgot-password` | Email `forgot-password-email` | Email string | Same as sign-in | Same as email row above |
| **Reset password** `/reset-password` | Email `reset-password-email` | Email string | Same as sign-in | Same as email row above |
| **Reset password** `/reset-password` | Code `reset-password-code` | Numeric code | **Exactly 8 digits**; non-digits stripped as you type; `inputMode="numeric"` | `Reset code must be 8 digits` |
| **Reset password** `/reset-password` | New password `reset-password-new` | Password | Min **6** chars | Same as password row above |
| **Reset password** `/reset-password` | Confirm `reset-password-confirm` | Password | Must equal new password | `Passwords do not match` (also short-password errors if applicable) |

**HTML attributes** on the above where relevant: `maxLength` on email (254), `minLength` on password fields (6), `type="email"` for email, `inputMode="numeric"` for reset code.

### Rules by field (search and dashboard)

| Area | Input / `data-testid` | Type | Restrictions | Notes |
|------|------------------------|------|----------------|--------|
| Markets tables | Search `markets-search-input` | Search text | Max **128** chars; trimmed at start; length clamped on `onChange` | [`MarketsCryptoTable`](../frontend/components/MarketsCryptoTable.tsx) |
| Trade coin table | Search (no testid on field) | Search text | Max **128** chars; same clamp | [`TradeCoinTable`](../frontend/components/TradeCoinTable.tsx) |
| Buy / sell crypto | Combobox search | Search text | Max **128** chars; same clamp | [`CryptoSearchSelect`](../frontend/components/CryptoSearchSelect.tsx) |
| Admin impersonate | Search `admin-impersonate-search` | Search text | Max **128** chars; same clamp | [`/admin/impersonate`](../frontend/app/admin/impersonate/page.tsx) |
| Dashboard | Training deposit amount `dashboard-deposit-amount` | Number (`type="number"`) | Must parse to a **positive** number; **≤ 1_000_000_000** (same max on API `POST /wallets/deposit`) | Messages: `Enter a positive amount`, `Amount must be at most …` ([`trainingDepositConstraints`](../frontend/lib/trainingDepositConstraints.ts)) |

### Other forms (dedicated validators, not the same module as auth)

These screens already use **feature-specific** validation modules (ranges, IBAN, card digits, decimals, etc.). See the linked files for full rules:

| Feature | Module | Examples of rules |
|---------|--------|-------------------|
| Buy / Sell | [`buySellValidation.ts`](../frontend/lib/buySellValidation.ts) | Amount min/max USD, IBAN pattern, card number digits, CVV length, expiry MM/YY |
| Trade order entry | [`tradeOrderValidation.ts`](../frontend/lib/tradeOrderValidation.ts) | Amount/price positive, decimal places, balance checks |
| Fiat / crypto deposit | [`depositCashValidation.ts`](../frontend/lib/depositCashValidation.ts), [`depositCryptoValidation.ts`](../frontend/lib/depositCryptoValidation.ts) | Amount ranges, payment-method fields |
| Calculator | [`calculatorValidation.ts`](../frontend/lib/calculatorValidation.ts) | Amount min/max, fiat/crypto selection |
| 2FA modal | [`twoFactorValidation.ts`](../frontend/lib/twoFactorValidation.ts) | 6-digit TOTP-style code |

### Automation (when you add tests)

- Assert on **`data-testid`** and the exact **error strings** from `AuthMessages` / `TrainingDepositMessages` in the table above. If you change copy in [`authFieldConstraints.ts`](../frontend/lib/authFieldConstraints.ts), update any tests in the same change.

### API vs client

- **Client validation** blocks submit and shows inline errors (no network call for that submit).
- **Invalid data that passes client checks** (e.g. wrong login password) still returns **API errors** — see [`tests/ui-tests/tests/e2e/login.spec.ts`](../tests/ui-tests/tests/e2e/login.spec.ts) for invalid-credentials server responses.

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

**Playwright sketch** (same API as in [`tests/ui-tests/`](../tests/ui-tests/); add a spec under that package or run ad hoc):

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
