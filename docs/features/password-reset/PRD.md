# Password Reset (8-Digit Code)

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Medium |
| Owner | |
| Last updated | 2026-07-27 |
| Slug | PRD-PasswordReset |

## Overview

Password Reset lets a user who cannot sign in recover access by requesting an
8-digit, email-delivered code and using it to set a new password, without an
administrator or existing session involved. It is the account's second
access-recovery path, alongside authenticated in-app credential changes
(not covered here — not found in the current implementation, see Non Goals).
On success it triggers `PRD-SessionManagement`'s FR-004 (invalidate all
sessions), forcing re-authentication everywhere the old password was
trusted.

## Current Behavior

- Two endpoints: `POST /auth/forgot-password` (`AuthController.forgotPassword`,
  `auth.controller.ts:72-83`, calling `AuthService.requestPasswordReset()`)
  and `POST /auth/reset-password` (`auth.controller.ts:85-96`, calling
  `AuthService.resetPasswordWithCode()`). Neither route carries an
  authentication guard — both are reachable by an unauthenticated caller, by
  design (this is the recovery path for someone who cannot sign in).
- `requestPasswordReset(email)` (`auth.service.ts:109-140`) normalizes the
  email (`toLowerCase().trim()`), looks up the user, and **always returns the
  same generic message** — "If an account exists for this email, a reset code
  has been sent. Check your inbox." — regardless of whether the account
  exists. If the user is not found, the function returns immediately; no
  further work (no code generation, no email) happens. This is the
  anti-enumeration behavior the inventory names.
- When the user exists: any prior *unused* reset row for that user is deleted
  (`userPasswordReset.deleteMany({ where: { userId, usedAt: null } })`) —
  this is the "new reset replaces previous unused reset" behavior; a
  previously *used* row is untouched (kept for history, not queried by
  anything found in this feature). A new 8-digit numeric code is generated
  (`randomInt(0, 100_000_000)`, zero-padded to 8 digits), hashed, and stored
  with `expiresAt` set to 30 minutes from creation
  (`PASSWORD_RESET_CODE_TTL_MIN = 30`, `auth.service.ts:56,128`). The code is
  sent via `MailService.sendPasswordResetCode()` — the concrete delivery
  mechanism (SMTP vs. backend-log fallback) is `PRD-SMTPConfiguration`'s to
  describe, not derived here; see Non Goals, Q-001.
- The code is hashed via `hashResetCode()` (`auth.service.ts:183-189`):
  `HMAC-SHA256(pepper, code)`. The pepper is resolved in this order:
  `PASSWORD_RESET_CODE_PEPPER` env var → `JWT_SECRET` env var → the literal
  string `'dev-secret-change-in-production'`. The plaintext code is never
  persisted — only this hash, in `user_password_resets.codeHash`.
- `resetPasswordWithCode(email, code, newPassword)`
  (`auth.service.ts:142-181`) looks up the user by normalized email; if not
  found, throws `BadRequestException('Invalid or expired reset code')` — the
  same generic error is used whether the email doesn't exist, the code is
  wrong, or the code is expired/already used, which is the same
  anti-enumeration shape as the request step, applied at verification time
  too (not explicitly named as such by the inventory, but observed directly
  in code). It then looks for a `user_password_resets` row matching
  `userId`, the HMAC of the presented code, `usedAt: null`, and
  `expiresAt > now`; any mismatch on any of those four conditions produces
  the identical error, so a caller cannot distinguish "wrong code" from
  "expired code" from "already used" from "no such account."
- **`resetPasswordWithCode()` never consults 2FA enrollment**
  (`auth.service.ts:142-181` has no call to `twoFactorService`; 2FA
  enrollment/verification lives only in `login()`'s `is2FaEnabled()` check,
  `:88`, and `verify2Fa()`'s `verifyCode()`, `:202`). A completed password
  reset changes only `passwordHash` — it does not disable, reset, or
  bypass an account's `UserTwoFactor` enrollment. See G-001, Q-009.
- On a match: in a single Prisma transaction, the user's `passwordHash` is
  updated (bcrypt, cost 10) and the reset row is marked used
  (`usedAt: new Date()`) — this is the single-use enforcement. **Session
  invalidation happens outside and after that transaction**
  (`this.sessionsService.deleteAllUserSessions(user.id)`,
  `auth.service.ts:179`, called after the transaction resolves) — this is
  the same ordering `PRD-SessionManagement` FC-006 already documents for
  this exact call site; not restated as a new finding here, only located as
  this feature's trigger for it.
- No rate limiting or throttling was found on either endpoint — no
  `@Throttle` decorator, guard, or `ThrottlerModule` registration in
  `auth.controller.ts` or `app.module.ts`. This mirrors `PRD-Login`'s Q-002,
  which records the same absence for the login endpoint; here the exposure
  is arguably larger, since `forgot-password` triggers an email send per
  call and `reset-password` is a guessing target (email × 8-digit code)
  with no attempt limit found. See Q-002.
- `frontend/lib/authFieldConstraints.ts` defines client-side validation
  aligned with the backend DTOs: `EMAIL_MAX_LENGTH = 254`,
  `PASSWORD_MIN_LENGTH = 6`, `RESET_CODE_LENGTH = 8`, matching
  `ResetPasswordWithCodeDto`/`ForgotPasswordDto` exactly.
- `frontend/app/reset-password/page.tsx` (read to close Q-006) confirms:
  a required **confirm-password field**, checked client-side only
  (`newPassword !== confirm`, using `AuthMessages.passwordsMismatch`) —
  the backend accepts no confirmation value and has no knowledge of it;
  the form requires the user to **re-enter their email** (no prefill from
  the request step, no code/email carried between the two pages); and on
  success, a 2-second delay before redirecting to `/` (`setTimeout(...,
  2000)`, `router.push('/')`). `frontend/app/forgot-password/page.tsx`
  (read to close A-001) confirms a single-step UI: one email input
  validated with `validateEmail`/`EMAIL_MAX_LENGTH`, a single
  `authApi.forgotPassword(email.trim())` call, and the server's generic
  `res.message` rendered verbatim — no resend cooldown, no client-side
  attempt limiting, no lockout beyond the in-flight `loading` flag. This
  also corroborates FC-003 harm (3): nothing client-side slows repeat
  requests either.

## Problem Statement

A user who has forgotten their password and has no active session cannot
regain access to their account through any authenticated flow. Without a
self-service recovery path, every forgotten password becomes a support or
administrative burden, and the account remains inaccessible to its owner in
the meantime.

## Goals

- G-001: A user who no longer knows their password, **and does not have
  2FA enabled**, can regain access to their account using only their email
  address and a code delivered to it, without administrator involvement.
  **Does not extend to 2FA-enabled accounts:** `resetPasswordWithCode()`
  changes only the password hash and never touches `UserTwoFactor`
  enrollment (Current Behavior) — a 2FA-enabled user who completes this
  flow still cannot sign in without their second factor (TOTP or a backup
  code). This is a real security property (mailbox access alone does not
  disable 2FA), not asserted here as a defect — but it means G-001 does not
  hold universally, and whether a 2FA-enabled user who has also lost their
  device has any recovery path at all (backup codes, admin action, or
  none) is unaddressed by this feature. See Q-009.
- G-002: The reset process's response **content and status code** do not
  reveal whether a given email address has an account — an observer
  submitting arbitrary emails or codes cannot distinguish "no such account"
  from "wrong code" from "code expired" from "code already used" by
  reading the response body/status alone. **Not fully met today, on this
  content/status scope specifically** — see FC-001: when `SMTP_HOST` is
  configured but delivery fails, the known-email path can surface a
  different response (an unhandled error) than the unknown-email path,
  until ADR-0009 lands. **Explicitly out of this Goal's scope, tracked
  separately, not counted as a violation of it:** a timing side-channel
  (FC-004) — response-time difference is not content or status, and
  ADR-0009 itself records this channel as not fully closed by its Decision.
  This scoping mirrors how `PRD-Login` G-002 scopes itself, and is
  deliberately not a broader promise: `PRD-Login` Q-005 records that `POST
  /auth/register` discloses account existence outright (`ADR-0008`), so
  whether a full anti-enumeration guarantee (content, status, *and* timing)
  is this system's posture at all is `PRD-Login` Q-005's question — this
  Goal does not attempt to answer it, and no question here reopens it.
- G-003: A successful password reset invalidates every previously issued
  session for that account (`PRD-SessionManagement` FR-004), so continued
  access requires the new password everywhere.

## Non Goals

- Concrete email delivery mechanics (SMTP vs. Mailpit vs. backend-log
  fallback) — covered by `PRD-SMTPConfiguration` (not yet produced); this
  PRD treats `MailService.sendPasswordResetCode()` as an external call. See
  Q-001.
- The reset email's body content — owned by backlog #44 (`PRD-044`,
  "Password Reset Code Email," not yet produced), not this PRD. Noted here
  only because `mail.service.ts:54-58` hardcodes "It expires in 30
  minutes." independent of `PASSWORD_RESET_CODE_TTL_MIN`; see Q-010.
- Maximum password length / bcrypt truncation on the new password accepted
  by `POST /auth/reset-password` — `ResetPasswordWithCodeDto.newPassword`
  has `@MinLength(6)` and no `@MaxLength`, and is hashed with bcrypt (72-byte
  truncation). The same open question exists on `PRD-Login` Q-003 and
  `PRD-Registration` Q-007; not re-opened here, owned by whichever of those
  resolves it first.
- Session revocation mechanics themselves (how a session is deleted, what
  `SessionGuard` does afterward) — covered by `PRD-SessionManagement`
  FR-004/FC-005/FC-006; this PRD only identifies password reset as one of
  FR-004's triggers.
- An authenticated "change password while logged in" flow — no such
  endpoint was found in `auth.controller.ts`; not in scope here since it is
  a different feature if/when it exists.
- Rate limiting design itself (what limit, what window, what response) —
  recorded as an open gap (Q-002) shared with `PRD-Login`'s Q-002, not
  designed here; a product/architecture decision, not assumed.
- Account lockout after repeated failed reset attempts — no such mechanism
  was found; not designed here, see Q-002.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account Holder | Human | A user who has forgotten their password and requests/redeems a reset code, without an existing session |
| Auth Service | System | `AuthService.requestPasswordReset()` / `resetPasswordWithCode()` — generates, hashes, validates, and consumes reset codes; triggers session invalidation on success |
| Mail Service | System | `MailService.sendPasswordResetCode()` — delivers the code; delivery mechanics owned by `PRD-SMTPConfiguration` |

## User Stories

- US-001: As an account holder who forgot their password, I want to request
  a reset code by entering my email, so that I can regain access without
  contacting support.
- US-002: As an account holder, I want to use the code I received to set a
  new password, so that I can sign in again.
- US-003: As an account holder, I want a successful reset to sign out any
  other device using my old credentials, so that a password I no longer
  trust stops granting access everywhere.
- US-004: As an attacker probing arbitrary email addresses, I should not be
  able to tell which ones have accounts on this system from either
  endpoint's response.

## Functional Requirements

### FR-001: Request a password reset code

- **Description:** The system must, given an email address, generate and
  deliver an 8-digit numeric code to that address if an account exists for
  it, and in all cases return the same response regardless of whether the
  account exists.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an email with no matching account, when a reset is requested, then
    the response is the generic confirmation message and no code is
    generated or sent.
  - Given an email with a matching account, when a reset is requested, then
    an 8-digit numeric code is generated, its hash is stored with a 30-minute
    expiry, the code is sent to that email, and the response is the same
    generic confirmation message as the no-account case.
  - Given an account with an existing unused reset code, when a new reset is
    requested for that account, then the prior code no longer redeems
    successfully — implemented today as delete-before-create, and, if
    ADR-0013 (Proposed) is Accepted, as an overwrite of the same row via
    `upsert()`; either way the AC is about the observable outcome (prior
    code stops working), not the specific mechanism (see BR-002).
- **Governed by:** BR-001, BR-002
- **Related:** US-001, US-004, G-001, G-002

### FR-002: Redeem a reset code to set a new password

- **Description:** The system must accept an email, code, and new password,
  and — only if the code matches an unexpired, unused reset record for that
  email — update the account's password and mark the code consumed, in a
  single atomic operation covering both.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid, unexpired, unused code matching the submitted email, when
    redemption is attempted with a new password, then the account's password
    is updated and the code record is marked used, atomically.
  - Given a code that does not match, is expired, is already used, or an
    email with no account — and the submitted code and password already
    satisfy DTO format validation (8 digits, password ≥6 characters; see
    the Note following FC-004) — when redemption is attempted, then the request is rejected
    with the same generic error message across all four cases, and no
    password is changed.
  - Given a used code, when it is presented again, then redemption is
    rejected (single-use enforcement).
- **Governed by:** BR-001, BR-002
- **Related:** US-002, US-004, G-001, G-002
- **Failure analysis:** See FC-002 (session invalidation ordering — this is
  `PRD-SessionManagement` FC-006's call site) and FC-004 (residual timing
  channel, system-level, not specific to this FR).

## Failure Conditions

### FC-001: When SMTP is configured, a delivery failure reaches the caller as a different response than the no-account case

- **Applies to:** FR-001
- **Condition:** `sendPasswordResetCode()` **is awaited before the response
  is built** (`auth.service.ts:138-139`), not after, and — unlike
  `sendWelcomeEmail`, `sendOrderStatusEmail`, `sendDepositFiatEmail`, and
  `sendDepositCryptoEmail`, which each wrap their body in try/catch and
  log-and-swallow — `sendPasswordResetCode()` has no try/catch. **This only
  produces a divergent response when `SMTP_HOST` is configured**
  (`mail.service.ts:30-33`): when it is unset — this repo's documented
  default (`CLAUDE.md`) — `deliver()` logs and returns without ever
  attempting a network send, so it cannot fail. Only when a real transport
  is configured *and* that transport fails does a hard delivery failure
  propagate out of `requestPasswordReset()` as an unhandled error, and only
  on the known-email path, since the unknown-email path returns before any
  mail call is made. No unauthenticated caller can induce this by request
  content alone — it requires the operator's mail transport to be down.
- **Verified as not yet fixed:** ADR-0009
  (`docs/architecture/adr/0009-notification-delivery-boundary-on-request-path.md`,
  Status: Accepted) decides this — move the catch-and-log guarantee into
  `MailService.deliver()` itself, and stop awaiting the mail call
  specifically on this code path. As of this PRD, none of it is
  implemented: `deliver()`'s `createTransport` call (`mail.service.ts:38-43`)
  has no connection/greeting/socket timeout, `deliver()` still has no
  try/catch, the other four `MailService` methods still wrap individually
  (`:63,90,123,141`), and `auth.service.ts:138` still `await`s the send
  directly. This is stated as verified fact, not left to Q-003 — see Q-003
  for what remains genuinely open (when it lands).
- **Expected behavior:** Per ADR-0009's Decision, once implemented: delivery
  failures are caught and logged inside `deliver()`, never surfaced to the
  caller, and `requestPasswordReset()` does not await the send — closing
  this content/status divergence. ADR-0009 itself notes this does not
  close the separate *timing* channel (the known-email path still does
  more work before responding) — that is out of this condition's scope,
  tracked at G-002/FC-004.

### FC-002: Session invalidation can fail after the password change has already committed

- **Applies to:** FR-002
- **Condition:** `deleteAllUserSessions()` is called after the password-hash
  update transaction has already committed (`auth.service.ts:179`,
  observed directly at this feature's call site). If it fails, the password
  has changed but old sessions remain valid.
- **Expected behavior:** Not currently defined by the product — same gap
  `PRD-SessionManagement` records as FC-006; recorded here only as this
  feature's own instance of triggering it, not as a new finding.

### FC-003: No limit on request or redemption attempts — three distinct harms, not one

- **Applies to:** (system-level)
- **Condition:** No rate limiting, throttling, or lockout was found on
  either endpoint (`auth.controller.ts`, `app.module.ts` — no `@Throttle`,
  no `ThrottlerModule`). This produces three separate exposures that
  should not be collapsed into one severity judgment, since a mitigation
  for one does not necessarily address the others:
  1. **Code brute-force** (`reset-password`): guessing an 8-digit code
     within one 30-minute window requires ~28,000 req/s for even odds
     (~55,000 req/s to exhaust the full 10^8 keyspace with near-certainty)
     — impractical on this single-node sandbox. But nothing confines an
     attacker to one window: each freshly issued code is an independent
     draw, and at a far more ordinary 100 req/s sustained, an attacker
     reaches ~8.6M attempts/day — roughly 8% cumulative success per day,
     compounding to even odds within about 8 days. The per-window number
     alone understates the risk; only the unbounded-horizon framing is
     accurate. This framing depends on the attacker being able to keep a
     live unused code to guess against across many windows, which in
     practice means driving harm (3) below (repeated `forgot-password`
     calls) to keep reissuing one — the two harms are not independent.
  2. **Denial-of-recovery race with BR-002**: because a new
     `forgot-password` request always invalidates the account's current
     unused code (BR-002), anyone who knows a victim's email can
     repeatedly call `forgot-password` to invalidate whichever code the
     victim is currently trying to redeem. Each such call also mails the
     victim a fresh, valid code (`auth.service.ts:130-138`), so this is a
     race the attacker must keep winning to deny recovery, not an outright
     lockout — the victim always holds *some* usable code, just possibly
     not the one they were about to submit.
  3. **Mail amplification**: independent of (2), repeated `forgot-password`
     calls against a known address are also an unauthenticated vector to
     flood that address's inbox (and the mail service) with reset emails,
     regardless of whether the account holder is actively trying to reset
     anything.
  ADR-0009's Decision (once implemented) reduces per-request attacker cost
  for (1) and (3) by removing the synchronous mail wait from the request
  path — an interaction between that accepted fix and this condition worth
  noting for whoever designs rate limiting.
- **Expected behavior:** ADR-0013 (Accepted) decides this: an
  application-wide `ThrottlerModule` default (not scoped to just these two
  endpoints — see Architecture Impact) with a tightened override on both,
  plus an email-keyed limiter on `forgot-password` **only** (not
  `reset-password` — that would block redemption of a code the victim
  already holds, a strictly worse failure mode than the issuance-side
  lockout accepted on `forgot-password` instead, and that lockout window is
  hard-constrained to stay shorter than the 30-minute code TTL so it cannot
  degrade into a full denial-of-recovery lockout). This substantially
  raises the cost of (1) and (3); it **bounds, not closes,** (2) — the
  email-keyed limiter is itself attacker-mintable against a known victim
  email, trading an indefinite race for a fixed-size
  denial-of-*new-code-issuance* window (ADR-0013 Decision). See Q-002 for
  what remains open (exact limits, sized against both the denial-of-recovery
  floor and the TTL constraint, and whether `login` adopts the same
  mechanism).

### FC-004: A residual timing channel survives even after ADR-0009 lands

- **Applies to:** (system-level — the anti-enumeration channel spans both
  FR-001 and FR-002's endpoints)
- **Condition:** Independently of FC-001's content/status divergence,
  the known-email path on `requestPasswordReset()` does strictly more work
  before responding (a `deleteMany`, an HMAC, a `create`, and — pre-ADR-0009
  — a mail round trip) than the unknown-email path, which returns after a
  single lookup. ADR-0009's Decision removes the mail round trip from this
  timing difference but explicitly does not claim to close the remaining
  DB-only gap — recorded in the ADR itself, not asserted new here.
- **Expected behavior:** Not currently defined by the product, and not
  assigned a fix by ADR-0009 either. Whether this residual is significant
  enough to warrant closing (e.g. constant-time padding) is unaddressed —
  see Q-003, G-002.

**Note:** `ResetPasswordWithCodeDto`'s format validation (8-digit code,
6-character minimum password, rejected before `resetPasswordWithCode()` is
reached) is standard DTO behavior, not a failure condition — it is recorded
as a correction to FR-002's acceptance criterion (see FR-002) rather than
as its own FC.

## Non Functional Requirements

### NFR-001: Reset code expiry

- **Category:** Security
- **Requirement:** A generated reset code must not be redeemable more than
  30 minutes after creation.
- **Measurement:** Observable black-box test: redeem a valid code at
  T+29 minutes (accepted) and the same code at T+31 minutes (rejected with
  the generic error). Implementation matching this today:
  `resetPasswordWithCode()` only matches rows where `expiresAt > now()`
  (`auth.service.ts:159`); `expiresAt` is set to creation time +
  `PASSWORD_RESET_CODE_TTL_MIN` (30) at generation (`auth.service.ts:128`,
  constant at `:56`).
- **Priority:** Must

Whether 30 minutes is a deliberately chosen value or an inherited default
is unaddressed — see Q-010. Beyond expiry, no other measurable NFR
(delivery latency, redemption endpoint availability, brute-force
resistance target) was found or stated anywhere in the system — see Open
Questions.

## Business Rules

### BR-001: A password reset code is single-use

- **Rule:** Once a reset code has been successfully redeemed, it can never
  be redeemed again, regardless of whether it is still within its expiry
  window.
- **Rationale:** A code that remains valid after use would let anyone who
  intercepted it (e.g. from an email inbox or logs) reset the password a
  second time within the same window; single-use closes that window to
  exactly one redemption.

### BR-002: A new reset request invalidates any prior unused code for the same account

- **Rule:** Requesting a new reset code for an account deletes any
  previously issued, still-unused code for that account before creating the
  new one. Only one *unused* reset code can exist per account at a time.
  **This is enforced only by application-level call sequencing — the
  `deleteMany` and `create` (`auth.service.ts:121-136`) are two separate
  `await`s, not wrapped in a transaction, and no unique constraint on
  `user_password_resets` backs the invariant (`schema.prisma` has only
  `@@index([userId])`).** Two concurrent `forgot-password` requests for the
  same account can interleave and leave two live unused codes; the "only
  one" guarantee does not hold under concurrency. **ADR-0013 (Proposed,
  Revision 2) decides this**: `@@unique([userId])` on `user_password_resets`
  plus replacing `deleteMany`+`create` with a single `upsert()` — not a
  transaction wrapper (doesn't close the race under Read Committed
  isolation, per `ADR-0008`'s identical reasoning) and not a raw-SQL
  partial unique index (inexpressible in Prisma's schema, so it doesn't
  survive this repo's `db push`-based schema workflow). The
  fully-declarative constraint means every `create()`-style conflict is
  resolved atomically by the upsert itself, with no losing branch or
  `P2002` to translate. **Side effect:** used rows are overwritten on the
  next request rather than retained — see Q-005, which this decision
  answers directly. See Q-002.
- **Rationale:** Without this, an attacker who obtained an earlier code
  would still be able to redeem it after the legitimate user requested (and
  believes they are using) a fresh one; invalidating the prior code closes
  that race. **This same mechanism, combined with FC-003's absence of rate
  limiting, creates a race in the opposite direction:** anyone who knows
  the account's email can repeatedly re-request a reset to invalidate
  whichever code the legitimate holder is currently trying to redeem — a
  race the attacker must keep winning to delay recovery (each such request
  also mails the holder a fresh, valid code, so this is not an outright
  lockout — see FC-003). Whether the invariant should remain "exactly one
  unused code" or move to some bounded-N model is part of Q-002.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| Reset code record (`user_password_resets`: `userId`, `codeHash`, `expiresAt`, `usedAt`, `createdAt`) | this feature | **As implemented pre-ADR-0013:** Indefinite — no cleanup of expired or used rows was found (used rows are kept, not queried by anything in this feature; expired-unused rows are only removed if superseded by a new request, per BR-002). One cleanup path exists today: `schema.prisma` sets `onDelete: Cascade` on the `userId` relation, so a row is removed if its user is deleted — not a retention policy for the row itself. **Per ADR-0013 (Accepted)**, this changes on implementation: `@@unique([userId])` limits each user to one row total, and every new request overwrites the prior row via `upsert()` — used rows will no longer be retained past the next request. This foreclosed (did not answer) Q-005's retention question — see Q-005, BR-002. | Internal/regulated-adjacent for the stored record (`codeHash` is a one-way HMAC of an 8-digit code, not the code itself; the record does not identify the account by email directly, only by `userId`). **The plaintext code has a second exposure this table doesn't capture at rest:** `MailService.deliver()` logs the full message body, code included, whenever `SMTP_HOST` is unset (`mail.service.ts:31`) — this repo's documented default per `CLAUDE.md` ("If `SMTP_HOST` unset, `MailService` logs message body to backend terminal") — meaning the plaintext code is written to application logs on every reset request in that configuration. Tracked as an existing architecture finding, not newly discovered here — see Q-007. |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Session Management (`PRD-SessionManagement`, Status: Review) | outbound | Calls `deleteAllUserSessions()` (FR-004 there) on successful reset | blocking (see FC-002 / `PRD-SessionManagement` FC-006) |
| SMTP Configuration (`PRD-SMTPConfiguration`, not yet documented) | outbound | Delivers the reset code via `MailService.sendPasswordResetCode()` | blocking for the user to receive the code; the API response currently waits on this call too (corrected — see FC-001), pending ADR-0009 |
| Login (`PRD-Login`, Status: Review) | related, not blocking | Shares the unaddressed rate-limiting gap (Q-002/`PRD-Login` Q-002) and the anti-enumeration framing (G-002/`PRD-Login` Q-005, ADR-0008) but no direct call dependency was found | — |

Both `PRD-SessionManagement` and `PRD-Login` are currently `Status: Review`,
not yet finalized — this PRD's cross-references assume their cited IDs
(FR-004, FC-005, FC-006, Q-002, Q-005) remain stable, which is not
guaranteed until those PRDs close.

## Constraints

- C-001: **As found:** the HMAC pepper used to hash reset codes falls back
  through `PASSWORD_RESET_CODE_PEPPER` → `JWT_SECRET` → the hardcoded
  literal `'dev-secret-change-in-production'` if neither env var is set
  (`auth.service.ts:184-187`, verified directly). **This is documented,
  intended behavior, not an accidental gap** — `README.md:255`,
  `ARCHITECTURE.md:125`, and `FEATURES_INVENTORY.md:112` all describe the
  `JWT_SECRET` fallback as designed. The live case is the
  configured-but-partial one: `JWT_SECRET` is set (to a value distinct from
  the code's hardcoded fallback) on every documented setup path
  (`npm run setup`, `npm run stack:up`), so an operator following this
  repo's own instructions gets a pepper and a JWT signing secret that are
  the *same value* by design, not merely on an unconfigured edge case — a
  leak of one compromises both, despite them protecting different assets.
  The fully-unconfigured case (both env vars unset, requiring a run path
  outside every documented one) additionally collapses both fallback
  chains to the identical hardcoded literal — a real but non-default
  condition. **ADR-0012 (Accepted) decouples them
  anyway**: the `JWT_SECRET` tier is dropped in favor of a pepper-specific
  fallback literal, closing the live coupling for the documented default
  configuration while preserving the zero-config setup flow. Adopting this
  requires updating the three documents above in the same change (ADR-0012
  Consequences). See Q-004.
- C-002: Both endpoints are intentionally unauthenticated (no guard) since
  the feature exists precisely for users without a session — this is not a
  gap, it is definitional to the feature's purpose (G-001).

## Assumptions

Both prior assumptions (A-001, A-002) have been verified and closed:
`forgot-password/page.tsx` was read and matches A-001 exactly (now in
Current Behavior); `user_password_resets` is referenced only at
`auth.service.ts:121, 130, 154, 173` repo-wide, confirming A-002, with the
one cleanup path (cascade delete on user removal) now noted in Data
Requirements. No open assumptions remain.

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | `PRD-SMTPConfiguration` does not yet exist. Should Password Reset's PRD be finalized ahead of it, given FR-001's delivery step and FC-001 both depend on that feature's behavior? | Non Goals, FR-001, FC-001, Integration Requirements | | open |
| Q-002 | **Partially resolved by ADR-0013 (Accepted):** the ADR proposes a global `ThrottlerModule` default (application-wide, not auth-module-scoped — see Architecture Impact) plus an email-keyed limiter on `forgot-password` only (deliberately not `reset-password`, to avoid blocking redemption of a code the victim already holds) — this bounds harm 2 to a fixed denial-of-issuance window rather than closing it, hard-constrained to be shorter than the 30-minute code TTL so it cannot degrade into a full denial-of-recovery lockout. BR-002's non-atomicity gap is resolved via `@@unique([userId])` + `upsert()` with a fail-safe `P2002` catch and a conditional redemption update (an earlier draft's unconditional upsert would have let a superseded code redeem successfully during a race — corrected in Revision 3). This forecloses (not answers) Q-005's retention question — see Q-005. Remaining open: exact limit values (a product decision balancing abuse-cost against the denial-of-issuance floor and the TTL constraint, not pure UX tuning), backoff behavior, and 429 response shape are left to implementation; the exclusion audit ADR-0013 names but doesn't complete (Prometheus `/metrics`, frontend polling, the Socket.IO ticker transport, order/deposit-flow test loops) is unfinished work this PRD inherits; whether `PRD-Login`'s identical gap (`PRD-Login` Q-002) adopts this same mechanism is that PRD's decision to close; `POST /auth/2fa/verify` and `POST /auth/register` receive ADR-0013's global default but not a tightened, route-specific limit — that remains each sibling PRD's own decision. | FC-003, BR-002, Q-005, Architecture Impact | | open |
| Q-003 | ADR-0009 (Status: Accepted) decides FC-001's fix. **Verified not yet implemented** (`deliver()` has no timeout, no try/catch; `sendPasswordResetCode()` still awaited directly — see FC-001's "Verified as not yet fixed"). The genuinely open part: when is it scheduled to land, and does FC-001 block this PRD leaving Draft in the meantime, given the divergence only manifests when SMTP is configured and failing (a non-default, operator-triggered condition, not caller-triggered)? | FC-001, G-002, Architecture Impact | | open |
| Q-004 | **ADR-0012 (Accepted) decides to decouple** the `JWT_SECRET` fallback tier — the pepper would resolve `PASSWORD_RESET_CODE_PEPPER` → a pepper-specific hardcoded literal, independent of JWT signing's own fallback. Note the original premise was corrected during architecture review: the fallback to `JWT_SECRET` is **documented, intended behavior** (`README.md:255`, `ARCHITECTURE.md:125`, `FEATURES_INVENTORY.md:112`), not an undocumented gap — the decision to decouple anyway was reconfirmed after that correction. Remaining before this closes: three now-affected documents (README, ARCHITECTURE, FEATURES_INVENTORY) need updating in the same change, per ADR-0012 Consequences. | C-001, Architecture Impact | | open |
| Q-005 | **Closed — foreclosed, not answered, by ADR-0013 (Accepted):** the adopted `@@unique([userId])` + `upsert()` mechanism for BR-002 (see BR-002, Q-002) overwrites the prior row on every new request, used or not — used rows will no longer be retained going forward, as a side effect of choosing a schema-declarative fix over a raw-SQL one, not because the product question this row asks (was retention ever intentional) has been answered. Foreclosure confirmed acceptable by the product owner as part of accepting ADR-0013 (2026-07-27). If retention is later wanted, ADR-0013 Risks notes it requires a separate append-only mechanism, not a reversal of this decision. | Data Requirements, BR-002 | | closed |
| Q-006 | **Answered by reading `frontend/app/reset-password/page.tsx`:** a confirm-password field exists, is required, and is checked client-side only (`newPassword !== confirm`) — the backend has no knowledge of it and enforces nothing about confirmation. Remaining question: should this be a stated product requirement (e.g. an FR/AC on the reset form), or does it stay purely UX with no backend implication, as it is today? | Current Behavior, FR-002 | | open |
| Q-007 | FINDING-0010 (`docs/architecture/findings/ARCHITECTURE-REVIEW-FINDINGS.md:277`, Status: Open) already records the no-SMTP-host plaintext-secret-logging fallback as a pre-existing issue. Is closing it in this feature's scope (since the reset code is the secret involved here), `PRD-SMTPConfiguration`'s scope (since the fallback mechanism is SMTP configuration's), or a cross-cutting fix independent of either PRD? | Data Requirements, Non Goals | | open |
| Q-009 | Is it acceptable that a 2FA-enabled user who has lost both their password and their 2FA device has no recovery path at all through this feature (`resetPasswordWithCode()` never touches `UserTwoFactor` — see G-001, Current Behavior)? If backup codes exist for this (`two-factor.service.ts`), is that the intended recovery path, and should this feature's PRD say so explicitly, or is that entirely `PRD-TwoFactorAuth`'s (not yet produced) to own? | G-001 | | open |
| Q-010 | Is the 30-minute code TTL (`PASSWORD_RESET_CODE_TTL_MIN`) a deliberately chosen security/UX tradeoff, or an inherited/arbitrary default? **Note:** the reset email hardcodes "It expires in 30 minutes." (`mail.service.ts:54-58`) independent of this constant — if the TTL changes, the email text must be updated separately; owned by backlog #44 (`PRD-044`), not this PRD. | NFR-001 | | open |

## Success Metrics

Not measured today. No instrumentation was found for reset-request volume,
reset-completion rate, or time-to-redemption. Revisit once Q-002 (rate
limiting) is resolved, since a rate-limiting design would likely want these
same metrics.

## Architecture Impact

- Requirements that drove decisions, now decided: G-002/FC-001/FC-004
  (anti-enumeration, scoped to content/status — ADR-0009, Accepted, decides
  the content/status fix but is verified not yet implemented, Q-003; a
  residual timing channel, FC-004, is out of G-002's stated scope and
  unaddressed by either this PRD or ADR-0009; whether a *full*
  anti-enumeration posture — including registration's existing disclosure
  — is wanted at all is `PRD-Login` Q-005's question, not this PRD's to
  answer). C-001/Q-004 (pepper fallback design): **ADR-0012 (Proposed,
  Revision 2)** decided to decouple the pepper from `JWT_SECRET`'s
  fallback — the original discovery framing understated this as
  undocumented; architecture review found it is documented, intended
  behavior in three existing files, which the decision to decouple now
  requires updating. FC-002 (session-invalidation-after-commit ordering —
  same design question `PRD-SessionManagement` FC-006 already raises, not
  a new one, still open there). FC-003/BR-002 (absence of rate limiting
  and the code-invalidation race): **ADR-0013 (Proposed, Revision 2)**
  decided a global `ThrottlerModule` default plus an email-keyed limiter
  on `forgot-password` only for rate limiting (explicitly not eliminating
  harm 2, only bounding it — a genuine new denial-of-issuance risk this
  decision accepts, not a free fix), and `@@unique([userId])` + `upsert()`
  for BR-002's atomicity (also directly answering Q-005). Two earlier
  approaches considered for BR-002 — a transaction wrapper, then a raw-SQL
  partial unique index — were each rejected across two architecture-review
  rounds: the former doesn't close the race under this database's default
  isolation level (per `ADR-0008`'s established reasoning), the latter
  isn't expressible in this repo's schema-management workflow.
- Suspected new components or boundaries: None — `AuthService` and
  `MailService` already exist as the mechanism; ADR-0009 (Accepted) already
  covers the `MailService.deliver()` boundary change, verified not yet
  implemented. ADR-0013's `ThrottlerModule` is a new cross-cutting
  component, registered **application-wide** (its IP-keyed default applies
  to every route, not just auth-adjacent ones, including `login`,
  `2fa/verify`, and `register`), with tightened, route-specific limits
  layered on `forgot-password`/`reset-password`/`login` only — confirming
  the concern this PRD originally flagged, at a larger scope than
  "auth-module." ADR-0013 names an exclusion audit this PRD should carry
  forward as unfinished work, not treat as complete: Prometheus's
  `/metrics` scrape, frontend polling, the Socket.IO ticker transport, and
  order/deposit-flow test loops are its named starting points — see Q-002.
- Known architectural risk: ADR-0013's email-keyed limiter on
  `forgot-password` introduces a new, accepted risk — an attacker who
  knows a victim's email can block that victim's ability to request a
  fresh code for the duration of the rate-limit window (not a lockout on
  redeeming a code already held, which was rejected as strictly worse).
  Limit values must be chosen with this floor in mind, not purely for UX
  (Q-002). Separately, FINDING-0010 (plaintext code in logs under the
  no-SMTP-host fallback, Q-007) is an existing, not newly discovered, risk
  this feature's data touches, and this feature's non-coverage of 2FA-
  enabled accounts (G-001, Q-009) is a product-scope question, not an
  architecture one. Both `ADR-0012` and `ADR-0013` are now `Status:
  Accepted` (2026-07-27) — each went through three architecture-review
  rounds with material corrections at each pass; `ADR-0013`'s adopted
  mechanism was additionally verified empirically against a live Postgres
  instance (concurrent-upsert atomicity, the conditional-redemption fix,
  the required schema cardinality change, and `P2002` `meta.target` shape
  all confirmed as described) before acceptance.
