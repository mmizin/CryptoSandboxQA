# User Login

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Medium |
| Owner | |
| Last updated | 2026-07-26 |
| Slug | PRD-Login |

## Overview

User Login lets an existing account holder authenticate with email and
password to obtain a session and access token, so they can reach
authenticated areas of the sandbox (wallets, orders, admin tooling). It is
the re-entry path for every account created via Registration.

## Current Behavior

- Frontend: the sign-in form lives on the landing page (`/`), which also
  hosts the 2FA verification modal. The `/login` route (`frontend/app/login/page.tsx`)
  is a 14-line client component whose entire body is `router.replace('/')` —
  it renders no form of its own and is a redirect alias, not a second entry
  point (see Q-004).
- Backend: `POST /auth/login` (unauthenticated) accepts email and password
  via `LoginDto`.
- Email is lowercased before the credential lookup; password is compared
  against the stored bcrypt hash.
- If the email is not found or the password does not match, the request is
  rejected with a 401 and the identical message "Invalid email or password"
  in both cases — the response status and body do not distinguish the two.
  This is *not* a complete anti-enumeration guarantee: `POST /auth/register`
  discloses account existence directly ("Email already registered" —
  see `PRD-Registration` FC-001, Q-004, and `ADR-0008`), and `validateUser()`
  only reaches the bcrypt comparison when the account exists
  (`auth.service.ts:70-77`), which is a timing side-channel independent of
  the message text. See Q-005.
- If the credentials are valid and the account has 2FA (TOTP) enabled, login
  does not issue a session token yet. It returns a short-lived (5 minute)
  temporary token and a flag indicating 2FA verification is required. Full
  session/token issuance in that case is completed by the 2FA verification
  step, owned by `PRD-TwoFactorAuth` (Two-Factor Authentication, not yet produced) —
  not duplicated here.
- If the credentials are valid and 2FA is not enabled, a JWT access token
  (7-day expiry) is issued and a `user_sessions` row is created via
  `SessionsService.createSession()`, associating the session with that
  token. The response includes the access token and the user object (profile
  included, password hash stripped).
- Field limits are enforced by `LoginDto`: email ≤ 254 chars (must be a
  valid email format), password ≥ 6 chars. No maximum password length is
  enforced.
- No rate limiting, lockout, or brute-force throttling on `/auth/login` was
  found in the codebase (see Q-002).
- Protected routes are guarded by `JwtAuthGuard` (validates the JWT) and
  `SessionGuard` (validates the session record still exists/is valid);
  session lifecycle — expiry, revocation, logout — is owned by
  `PRD-SessionManagement` (Session Management, not yet produced) and not duplicated here.

## Problem Statement

An existing account holder has no way to re-enter their own sandbox account
and reach authenticated features without proving, on each new visit, that
they hold the credentials associated with that account.

## Goals

- G-001: An existing account holder can authenticate with the same
  email/password pair used at registration and reach authenticated features.
- G-002: An account cannot be accessed by presenting a wrong password,
  regardless of how close it is to the correct one. Login's response status
  and message body do not distinguish "wrong password" from "no such
  account" — this is narrower than a full anti-enumeration guarantee for the
  system as a whole. Two residual channels are not closed by this Goal:
  registration's duplicate-email disclosure (a different feature's
  behavior, genuinely outside this PRD's reach) and login's own
  comparison-timing difference (this feature's own code — see Current
  Behavior, `auth.service.ts:70-77` — closeable unilaterally, not closed
  here, and tracked as Q-005 rather than asserted away).

## Non Goals

- Two-factor (TOTP) verification itself — covered by `PRD-TwoFactorAuth`.
  This PRD covers only that login detects 2FA is enabled and defers to it.
- Session expiry, revocation, and logout — covered by `PRD-SessionManagement`.
- Password reset — covered by `PRD-PasswordReset`.
- Account creation — covered by `PRD-Registration`.
- Social/SSO login — no such capability exists.
- Rate limiting / brute-force protection design — flagged as a gap, not
  designed here (see Q-002).

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account Holder | Human | An existing, registered user signing in |
| Session Service | System | Creates the session record backing the issued token |

## User Stories

- US-001: As an account holder, I want to sign in with my email and
  password, so that I can access my sandbox account.
- US-002: As an account holder, I want a generic rejection when my
  credentials are wrong, so that login's own response does not, by itself,
  confirm whether an email is registered (see Q-005 for channels outside
  login's control that may still leak this).
- US-003: As an account holder with 2FA enabled, I want login to stop short
  of granting access until I've verified my second factor, so that a leaked
  password alone cannot compromise my account.

## Functional Requirements

### FR-001: Authenticate with email and password

- **Description:** The system must let an account holder authenticate by
  supplying the email and password associated with an existing account.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a registered email and its correct password, when the account
    holder submits login, then a session and access token are issued (unless
    2FA applies — see FR-003).
  - Given an email that does not match any account, or a password that does
    not match the account's password, when login is submitted, then the
    request is rejected with the same status code and message body in both
    cases (see FC-001 for the boundary of this guarantee).
- **Governed by:** BR-001
- **Related:** US-001, US-002, G-001, G-002

### FR-002: Case-insensitive email lookup

- **Description:** The system must match the submitted email against a
  registered account regardless of letter casing.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an account registered with a lowercase email, when the account
    holder submits the same email in a different casing with the correct
    password, then login succeeds.
- **Governed by:** BR-002
- **Related:** US-001
- **Failure analysis:** No dedicated FC — a casing mismatch is not
  distinguishable from a wrong email once the request reaches credential
  comparison, so its only observable failure mode is already covered by
  FC-001.

### FR-003: Defer session issuance when 2FA is enabled

- **Description:** The system must not issue a full session/access token
  directly from login when the authenticating account has 2FA enabled;
  instead it must hand off to the 2FA verification step defined by
  `PRD-TwoFactorAuth`.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given valid credentials for an account with 2FA enabled, when login is
    submitted, then no `user_sessions` record is created, and the token
    returned in the response grants no access to any authenticated endpoint
    on its own (it is accepted only by the 2FA verification step).
  - Given valid credentials for an account without 2FA enabled, when login
    is submitted, then a `user_sessions` record is created and the returned
    token grants access to authenticated endpoints directly.
- **Governed by:** C-002
- **Related:** US-003
- **Failure analysis:** No dedicated FC — invalid credentials on the 2FA
  path are already covered by FC-001 before this branch is reached, and
  temporary-token expiry/misuse is `PRD-TwoFactorAuth`'s failure surface to define.

## Failure Conditions

### FC-001: Invalid credentials (wrong email, wrong password, or both)

- **Applies to:** FR-001
- **Condition:** The submitted email does not match any account, or matches
  an account but the password is incorrect.
- **Expected behavior:** Login is refused with a generic, identical status
  code and message body in both cases; no session or token is issued. This
  covers only login's own response — it does not extend to other channels
  that may reveal account existence outside this endpoint (comparison
  timing, or a different endpoint such as registration's duplicate-email
  check); those are recorded as Q-005, not asserted closed here.

### FC-002: Invalid input (malformed email, password below minimum length)

- **Applies to:** FR-001
- **Condition:** The email fails format/length validation, or the password
  is shorter than the minimum.
- **Expected behavior:** Login is refused with field-specific feedback
  before any credential check runs; no session or token is issued.

### FC-003: Repeated failed login attempts against the same account or from the same origin

- **Applies to:** (system-level)
- **Condition:** An unbounded number of login attempts are made against one
  or more *existing* accounts. Attempts against non-existent emails do not
  reach the bcrypt comparison (see Current Behavior, `auth.service.ts:70-77`) and so do not
  themselves drive this risk — the CPU-amplification exposure requires the
  attacker to already know or guess a real, registered email.
- **Expected behavior:** Not currently defined by the product — no
  detection, throttling, or lockout exists today (see Q-002). Recorded here
  as an unasked question rather than an omission, covering both the
  credential-guessing risk and the availability/CPU-amplification risk of
  unthrottled bcrypt comparisons on a single-node deployment.

### FC-004: Session record cannot be created after credentials are validated

- **Applies to:** FR-001
- **Condition:** Credentials are valid (the direct, non-2FA path), but the
  subsequent `SessionsService.createSession()` call fails (e.g. database
  error) after the JWT has already been signed. This does not apply to
  FR-003's 2FA branch — that branch never calls `createSession()` at login
  time; the equivalent failure surface on the 2FA path belongs to
  `PRD-TwoFactorAuth`, whose own verification step is where session
  creation actually happens for that branch.
- **Expected behavior:** Not currently defined by the product — current
  implementation (`issueTokenAndSession`, `auth.service.ts:440-455`) signs
  the token before creating the session record, so a failure here would
  surface as an unhandled error after credentials were already accepted.
  Whether closing this gap (e.g. so no token is ever returned without a
  corresponding session record) is `PRD-Login`'s or
  `PRD-SessionManagement`'s responsibility, and whether closing it at all
  is warranted versus accepting the current narrow-window risk, is
  unresolved — recorded as Q-006, not pre-decided here.

## Non Functional Requirements

None measurable at this time — see Open Questions (Q-001, Q-002). No
throughput, latency, or lockout threshold for login has been established.

## Business Rules

### BR-001: An account is only accessible with its own password

- **Rule:** Authentication succeeds only when the submitted password
  matches the hash stored for the account identified by the submitted
  email.
- **Rationale:** Password is the credential Registration establishes for
  the account (`PRD-Registration`, BR-001); login is the enforcement point
  for that same credential.

### BR-002: Email identifies an account case-insensitively

- **Rule:** Email comparison for authentication ignores letter case.
- **Rationale:** Shared with Registration's BR-002 — email is the single
  account lookup key across every flow that needs to find an account by
  email; a casing mismatch between registration and login would lock a
  legitimate holder out of their own account.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| Login credential check (email, password) | this feature (reads `users`, does not create) | N/A — not persisted beyond the request | PII / regulated (credential) |
| Session record (`user_sessions`) created on successful login | shared with `PRD-SessionManagement` (Session Management) | Per session lifecycle rules owned by `PRD-SessionManagement` | Internal |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Session Service | outbound | Create the session record backing an issued access token | intended to be blocking, but current implementation does not fully guarantee it — see FC-004, Q-006 |
| Two-Factor Service | outbound | Determine whether the authenticating account has 2FA enabled, to decide FR-003's branch | blocking for that decision |

## Constraints

- C-001: Login must reuse the same session/token issuance mechanism as
  Registration and Impersonation (`issueTokenAndSession`) rather than a
  parallel path, per current implementation — divergence would let the two
  flows' session semantics drift apart silently.
- C-002: The temporary 2FA token issued by FR-003 must not be accepted by
  any authenticated endpoint on its own. Current implementation relies on
  every protected route pairing `JwtAuthGuard` with `SessionGuard` — the
  temp token has no backing session row, so `SessionGuard` is what actually
  blocks it, since `JwtAuthGuard` alone would accept it (same signing
  secret, no `temp2fa` check in `JwtStrategy.validate()`). This is currently
  a coding convention, not an enforced invariant; `PRD-TwoFactorAuth`
  inherits this coupling as a given. Tracked as `IF-001` in
  `docs/features/login/FINDINGS.md`.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-002 | The 7-day JWT expiry and its interaction with session validity is Session Management's (`PRD-SessionManagement`) concern to define precisely, not Login's | If Login itself owns token lifetime policy, FR-001's scope would need to expand | |
| A-003 | Login's `MinLength(6)` password validation is only meant to reject obviously-malformed input, not to re-enforce a password *policy* — we assume the effective policy (if any beyond minimum length) is never enforced more strictly at login than it was at account creation | If registration's password policy tightens later without a grandfather rule, existing accounts could be locked out by FC-002 before FC-001 (credential check) ever runs | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Is there a target for login latency or availability, given this is a training sandbox rather than a production trading system? | NFR (none currently defined) | | open |
| Q-002 | Should login attempts be rate-limited or accounts temporarily locked after repeated failures? No such mechanism exists today. Covers both the credential-guessing risk and the availability/CPU-amplification risk of unthrottled bcrypt comparisons. **Coupled to Q-005:** the standard fix for Q-005's timing leak (comparing against a dummy hash on every not-found lookup) would make *every* login attempt pay the full bcrypt cost, including ones targeting non-existent emails — converting today's bounded amplification (an attacker must already know a real email to trigger it) into unbounded. These two questions must be answered jointly, not independently. | FC-003, NFR (none currently defined) | | open |
| Q-003 | Is there an intended maximum password length, or does login silently accept (and bcrypt silently truncate) arbitrarily long input, mirroring the same open question raised for Registration (`PRD-Registration` Q-007)? | FR-001 | | open |
| Q-004 | Was `/login` ever intended to become a real, standalone sign-in page, or is the current redirect-to-`/` behavior the intended end state? (Corrected from an earlier draft of this PRD that mistakenly described `/login` as rendering its own form.) | Overview, Current Behavior | | open |
| Q-005 | Is application-wide anti-enumeration (no endpoint, timing included, reveals whether an email is registered) an actual product commitment? This question supersedes the removed Assumption A-001, which had asserted anti-enumeration was already an established product commitment — it is not: registration's explicit "Email already registered" disclosure (`PRD-Registration` FC-001/Q-004, `ADR-0008`) contradicts it, and so does login's own comparison-timing difference (bcrypt only runs when the account exists). The timing half is this feature's own code and closeable unilaterally if desired; the registration-disclosure half is a cross-feature decision Login alone cannot deliver. **Coupled to Q-002** — see that row. | G-002, US-002, FC-001 | | open |
| Q-006 | If session-record creation fails after credentials are validated on the direct (non-2FA) login path (FC-004), is closing that gap Login's responsibility, `PRD-SessionManagement`'s, or an accepted risk nobody needs to close? Current implementation signs the JWT before creating the session row, so a failure here surfaces as an unhandled error post-credential-check. | FC-004 | | open |

## Success Metrics

Not measured today. As with Registration, no signup/login-funnel metrics
(success rate, time-to-authenticate) are currently instrumented. Revisit
once Q-001/Q-002 are answered rather than picking a metric now to fill the
section.

## Architecture Impact

- Requirements likely to drive decisions: FR-003/C-002 (2FA temp-token
  scope currently enforced only by guard-pairing convention, not a stated
  invariant), FC-003 (rate limiting / lockout, currently undesigned), FC-004
  (session-creation failure after credential validation, currently
  unhandled)
- Suspected new components or boundaries: None — reuses the existing Auth
  module's session/token issuance path shared with Registration and
  Impersonation.
- Known architectural risk: No throttling or lockout exists on the login
  endpoint (FC-003); whether this is an accepted risk for a QA-training
  sandbox or a gap to close is an open product/architecture question, not
  resolved here. Separately, the 2FA temp-token bypass (C-002) and the
  session-issuance failure gap (FC-004) are both currently prevented (or
  left unhandled) by implementation convention rather than a designed
  guarantee — worth architecture's attention regardless of the rate-limiting
  decision.