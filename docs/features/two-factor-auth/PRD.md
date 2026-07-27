# Two-Factor Authentication (2FA / TOTP)

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Low |
| Owner | |
| Last updated | 2026-07-27 |
| Slug | PRD-TwoFactorAuth |

## Overview

Two-Factor Authentication lets an account holder add a TOTP-based second
factor to their account: once enabled, a correct email/password pair alone
no longer completes login — a 6-digit authenticator code (or a one-time
backup code) is also required. It is implemented as an optional, per-account
setting managed from `/profile/settings`, and it is the second-factor branch
`PRD-Login` FR-003 hands off to.

## Current Behavior

- **Setup and enable, both requiring an existing authenticated session**
  (`@UseGuards(JwtAuthGuard, SessionGuard)` on all six management routes —
  status, setup, enable, disable, backup-codes, and regenerate —
  `auth.controller.ts:255-311`): `GET /auth/2fa/setup`
  (`TwoFactorService.getSetup()`, `two-factor.service.ts:14-55`) generates a
  TOTP secret via `speakeasy.generateSecret()`, builds an `otpauth://` URL,
  renders it as a QR code data URL, and upserts a `user_two_factor` row with
  `enabled: false` — throwing if 2FA is already enabled
  (`two-factor.service.ts:18-20`). `POST /auth/2fa/enable`
  (`TwoFactorService.enable()`, `:57-94`) requires a valid 6-digit TOTP code
  against that secret (`speakeasy.totp.verify`, `window: 1` — a ±30s clock
  drift tolerance), then sets `enabled: true`, `enabledAt`, and generates 10
  backup codes (`BACKUP_CODE_COUNT`, `:7`), each 8 characters drawn via
  `Math.random()` from a 32-character alphabet excluding visually ambiguous
  characters (`BACKUP_CODE_LENGTH`, `chars` at `:224`, `generateBackupCodes()`
  at `:222-233`), hashed with bcrypt before storage and returned once, in the
  response body only. **The generator is not a CSPRNG**: `Math.random()` is
  not cryptographically secure, unlike `crypto.randomInt()`, which this same
  codebase uses for password-reset codes (`auth.service.ts`) — see FC-009.
- **Login-time verification**: `AuthService.login()`
  (`auth.service.ts:79-106`) checks `TwoFactorService.is2FaEnabled()`
  (`:88`); if true, it returns a signed temporary token
  (`Temp2FaPayload`, `temp2fa: true` claim, `TEMP_2FA_EXPIRY = '5m'`,
  `:54,90-101`) instead of a full session, and does not create a
  `user_sessions` row. `POST /auth/2fa/verify` is the only 2FA route with no
  `@UseGuards` (`auth.controller.ts:247-253`) — it takes the temp token and
  a code, and `AuthService.verify2Fa()` (`auth.service.ts:191-213`) verifies
  the token's signature and `temp2fa`/`sub` claims, then calls
  `TwoFactorService.verifyCode()` (`two-factor.service.ts:176-206`), which
  tries the TOTP code first and falls back to matching (and, on match,
  removing) a stored backup code hash. On success, it calls the same
  `issueTokenAndSession()` a normal login uses — this is `PRD-Login`
  FR-003's continuation, not a separate mechanism.
- **Disable**: `POST /auth/2fa/disable` (`TwoFactorService.disable()`,
  `:96-139`) accepts either a valid TOTP code or a matching backup code
  (consuming it on match, same as verification), and on success clears
  `enabled` and `enabledAt`. Backup codes are cleared to `[]` only on the
  TOTP-code branch (`:114`); the backup-code branch removes only the one
  code matched, leaving the other 9 hashes stored until overwritten by a
  future `enable()` (`:124-132`) — see FR-004's failure analysis. **The
  TOTP `secret` itself is never cleared by disable** — see FC-012.
- **Backup codes are never retrievable after their one-time display**:
  `GET /auth/2fa/backup-codes` (`TwoFactorService.getBackupCodes()`,
  `:141-153`) always returns an empty `codes` array with an explanatory
  message — it cannot reverse the bcrypt hashes — regardless of whether
  codes exist. `POST /auth/2fa/backup-codes/regenerate`
  (`:155-174`) is the only way to obtain a new usable set, and it overwrites
  (does not append to) the stored set.
- **Frontend, login-time verification
  (`frontend/components/TwoFactorVerificationModal.tsx`)**: the input's
  `onChange` handler strips every non-digit character and truncates to 6
  characters (`handleChange`, `:68-72`); the submit button is disabled
  unless the current value is exactly 6 characters
  (`:153`); client-side validation (`validateTwoFactorCode`,
  `frontend/lib/twoFactorValidation.ts`) additionally rejects anything that
  is not a 6-digit numeric string. **An 8-character backup code cannot be
  entered through this form** — see FC-003.
- **Frontend, login-time "Resend code"**: the modal's resend button
  (`handle2faResend`, `frontend/app/page.tsx:79-83`) calls no API — it sets
  a local "New code sent" success message on a 3-second timer and returns.
  No backend endpoint for resending or regenerating a TOTP prompt exists.
- **Frontend, settings page
  (`frontend/components/TwoFactorSettingsSection.tsx`)**: whenever `enabled`
  and `setupInProgress` settle to `true`/`false` (on mount if already
  enabled, **and immediately after a successful `enable()`**, since
  `handleEnable` sets exactly that pair — `:54-73`), a `useEffect`
  (`:33-37`) calls `getBackupCodes()`, which — per the backend behavior
  above — always returns an empty array; the "Show backup codes" button
  (`:209-216`) then renders placeholder dashes, not an error or
  explanation. **This means the codes `handleEnable` receives and displays
  are overwritten by that same effect within roughly one network
  round-trip** — there is no guard preventing the refetch, and no path
  through the settings UI leaves a real code visible for longer than that.
  `handleRegenerate` (`:101-106`) does **not** trigger the effect (it
  changes neither dependency), so regenerate's display is the one that
  actually survives — the reverse of what the "codes shown once, at
  enable-time" design intends. See FC-014. The disable-2FA input
  (`:224-231`) is free text with no client-side length or character
  filtering, unlike the login verification modal — it can accept a backup
  code.
- **No *purpose-built* 2FA override exists, but `impersonate()` is a
  functioning bypass.** `TwoFactorService` itself is referenced only from
  `auth.service.ts`, `auth.controller.ts`, and `auth.module.ts` (repo-wide
  search) — no admin endpoint reads or writes `user_two_factor` directly.
  However, `AuthService.impersonate()` (`auth.service.ts:457-495`) lets any
  admin mint a full session token and `user_sessions` row for an arbitrary
  target user with **no `is2FaEnabled()` check** — it does not go through
  `login()` or `verify2Fa()` at all, so a 2FA-enabled account provides no
  additional resistance to this path. See FC-006.
- **Setup and enable require no re-proof of the account password**, only an
  existing session (`JwtAuthGuard, SessionGuard`) — see FC-010.
- **`PRD-PasswordReset` never touches 2FA enrollment** (`PRD-PasswordReset`
  G-001, verified there against `auth.service.ts`): a successful password
  reset changes only `passwordHash`.
- **No rate limiting or attempt counting is specific to this feature.**
  `docs/features/login/DISCOVERY.md` documents that `POST /auth/2fa/verify`
  is unguarded, does not count failed attempts, and does not invalidate the
  temp token on a wrong code. `docs/architecture/adr/0013-...md` is
  **Accepted as a decision but not yet implemented in code** — a repo-wide
  search confirms no `@nestjs/throttler` dependency, no `ThrottlerModule`
  registration, and no `@Throttle` decorator anywhere in the backend today.
  ADR-0013's own Context section says as much ("Confirmed repo-wide: No rate
  limiting... exists"). Until that ADR is implemented, `/auth/2fa/verify`
  has **no** rate limiting of any kind, not even the global IP-keyed default
  — this materially raises FC-001's current severity.
- **The temp token's restricted scope is enforced only by a guard-pairing
  convention, not a `temp2fa` claim check.** `docs/features/login/PRD.md`
  C-002 and `docs/features/login/FINDINGS.md` IF-001 document that
  `JwtStrategy.validate()` never inspects the `temp2fa` claim — the temp
  token is prevented from reaching any authenticated route today only
  because every such route also requires `SessionGuard`, which the temp
  token (having no `user_sessions` row) cannot satisfy. `PRD-Login`
  explicitly states this PRD inherits that coupling as a given; not
  re-derived here.

## Problem Statement

An account protected only by a password is only as secure as that password
— if it leaks or is guessed, the account is fully compromised. Account
holders who want stronger protection have no way to require a second,
independent proof of identity at login.

## Goals

- G-001: An account holder can enroll a TOTP authenticator app as a second
  factor and have it required at every subsequent login, so that a leaked
  or guessed password alone is not sufficient to access the account.
  **Scope note:** this holds only for logins that occur after enrollment,
  and only at login time — 2FA is never re-checked against an
  already-established session. An attacker holding a valid session token
  at the moment 2FA is enabled retains full access for the rest of that
  session's life, unaffected. See FC-013.
- G-002: An account holder who loses access to their authenticator device
  can regain account access using a previously issued backup code, without
  administrator involvement. **Not achieved today, and further from working
  than a UI-input restriction alone**: FC-014 shows the settings page
  overwrites the real backup codes `enable()` just displayed within roughly
  one round-trip, so most accounts have no valid saved code to begin with;
  FC-003 additionally shows that even a saved code cannot be submitted
  through the login verification UI (FC-006 Scenario B); and FC-006
  Scenario A shows no self-service path exists once both the device and any
  saved backup codes are gone — the only functioning fallback in that case
  is an admin's `impersonate()`, which is not a purpose-built or
  administrator-involvement-free path either (FC-010). This Goal states the
  evidenced intent
  (`TwoFactorSettingsSection.tsx:180-182`'s own copy: "use... if you lose
  your authenticator device"), not current reality — see Q-002, Q-003.

## Non Goals

- Alternative second-factor delivery methods (SMS, email OTP, push
  approval) — only TOTP (`speakeasy`, RFC 6238) and backup codes exist in
  the current implementation.
- A *purpose-built* account recovery path when both the password and the
  second factor (device and backup codes) are lost — no such path exists
  today; the only functioning path is `impersonate()`, not built for this
  purpose (FC-006 Scenario A, FC-010); whether a dedicated path should exist
  is Q-003, not designed here.
- Auditing or hardening `AuthService.impersonate()` itself — it predates
  this feature and is shared infrastructure (`docs/features/login/PRD.md`,
  session management); this PRD only documents its interaction with 2FA
  (FC-006, FC-010) and raises whether that interaction is acceptable (Q-003,
  Q-010), not how impersonation should work in general.
- Enforcing or verifying that an account holder actually stored their
  backup codes before proceeding — no such check exists or is assumed
  needed.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account Holder | Human | A user enrolling in, authenticating against, or managing their own 2FA |
| Auth Service | System | `AuthService.login()` / `verify2Fa()` — decides whether login needs a second factor and finalizes login after it's proven |
| Two-Factor Service | System | `TwoFactorService` — owns the setup/enable/disable/verify/backup-code lifecycle and the `user_two_factor` record |
| Session Service | System | `issueTokenAndSession()`, called identically to a normal login on successful second-factor verification (`PRD-SessionManagement` FR-001) |

## User Stories

- US-001: As an account holder, I want to enable 2FA using an authenticator
  app, so that my password alone is not enough for someone else to access
  my account.
- US-002: As an account holder with 2FA enabled, I want to enter my
  authenticator code after my password at login, so that only someone
  holding my device can complete sign-in.
- US-003: As an account holder, I want backup codes issued when I enable
  2FA, so that I have a way back in if I lose my device.
- US-004: As an account holder, I want to disable 2FA when I no longer want
  it, so that I can simplify how I sign in.
- US-005: As an account holder, I want to regenerate my backup codes, so
  that I can replace ones I've used or lost track of.

## Functional Requirements

### FR-001: Begin 2FA setup

- **Description:** The system must, for an authenticated account holder
  without 2FA already enabled, generate a new TOTP secret and present it as
  both a scannable QR code and a manually enterable value.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an authenticated account with 2FA not enabled, when setup is
    requested, then a new secret is generated and a QR code representing it
    is returned, and the secret is persisted (not yet enabled).
  - Given an authenticated account with 2FA already enabled, when setup is
    requested, then the request is rejected and no secret changes.
- **Related:** US-001, G-001
- **Failure analysis:** No FC recorded — setup has no state that outlives
  the enable step it feeds into (FR-002); re-running setup safely
  overwrites any prior pending, not-yet-enabled secret, and this is already
  covered by this FR's own acceptance criteria rather than representing a
  distinct failure mode.

### FR-002: Enable 2FA

- **Description:** The system must activate 2FA for an account only after
  the account holder proves control of the authenticator by submitting a
  valid code for the secret generated in FR-001, and must issue backup
  codes at that moment.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a pending (not-yet-enabled) secret from FR-001 and a valid
    6-digit TOTP code for it, when enable is requested, then 2FA becomes
    enabled for the account and 10 single-use backup codes are returned in
    the response.
  - Given an invalid TOTP code, when enable is requested, then 2FA remains
    disabled and no backup codes are generated.
  - Given no pending setup exists, when enable is requested, then the
    request is rejected.
- **Governed by:** BR-001, BR-003
- **Related:** US-001, US-003, G-001
- **Failure analysis:** See FC-008, FC-009, FC-010, FC-013.

### FR-003: Verify the second factor at login

- **Description:** The system must, given a temp token issued by
  `PRD-Login` FR-003 and a code, grant full access (equivalent to a normal
  successful login) only if the code is a valid TOTP code or an unused
  backup code for the account the temp token identifies.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria** (stated at the API boundary — all three are
  satisfiable by a backend test suite while G-002 remains unmet through
  every user-reachable path, since FC-003 blocks backup-code entry at the
  UI layer, not the API):
  - Given a valid, unexpired temp token and a correct TOTP code, when
    verification is requested, then a full access token and session are
    issued, identical in effect to a non-2FA login.
  - Given a valid, unexpired temp token and a correct, unused backup code,
    when verification is requested, then a full access token and session
    are issued, and that backup code becomes unusable for any future
    request.
  - Given an expired or invalid temp token, or an incorrect code, when
    verification is requested, then access is refused and no session is
    created.
- **Governed by:** BR-001
- **Related:** US-002, US-003, G-001
- **Failure analysis:** See FC-001, FC-003, FC-007.

### FR-004: Disable 2FA

- **Description:** The system must, given a valid TOTP code or an unused
  backup code, disable 2FA for the account, clearing its `enabled` state
  and backup codes (the stored TOTP secret is retained, not cleared — see
  Failure analysis and FC-012).
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given 2FA enabled and a valid TOTP or backup code, when disable is
    requested, then 2FA is disabled and no backup codes remain usable.
  - Given an invalid code, when disable is requested, then 2FA remains
    enabled.
- **Governed by:** BR-001
- **Related:** US-004
- **Failure analysis:** See FC-012 for the success path's secret-retention
  behavior — disable does **not** clear the stored TOTP secret column
  (`two-factor.service.ts:112-115,126-133`; `UserTwoFactor.secret` is
  non-nullable, `schema.prisma:66`), though the only user-reachable
  re-enable path forces a fresh secret anyway (FC-012 detail). No FC
  recorded for the rejection path — a rejected
  request simply leaves 2FA enabled, already covered by this FR's own
  acceptance criteria. Note on the success path: "no backup codes remain
  usable" is true in effect (2FA becomes `enabled: false`, and every
  verification path gates on that flag first — `verifyCode()`,
  `two-factor.service.ts:180`), but not true in storage for every branch.
  The TOTP-code disable branch clears `backupCodes` to `[]`
  (`:114`); the backup-code disable branch only removes the one code that
  was matched, leaving the other 9 hashes in the row until a future
  `enable()` overwrites them (`:124-132`). Both leave the account with zero
  *usable* codes; only the first leaves zero *stored* codes.

### FR-005: Regenerate backup codes

- **Description:** The system must, for an account with 2FA enabled, allow
  replacing all backup codes with a new set, invalidating every previously
  issued code.
- **Actor:** Account Holder
- **Priority:** Should
- **Acceptance Criteria:**
  - Given 2FA enabled, when regeneration is requested, then 10 new backup
    codes are returned and none of the previous set remain usable.
  - Given 2FA not enabled, when regeneration is requested, then the request
    is rejected.
- **Governed by:** BR-002
- **Related:** US-005
- **Failure analysis:** See FC-009, FC-011.

### FR-006: Query 2FA status

- **Description:** The system must let an authenticated account holder
  determine whether 2FA is currently enabled on their account.
- **Actor:** Account Holder
- **Priority:** Should
- **Acceptance Criteria:**
  - Given an authenticated account, when status is requested, then the
    current enabled/disabled state is returned.
- **Related:** US-001, US-004

## Failure Conditions

### FC-001: No limit on verification attempts against a live temp token, and no invalidation even on success

- **Applies to:** FR-003
- **Condition:** `POST /auth/2fa/verify` carries no guard, no per-account or
  per-token attempt counter, and does not invalidate the temp token on a
  wrong code (`auth.controller.ts:247-253`, `auth.service.ts:191-213`). A
  temp token remains valid for its full 5-minute lifetime regardless of how
  many incorrect codes are submitted against it, and — distinct from the
  wrong-code case — **it is also not invalidated after a *correct*
  verification.** `verify2Fa()` calls `issueTokenAndSession()` but never
  revokes or marks the temp token as spent, so a captured
  `(tempToken, code)` pair remains replayable for the rest of the token's
  5-minute window, letting an attacker who observed one successful
  verification mint additional independent sessions without needing a new
  code. `ADR-0013` (Accepted as a decision, not yet implemented in code —
  see Current Behavior) would apply only its global IP-keyed default here
  in any case, and explicitly defers attempt-counting and temp-token
  invalidation to this PRD.
- **Expected behavior:** Not currently defined by the product. See Q-001.

### FC-002: Temp token scope enforced only by a coincidental guard-pairing convention

- **Applies to:** (system-level)
- **Condition:** `JwtStrategy.validate()` never inspects the `temp2fa`
  claim; the temp token is blocked from every authenticated route today
  only because each pairs `SessionGuard` alongside `JwtAuthGuard`, and the
  temp token has no session row to satisfy it. This is `docs/features/
  login/FINDINGS.md` IF-001, inherited here as `PRD-Login` C-002 states,
  not re-derived.
- **Expected behavior:** Not currently defined by the product; ownership of
  a fix (a `temp2fa`-aware guard, or continued reliance on the pairing
  convention) is unassigned. See Q-004.

### FC-003: Backup codes cannot be entered through the login verification UI

- **Applies to:** FR-003
- **Condition:** `TwoFactorVerificationModal.tsx`'s input strips every
  non-digit character and truncates to 6 characters on every keystroke,
  and its submit button is disabled unless the value is exactly 6
  characters long (`:68-72,153`); `validateTwoFactorCode()` additionally
  rejects non-6-digit input. An 8-character alphanumeric backup code cannot
  be typed, pasted, or submitted through this form, even though the backend
  (`Verify2FaDto`'s `MinLength(6)`, `TwoFactorService.verifyCode()`) fully
  supports redeeming one. The account-settings disable form has no such
  restriction and does accept backup codes.
- **Expected behavior:** Not currently defined by the product. See Q-002.

### FC-004: "Resend code" is a non-functional affordance

- **Applies to:** FR-003
- **Condition:** The login modal's resend button
  (`frontend/app/page.tsx:79-83`) calls no backend endpoint; it only shows
  a timed local success message. No resend mechanism exists server-side,
  and none would have meaning for TOTP (the code is generated by the
  account holder's own app, not sent by the server).
- **Expected behavior:** Not currently defined by the product. See Q-005.

### FC-005: "Show backup codes" silently renders placeholders instead of real codes or an explanation

- **Applies to:** FR-002 (the display path), (system-level for the UI gap)
- **Condition:** `GET /auth/2fa/backup-codes` always returns an empty
  `codes` array with an explanatory `message` field
  (`two-factor.service.ts:141-153`) — by design, since bcrypt hashes cannot
  be reversed. The settings UI fetches this on every mount when 2FA is
  enabled and, on "Show backup codes," renders placeholder dashes
  (`TwoFactorSettingsSection.tsx:184-192`) without surfacing the backend's
  `message` or otherwise indicating the codes are gone. An account holder
  revisiting the page after their initial enable sees what looks like an
  empty or broken list, not an explanation that codes are shown once only.
  **This is the same effect, not a separate one, as FC-014**: the identical
  `useEffect`/`getBackupCodes()` call fires both on a later revisit and
  immediately after `enable()` itself, so the "empty or broken list"
  experience is not confined to a return visit — it is what every enable
  ends in, on the same page load.
- **Expected behavior:** Not currently defined by the product. See Q-006.

### FC-006: No *self-service* recovery path exists if both the password and the second factor are lost — but an *admin-operated* bypass does

- **Applies to:** (system-level)
- **Condition:** Two distinct scenarios, previously conflated:
  - **Scenario A — account holder has no backup codes saved.**
    `PRD-PasswordReset` never touches `UserTwoFactor` enrollment
    (`PRD-PasswordReset` G-001), so a password reset alone cannot restore
    login access to a 2FA-enabled account whose device and backup codes are
    both gone. No self-service path exists for this case.
  - **Scenario B — account holder still has a saved backup code.**
    The backend fully supports redeeming it (`Verify2FaDto` `MinLength(6)`,
    `TwoFactorService.verifyCode()`), but `TwoFactorVerificationModal.tsx`
    cannot submit an 8-character value (FC-003) — a purely frontend gap,
    not a missing capability.
  - **Correcting the prior claim of "no admin override":** `AuthService.
    impersonate()` (`auth.service.ts:457-495`) *is* a functioning bypass —
    any admin can mint a full session for a 2FA-enabled target account with
    no `is2FaEnabled()` check and no second-factor prompt. It was not built
    as a 2FA-recovery mechanism (nothing in the code or naming suggests
    that intent — see Q-003), but it functions as an unconditional one
    today. This **falsifies A-002** as originally stated and changes what
    "no recovery path" means: the accurate statement is *no self-service*
    recovery path exists, while an *unaudited, non-purpose-built* admin
    path does.
  - **This revises the answer to `PRD-PasswordReset` Q-009**: backup codes
    are not a working recovery path via the login UI today (Scenario B is a
    frontend fix away from being one); `impersonate()` is a working, if
    accidental and unaudited, admin-assisted path for both scenarios.
- **Expected behavior:** Not currently defined by the product for either
  scenario, or for whether `impersonate()`'s reach into 2FA-enabled
  accounts is an accepted risk or a gap to close. See Q-002, Q-003.

### FC-007: TOTP codes are not tracked for reuse

- **Applies to:** FR-003
- **Condition:** `speakeasy.totp.verify()` is called with no tracking of
  previously accepted time-steps for the account, in `verifyCode()`,
  `enable()`, and `disable()` alike. A TOTP code intercepted or observed
  (e.g. shoulder-surfed) remains valid for reuse within its `window: 1`
  tolerance (approximately the current and adjacent ~30-second steps).
- **Expected behavior:** Not currently defined by the product. See Q-007.

### FC-008: Backup codes can become irrecoverable if the enable response never reaches the client

- **Applies to:** FR-002
- **Condition:** `TwoFactorService.enable()` commits `enabled: true` and the
  bcrypt-hashed backup codes to the database in the same call that
  generates the plaintext codes to return
  (`two-factor.service.ts:84-93`). If the HTTP response carrying those
  plaintext codes never reaches the client (network failure, browser
  crash, tab closed mid-request) after that write has already committed,
  the account is left with 2FA enabled and backup codes the account holder
  never saw. Per BR-002, those codes can never be redisplayed — only
  regenerated, which the account holder has no reason to know they need to
  do, since from their perspective enable() appeared to fail.
  **Severity note**: FC-014 shows the codes are lost on *every* successful
  enable via the settings UI, not only this transport-failure case — this
  FC's scenario (response never arrives at all) is now the less common of
  the two ways this account ends up with unseen backup codes, not the only
  one.
- **Expected behavior:** Not currently defined by the product. See Q-008.

### FC-009: Backup codes are generated with a non-cryptographic RNG

- **Applies to:** FR-002, FR-005
- **Condition:** `generateBackupCodes()` (`two-factor.service.ts:222-233`)
  draws each character via `Math.floor(Math.random() * chars.length)`.
  `Math.random()` is not a cryptographically secure random source (no
  uniformity or unpredictability guarantee suitable for security tokens).
  This is inconsistent within the same codebase: `auth.service.ts` uses
  `crypto.randomInt()` to generate password-reset codes, a value of
  comparable sensitivity. Backup codes are hashed with bcrypt at rest (BR-002),
  which protects against a database read but not against an attacker able to
  predict or narrow `Math.random()`'s output. **This is more than a
  theoretical weak-RNG concern**: `POST /auth/2fa/backup-codes/regenerate`
  (`auth.controller.ts:303-311`) lets any authenticated user repeatedly draw
  fresh output from the generator against their own account — 80 characters
  of `Math.random()`-derived plaintext per call, with no rate limit today
  (see Current Behavior on `ADR-0013`). `Math.random()` is a single
  process-global generator, so this is a self-service, unmetered sampling
  channel against the same stream that produces every other account's
  codes, not an isolated per-account weakness.
- **Expected behavior:** Not currently defined by the product. See Q-009.

### FC-010: A hijacked session can permanently lock the legitimate account holder out via 2FA enrollment

- **Applies to:** FR-001, FR-002
- **Condition:** `GET /auth/2fa/setup` and `POST /auth/2fa/enable` require
  only `JwtAuthGuard, SessionGuard` (`auth.controller.ts:255-311`) — proof of
  an existing session, not re-proof of the account password. An attacker who
  has captured a valid session token (e.g. via XSS, a leaked token, or a
  physically unattended session) can enroll *their own* authenticator as the
  account's second factor. From that point, only that attacker's device or
  backup codes can complete login or disable 2FA (FR-003, FR-004) — the
  legitimate account holder, still knowing the correct password, is locked
  out with no route back short of whatever recovers Scenario A/B under
  FC-006. BR-003's proof-of-possession requirement does not prevent this: it
  only proves *the session holder* controls an authenticator, not that the
  session holder is the legitimate account owner.
- **Expected behavior:** Not currently defined by the product. See Q-010.

### FC-011: Regenerating backup codes can lose the new set the same way FC-008 loses the initial set — with a working set already destroyed first

- **Applies to:** FR-005
- **Condition:** `regenerateBackupCodes()` (`two-factor.service.ts:155-174`)
  overwrites the existing backup-code set with a freshly generated one in the
  same call that returns the new plaintext codes, the same commit-before-
  delivery ordering as FC-008. This is strictly worse than FC-008 for FR-005:
  FR-002's version loses codes that may never have been used yet, but a
  regenerate failure destroys a *previously working, possibly already-relied-
  upon* set to replace it with one the account holder never received, and
  leaves them with zero usable codes rather than the original set. The
  frontend's `handleRegenerate` has no error handling for a failed or lost
  response.
- **Expected behavior:** Not currently defined by the product. See Q-008
  (extended to cover FR-005; same underlying mechanism).

### FC-012: A disabled account's TOTP secret is retained indefinitely, and is reachable by direct API use without a fresh setup

- **Applies to:** FR-004, FR-002, FR-001
- **Condition:** Two distinct facts, previously conflated in this FC:
  - **Retention at rest.** `disable()` never writes to the `secret` column
    (`two-factor.service.ts:112-115,126-133`); it is non-nullable in the
    schema (`schema.prisma:66`) and is never reset to an empty value either.
    The secret therefore persists in the database indefinitely once a row
    has been created — including for accounts that only ever called
    `GET /auth/2fa/setup` and never completed `enable()`, since `getSetup()`
    itself already writes a secret (`:36-49`). This compounds C-001's
    plaintext-at-rest risk: "database compromise yields standing 2FA-bypass
    capability" applies to every account that has ever *started* setup, a
    broader set than every enrolled account.
  - **No user-facing rotation gap.** Through the only re-enable path the
    settings UI exposes — `handleStartSetup` → `getSetup()` →
    `handleEnable` (`TwoFactorSettingsSection.tsx:39-52,122-139,141-174`) —
    `getSetup()`'s `update` branch always writes a **new** secret and resets
    `backupCodes`/`enabled` (`:44-48`). A user who disables and re-enables
    through the UI therefore *does* get a fresh secret; the retention risk
    above is a database/API-level concern, not a symptom a UI user would
    ever encounter. It is only reachable by a caller invoking
    `POST /auth/2fa/enable` directly without a preceding `getSetup()` call —
    something the UI never does, but the API does not prevent.
- **Expected behavior:** Not currently defined by the product. See Q-011.

### FC-013: Enabling 2FA does not revoke sessions issued before enrollment

- **Applies to:** FR-002
- **Condition:** `enable()` writes only to the `user_two_factor` row
  (`two-factor.service.ts:84-91`) and never calls
  `deleteAllUserSessions()` — the one method in this codebase that already
  exists for exactly this class of action, and is currently called only
  from `resetPasswordWithCode()` (`auth.service.ts:179`). Sessions live up
  to 7 days (`JWT_EXPIRY = '7d'`). `SessionGuard` checks only token hash
  and expiry (`session.guard.ts:27-32`); it does not re-evaluate
  `is2FaEnabled()` for a request against an already-established session.
  G-001 states enabling 2FA means "a leaked or guessed password alone is
  not sufficient to access the account" — this is true only for logins
  that happen *after* enrollment. An attacker already holding a valid
  session token when the legitimate holder enables 2FA (the scenario most
  likely to actually motivate enabling it — suspected compromise) retains
  full access for up to the remainder of that session's 7-day life,
  unaffected by the new second factor, with no signal to the account
  holder and no "sign out other devices" control in the settings UI.
- **Expected behavior:** Not currently defined by the product. See Q-012.

### FC-014: The one moment backup codes are meant to be shown is overwritten by the same page's own refetch

- **Applies to:** FR-002
- **Condition:** `handleEnable` (`TwoFactorSettingsSection.tsx:54-73`) sets
  `enabled: true` and `setupInProgress: false` and displays the real backup
  codes from `enable()`'s response. That exact state pair is the dependency
  array of the `useEffect` at `:33-37`, which re-fires on the same render
  cycle and calls `getBackupCodes()` — which always returns `[]` by design
  (`two-factor.service.ts:141-153`). The fetch has no guard against
  clobbering codes just set from a direct response, so the real codes are
  replaced by placeholder dashes within roughly one round-trip of `enable()`
  succeeding. This is **not** the network-failure/lost-response case FC-008
  describes — it reproduces on every successful enable, regardless of
  network conditions, making loss the routine outcome rather than an edge
  case. `handleRegenerate` (`:101-106`) does not share this effect
  dependency, so it is the one action whose displayed codes are not
  self-overwritten.
- **Expected behavior:** Not currently defined by the product. See Q-002
  (widened) and Q-013.

## Non Functional Requirements

### NFR-001: Temp token expiry

- **Category:** Security
- **Requirement:** A 2FA temp token issued at login must not be redeemable
  more than 5 minutes after issuance.
- **Measurement:** Observable black-box test: submit a correct code via the
  same temp token at T+4 minutes (accepted) and T+6 minutes (rejected).
  Matches `TEMP_2FA_EXPIRY = '5m'` (`auth.service.ts:54,96`).
- **Priority:** Must

Beyond temp-token expiry, no other measurable NFR (verification latency,
setup availability, brute-force resistance target) was found or stated
anywhere in the system — see Open Questions.

## Business Rules

### BR-001: A backup code is single-use

- **Rule:** Once a backup code has been successfully matched (during
  verification or disable), it is removed from the account's stored set
  and can never be redeemed again.
- **Rationale:** A code that remains valid after use would let anyone who
  intercepted it (e.g. from where it was saved) authenticate a second time;
  single-use closes that window.

### BR-002: Backup codes cannot be redisplayed once issued, only replaced

- **Rule:** The system never returns a previously generated backup code's
  plaintext value again after its one-time issuance response. The only way
  to obtain a usable set after that is to generate a new one, which
  invalidates the old set.
- **Rationale:** Storing or exposing a durable read-back channel for these
  codes would create a standing credential-exposure risk; codes are hashed
  at rest specifically so this cannot happen even via a compromised read
  endpoint or database access.

### BR-003: Enabling 2FA requires proof of authenticator possession

- **Rule:** 2FA cannot become enabled for an account without first
  presenting a valid TOTP code for the newly generated secret.
- **Rationale:** Without this, `enable()` could succeed against a secret the
  account holder never actually loaded into a working authenticator app,
  leaving 2FA "on" but practically unusable by its legitimate owner.
  **This rule does not defend against a hijacked session** — proof of
  possession only shows *whoever holds the session* controls some
  authenticator app; if that holder is an attacker (not the account owner),
  the same proof is what lets the attacker's own authenticator become the
  account's permanent second factor, locking the legitimate owner out. See
  FC-010; BR-003 and FC-010 describe the same mechanism from opposite
  sides — the proof-of-possession step that stops accidental
  misconfiguration is exactly what makes a session-hijack enrollment
  durable.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| 2FA record (`user_two_factor`: `userId`, `secret`, `backupCodes[]`, `enabled`, `enabledAt`) | this feature | Indefinite while the account exists; `onDelete: Cascade` removes it if the user is deleted | `secret` (regulated/highly sensitive): stored in **plaintext**, not hashed — a TOTP verifier must compute matching codes from the raw secret, so hashing it is not possible with this scheme; a database compromise yields standing 2FA-bypass capability for every enrolled account, with no rotation mechanism found. `backupCodes` (sensitive): stored as bcrypt hashes at rest, consistent with password-equivalent handling — but *generated* via `Math.random()`, not a CSPRNG, unlike this codebase's password-reset codes (`crypto.randomInt()`); the at-rest protection does not compensate for a weaker generation source. See FC-009. |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Login (`PRD-Login`) | inbound | `login()` decides to issue a temp token instead of a session based on `is2FaEnabled()`; this feature's FR-003 is the continuation of that decision | blocking |
| Session Management (`PRD-SessionManagement`) | outbound | Successful verification calls the same `issueTokenAndSession()` a normal login uses | blocking |
| Password Reset (`PRD-PasswordReset`) | related, not blocking | `PRD-PasswordReset` Q-009 asked whether backup codes are this account's recovery path if both password and device are lost; this PRD's FC-006 revises that answer — the UI path doesn't work today (fixable), and the only working fallback is `impersonate()`, not backup codes | — |
| Admin Impersonation (`AuthService.impersonate()`, shared with `PRD-Login`/session management) | inbound | Bypasses this feature's second factor entirely with no `is2FaEnabled()` check; functions as this account's only working "lost everything" recovery path today, though not built for that purpose | blocking (FC-006, FC-010) |
| Rate limiting (`ADR-0013`, Accepted decision, **not yet implemented**) | inbound (planned) | Once implemented, would apply its global IP-keyed default to `/auth/2fa/verify`; would not provide attempt-counting or temp-token invalidation even then, leaving that to this PRD (FC-001) | currently absent, not degraded — see Current Behavior |

## Constraints

- C-001: The TOTP secret must be stored in a form the server can use to
  compute matching codes, which rules out one-way hashing — this is
  inherent to the TOTP standard (RFC 6238), not a choice this feature made
  independently. See Data Requirements.
- C-002: Backup codes are drawn from a fixed 32-character alphabet
  excluding visually ambiguous characters (`chars` at
  `two-factor.service.ts:224`), 8 characters each, 10 codes per set — fixed
  constants (`BACKUP_CODE_COUNT`, `BACKUP_CODE_LENGTH`), not configurable
  per account or deployment.
- C-003: TOTP verification uses a fixed `window: 1` clock-drift tolerance
  (`two-factor.service.ts:72,108,188`) across setup, verification, and
  disable — not configurable per account.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The non-functional "Resend code" button (FC-004) was scaffolded for a future non-TOTP delivery channel that was never built, rather than shipped as dead UI by oversight | If wrong, it's simply a defect to remove rather than a signal of planned future scope | |
| A-002 | ~~No hidden or test-only bypass for 2FA verification exists anywhere in the codebase beyond what this discovery found~~ | **Status: Retired.** **Retired:** 2026-07-27. **Reason:** Falsified — `AuthService.impersonate()` (`auth.service.ts:457-495`) is a functioning, unconditional bypass of 2FA for any target account, confirmed against source during PRD review. See FC-006, FC-010. **Replaced by:** no replacement assumption; the fact is now stated directly in Current Behavior and FC-006. | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Should `POST /auth/2fa/verify` have per-account or per-token attempt limits, and should a wrong code invalidate the temp token, closing FC-001? `ADR-0013` explicitly left this decision to this PRD. | FC-001, Architecture Impact | | open |
| Q-002 | What has to change for a user to *obtain and retain* a usable backup code at all — not only whether the login modal should accept one (FC-003/FC-006 Scenario B), but also fixing the settings-page refetch that overwrites the codes `enable()` just displayed (FC-014)? Both must close for G-002/US-003 to be met; today, FC-014 means most accounts have no saved code to submit in the first place. | FC-003, FC-006, FC-014, G-002 | | open |
| Q-003 | Should a *purpose-built, audited* self-service or admin-assisted recovery path be introduced for a user who has lost both password and second factor (FC-006 Scenario A), and separately: is `impersonate()`'s unconditional reach into 2FA-enabled accounts (FC-006, FC-010) an intended safety valve that should be documented and audited, or a gap that should require step-up/2FA-aware handling before it can bypass 2FA? These are two different design questions the prior single Q-003 conflated. | FC-006, FC-010, Non Goals | | open |
| Q-004 | Should the temp token carry an enforced `temp2fa` check at the guard/strategy level (closing FC-002/IF-001), or is continued reliance on the guard-pairing convention an accepted risk? Same question `PRD-Login` C-002 already raises; not re-opened, only carried forward as this feature's stake in it. | FC-002 | | open |
| Q-005 | Is "Resend code" (FC-004) meant to be removed, or does it anticipate a future non-TOTP delivery channel? | FC-004 | | open |
| Q-006 | Should "Show backup codes" (FC-005) surface the backend's explanatory message, or be removed/disabled after the codes are no longer viewable, instead of rendering placeholder dashes? | FC-005 | | open |
| Q-007 | Is TOTP code reuse within its validity window (FC-007) an accepted risk for this training sandbox, or worth closing (e.g. tracking the last accepted time-step per account)? | FC-007 | | open |
| Q-008 | Should `enable()` and `regenerateBackupCodes()` change their ordering or add a confirmation step so backup codes are never committed as the account's only copy without confirmed client receipt, closing FC-008 and FC-011? | FC-008, FC-011 | | open |
| Q-009 | Is the self-service, unmetered sampling channel FC-009 describes (any user can repeatedly draw `Math.random()` output via regenerate) an acceptable risk for this training sandbox, or does it warrant moving to a CSPRNG (e.g. `crypto.randomInt()`, already used elsewhere in this codebase) regardless of rate limiting? | FC-009 | | open |
| Q-010 | **Resolved by `ADR-0015` (Accepted):** `enable()` will require re-proof of the account password (step-up authentication) before proceeding. Closes FC-010. | FC-010, BR-003 | | resolved |
| Q-011 | Two separate questions FC-012 raises: (a) should a disabled account's TOTP secret be purged from storage rather than retained indefinitely, given every account that ever started setup carries standing plaintext-secret risk; and (b) should `POST /auth/2fa/enable` itself require a `getSetup()`-issued secret rather than accepting reactivation of an old one via direct API use (the settings UI already avoids this by construction)? | FC-012 | | open |
| Q-012 | **Resolved by `ADR-0014` (Accepted):** enabling 2FA will revoke all other existing sessions for the account, preserving the enrolling session. Closes FC-013. | FC-013 | | resolved |
| Q-013 | Should the settings-page `useEffect` that clobbers just-displayed backup codes (FC-014) simply not re-fetch immediately after `enable()`/`regenerateBackupCodes()` set the codes directly (a narrow frontend fix), or does the "backup codes are shown exactly once" design need a more deliberate confirmation-of-receipt step regardless (overlapping Q-008)? | FC-014 | | open |

## Success Metrics

Not measured today. No instrumentation was found for 2FA enrollment rate,
enrollment completion rate (setup started vs. enabled), backup-code usage
rate, or login abandonment at the second-factor step. Revisit once Q-001–
Q-003 are resolved, since any UX or security change to the verification
flow would want these same metrics to evaluate its effect.

## Architecture Impact

**Resolved by architecture discovery and ADR drafting** (2026-07-27):
`ADR-0014` (Accepted) decides FC-013/Q-012 — 2FA enrollment will revoke
other existing sessions, preserving the enrolling one. `ADR-0015`
(Accepted) decides FC-010/Q-010 — `enable()` will require step-up password
re-verification. See `docs/features/two-factor-auth/DISCOVERY.md` for the
full candidate-ADR analysis, including which PRD-flagged items were
deliberately *not* promoted to new ADRs (FC-001/FC-002, already owned by
`ADR-0013` and `login/FINDINGS.md` IF-001 respectively) and which became
Implementation Findings instead of ADRs (FC-006/FC-009/FC-012 — see
`docs/features/two-factor-auth/FINDINGS.md` IF-002–IF-004). No C4 diagram
was warranted — no new container/component boundary.


- Requirements likely to drive decisions: FC-001/FC-007 (attempt-counting,
  temp-token invalidation on both failure and success, and/or replay
  prevention for `/auth/2fa/verify` — a candidate ADR, complementary to
  `ADR-0013` rather than a duplicate of it, since `ADR-0013` explicitly
  deferred this exact decision here, and since `ADR-0013` itself is not yet
  implemented); FC-002/IF-001 (whether the temp token's scope should be
  enforced structurally rather than by convention — the same open candidate
  `PRD-Login` already surfaced, not a new one); FC-003/FC-006 (backup codes
  as a functioning recovery path — a frontend fix, distinct from the
  separate FC-006/FC-010 question of whether `impersonate()`'s unconditional
  reach into 2FA-enabled accounts is acceptable); FC-010 (step-up
  authentication before `enable()`, if Q-010 answers yes — a new
  cross-cutting mechanism, not specific to this feature, if other sensitive
  account changes should require it too); FC-013 (whether `enable()` should
  call the existing `deleteAllUserSessions()` mechanism `resetPasswordWithCode()`
  already established a precedent for — likely a `PRD-SessionManagement`-adjacent
  decision, not a new mechanism, if adopted); FC-012 (secret rotation on
  disable/re-enable — extends FR-002/FR-004's existing logic, no new
  mechanism needed).
- Suspected new components or boundaries: None required to close FC-001,
  FC-002, FC-003, FC-009, FC-011, FC-012, or FC-013 — these are fixable
  within existing components, and FC-013 specifically can reuse
  `deleteAllUserSessions()`, already shared infrastructure. FC-010 (step-up
  auth) would likely introduce a reusable mechanism (not 2FA-specific) if
  adopted. If Q-003 concludes `impersonate()`'s current 2FA-bypass behavior
  needs auditing, gating, or logging, that changes existing shared admin
  infrastructure rather than adding a new container.
- Known architectural risk: the plaintext-at-rest TOTP secret (C-001) is a
  structural property of TOTP, not a fixable defect, but it means this
  system's database is a single point of full 2FA compromise — worth
  weighing alongside `ADR-0012`'s pepper-secret handling as the same class
  of at-rest-secret risk this codebase already has precedent for reasoning
  about. FC-001/FC-002/FC-007/FC-009/FC-010 together describe an
  authentication step with materially weaker attack-resistance than the
  password step it follows, despite being introduced as the stronger
  factor — and FC-010/FC-006 show the weakest link is not TOTP mechanics at
  all, but the surrounding session- and admin-trust boundaries this feature
  otherwise assumed were solid.
