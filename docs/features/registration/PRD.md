# User Registration

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Medium |
| Owner | |
| Last updated | 2026-07-25 |
| Slug | PRD-Registration |

## Overview

User Registration lets a new visitor create a CryptoSandboxQA account with an
email and password, and be signed in immediately afterward. It is the
self-service entry point into the sandbox for QA trainees.

## Current Behavior

- Frontend: `/register` page collects email, password, and an optional
  display name, and posts to the backend.
- Backend: `POST /auth/register` (unauthenticated) accepts email, password,
  and optional display name via `RegisterDto`.
- Email is normalized to lowercase before the uniqueness check and before
  storage; the check and storage both operate on the lowercased value.
- If the email is already registered, the request is rejected and no user
  is created.
- On success, a `users` row is created (`user_profiles` is not created by
  this endpoint — see "Related feature" below), a welcome email is sent via
  `MailService` (logged to the backend terminal if `SMTP_HOST` is unset), a
  JWT access token is issued, and a session record is created — the new
  user is signed in immediately, without a separate login step.
- Welcome email delivery failure does not fail the registration request; it
  is logged and swallowed.
- Password is hashed before storage; the plaintext password is never
  persisted or returned.
- Field limits are enforced identically on frontend (`frontend/lib/authFieldConstraints.ts`)
  and backend (`RegisterDto`): email ≤ 254 chars, password ≥ 6 chars, optional
  display name ≤ 100 chars.

## Related feature

`POST /auth/register-with-profile` extends this same account-creation path
with optional `user_profiles` fields (username, bio, avatar, etc.) collected
in the same request. It is tracked as its own feature — see
`PRD-UserProfileExtended` (backlog #10) — and is not duplicated here.

## Problem Statement

A new visitor has no way to access the sandbox's trading, wallet, and admin
training features without first proving ownership of a unique email/password
credential pair and having an account record created for them.

## Goals

- G-001: A new visitor can create a usable, authenticated account without
  admin intervention.
- G-002: Every account is uniquely identified by a single email address.

## Non Goals

- Email address ownership verification (no confirmation link/flow exists).
- Third-party/social sign-up (Google, GitHub, etc.).
- Collecting profile fields (username, bio, avatar) — see `PRD-UserProfileExtended`.
- Terms-of-service or consent capture.
- Admin-driven account provisioning (API-key bootstrap admin creation,
  bulk import) — separate endpoints, separate guards, and (per code
  inspection) different duplicate-email response semantics; tracked as
  backlog #8 and #11.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Visitor | Human | Unauthenticated person creating a new account |
| Mail Service | System | Sends the welcome notification after account creation |

## User Stories

- US-001: As a visitor, I want to register with my email and password, so
  that I can access my own sandbox account.
- US-002: As a visitor, I want to be signed in immediately after
  registering, so that I don't have to log in a second time.
- US-003: As a visitor, I want a clear rejection if my email is already
  registered, so that I don't create a duplicate or confused account.

## Functional Requirements

### FR-001: Account creation with email and password

- **Description:** The system must let a visitor create an account by
  supplying an email and a password, with an optional display name.
- **Actor:** Visitor
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid, unused email and a password meeting the minimum length,
    when the visitor submits registration, then a new account is created.
  - Given no display name is supplied, when registration succeeds, then the
    account is created without one (it is optional).
- **Governed by:** BR-001
- **Related:** US-001, G-001

### FR-002: Reject duplicate email registration

- **Description:** The system must refuse to create a second account for an
  email address that is already registered, regardless of letter casing.
- **Actor:** Visitor
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an email already associated with an account, when a visitor
    attempts to register with that email (in any casing), then no new
    account is created and the visitor is informed the email is taken.
  - Given two registration attempts for the same email submitted
    concurrently, when both are processed, then the loser is told the email
    is taken — the same outcome as a sequential duplicate attempt, not an
    unrelated error.
- **Governed by:** BR-002
- **Related:** US-003, G-002

### FR-003: Immediate authentication on success

- **Description:** The system must sign the visitor in as part of a
  successful registration, without requiring a separate login step.
- **Actor:** Visitor
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a successful registration, when the response is returned, then it
    includes credentials sufficient to access authenticated endpoints.
- **Related:** US-002
- **Failure analysis:** No dedicated FC — token/session issuance shares the
  same underlying session-creation mechanism as Login, and that mechanism's
  failure modes belong to Login (`PRD-Login`, not yet produced) to define,
  not to Registration.

### FR-004: Trigger a welcome notification

- **Description:** The system must trigger a welcome notification to the new
  user when their account is created. Notification content, delivery
  guarantees, and retry behavior are owned by backlog #43 (Welcome Email —
  Registration, `PRD-043`, not yet produced); this requirement covers only
  that registration is the trigger and that the trigger's own success or
  failure cannot change registration's outcome.
- **Actor:** Mail Service
- **Priority:** Should
- **Acceptance Criteria:**
  - Given a successful registration, when the account is created, then a
    welcome-notification trigger fires.
  - Given the welcome-notification trigger fails, when this occurs, then
    registration still succeeds.

## Failure Conditions

### FC-001: Email already registered

- **Applies to:** FR-002
- **Condition:** The submitted email already belongs to an existing account,
  including the case where a concurrent registration for the same email is
  in flight (a race, not just a pre-existing row).
- **Expected behavior:** Registration is refused; no account is created or
  modified; the visitor is told the email is already in use. This outcome
  must be indistinguishable to the visitor from a sequential duplicate
  attempt — not a generic server error. *How* concurrent attempts are
  serialized is an architectural decision (see Architecture Impact); *what
  the visitor sees* is not.

### FC-002: Invalid input (email format, password length, display name length)

- **Applies to:** FR-001
- **Condition:** Email is malformed or exceeds the length limit, password is
  shorter than the minimum, or display name exceeds the length limit.
- **Expected behavior:** Registration is refused with field-specific
  feedback; no account is created.

### FC-003: Welcome notification cannot be delivered, or does not complete promptly

- **Applies to:** FR-004
- **Condition:** The mail transport is unavailable, delivery fails, or the
  welcome-notification trigger does not complete within an acceptable time
  (current implementation triggers it synchronously on the registration
  path, ahead of the response — see Q-005).
- **Expected behavior:** The failure or delay is recorded (not silently
  discarded) and does not block or roll back the already-successful account
  creation, and does not hold the registration response open indefinitely.

## Non Functional Requirements

None measurable at this time — see Open Questions (Q-001, Q-002). No
performance, availability, or throughput target for registration has been
established.

## Business Rules

### BR-001: Every account requires a password

- **Rule:** An account cannot be created without a password credential.
- **Rationale:** Password is the only credential this feature supports for
  authenticating the account afterward.

### BR-002: Email uniquely identifies an account, case-insensitively

- **Rule:** No two accounts may share the same email address, comparing
  without regard to letter case.
- **Rationale:** Email is the sole account lookup key across login,
  password reset, and admin lookup flows; ambiguity here breaks all of them.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| User (email, password credential, display name) | this feature | Lifetime of the account | PII / regulated (credential) |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Mail Service | outbound | Trigger welcome notification | blocking today — the trigger is awaited synchronously on the registration response path before the response is returned (current implementation); no timeout is currently bounded (see Q-005) |

## Constraints

- C-001: This feature only creates the `users` table row; it must not
  create a `user_profiles` row — that is `PRD-UserProfileExtended`'s
  responsibility. (Note: `GLOSSARY.md` defines the domain term "User" as
  the combination of `users` + `user_profiles`; this constraint is scoped
  to the underlying table, not the domain term, to avoid overloading it.)

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | Registration is expected to remain open/unauthenticated (no invite code or admin approval gate) | Would require an additional gating requirement and actor | |
| A-002 | Immediate sign-in after registration is intentional product behavior, not an implementation shortcut | If unintentional, FR-003 would need to be retired and a separate login step required | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Is any password complexity rule required beyond the minimum length (e.g. must contain a digit/symbol)? | FR-001, BR-001 | | open |
| Q-002 | Should registration be rate-limited or otherwise protected against automated account creation? | NFR (none currently defined) | | open |
| Q-003 | Is email ownership verification (confirmation link) intentionally out of scope, or a gap to close later? | Non Goals | | open |
| Q-004 | Current shipped behavior explicitly confirms account existence on duplicate email (401 "Email already registered") — the opposite choice made for password reset's anti-enumeration design. Is this an accepted inconsistency for registration, or should it change to match? This is a keep-or-change decision on live behavior, not a greenfield one. **Partially addressed by `ADR-0008`**, which unifies the response mechanism app-wide but leaves the final status code/wording as an implementation choice within that ADR's Decision — still open. | US-003, FR-002, FC-001 | | open |
| Q-005 | The welcome-notification trigger currently runs synchronously on the registration response path with no bounded timeout. Is there a maximum acceptable registration response time, and should the trigger be moved off that path to guarantee it? **Addressed by `ADR-0009`** (bounded timeout, stays synchronous; queue-based decoupling explicitly rejected as disproportionate for now). | FR-004, FC-003, Integration Requirements | | answered — see ADR-0009 |
| Q-006 | Should a newly registered account be provisioned with starting training balances, or is funding a separate, deliberate first task the trainee takes after registering? G-001 calls the resulting account "usable" — this determines whether that word is accurate. | G-001 | | open |
| Q-007 | Is there a maximum password length, and what should happen beyond it? (Current hashing silently ignores input past 72 bytes; no upper bound is enforced or documented anywhere in the stack today.) | FR-001, BR-001, FC-002 | | open |
| Q-008 | Can a registered account ever be deleted or its email reused, or is `users.email` permanently consumed once registered? Relevant given the sandbox's training use case likely creates disposable/repeated test accounts. | BR-002, Data Requirements | | open |

## Success Metrics

Not measured today, and deliberately not filled with conventional
signup-funnel metrics (completion rate, drop-off) — this is a QA-training
sandbox, not a product with an acquisition funnel to optimize. Nothing
currently instruments the outcomes that would actually indicate success
here (e.g. a trainee reaching an authenticated, usable dashboard unaided; or
accounts being reliably re-creatable across repeated test runs — see
Q-006, Q-008). Revisit once those questions are answered rather than
picking a metric now to fill the section.

## Architecture Impact

- Requirements likely to drive decisions: FR-002 (uniqueness enforcement),
  FR-003 (session/token issuance coupling to registration)
- Suspected new components or boundaries: None — reuses existing Auth
  module session/token issuance path shared with Login (`PRD-Login`, not yet
  produced).
- Known architectural risk: Duplicate-email check and account creation are
  not currently atomic (read-then-write, no transaction, no unique-constraint
  violation handling observed in the codebase). FC-001 now requires that a
  concurrent duplicate produce the same visitor-facing outcome as a
  sequential one regardless of mechanism — closing that gap (e.g. via
  transaction, constraint-violation handling, or optimistic locking) is
  architecture's decision to make. **Resolved:** see `ADR-0008`.
- **Resolved:** the mail-on-response-path risk noted under Q-005 — see
  `ADR-0009`.
