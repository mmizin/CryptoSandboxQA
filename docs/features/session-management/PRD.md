# Session Management

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Low |
| Owner | |
| Last updated | 2026-07-26 |
| Slug | PRD-SessionManagement |

## Overview

Session Management is the server-side record that backs the JWT access
tokens issued by Login, 2FA verification, Registration, Admin Bootstrap,
Impersonation, and Ending Impersonation. It makes a token revocable before
its signed expiry — logout,
password reset, or an administrative action can invalidate access
immediately by deleting the backing record, something an unrevoked JWT alone
could never do. One access-granting token type, the impersonation
`backToAdminToken`, is issued outside this model entirely and is not
revocable by any mechanism this feature defines — see G-001, FC-005.

## Current Behavior

- A session is a row in `user_sessions` (`userId`, `tokenHash` — SHA-256 hash
  of the issued JWT, `expiresAt`, `createdAt`, optional `userAgent` /
  `ipAddress`). The JWT itself is never stored — only its hash
  (`SessionsService.hashToken()`, `sessions.service.ts`).
- A session row is created by `SessionsService.createSession()` at two
  physical call sites: inside `AuthService.issueTokenAndSession()`
  (`auth.service.ts:448`) and inside `AuthService.impersonate()`
  (`auth.service.ts:482`). `issueTokenAndSession()` is itself called from six
  flows: direct login (`login`, `:105`), 2FA-verified login (`verify2Fa`,
  `:212`), registration (`register`, `:223`), admin bootstrap
  (`createAdmin`, `:242` — `POST /auth/admin/register`, gated only by a
  shared `ADMIN_API_KEY` header rather than user credentials — see also
  ending impersonation, below, which is gated only by a bearer
  `backToAdminToken` and no route guards at all, FC-004), registration-with-profile
  (`registerWithProfile`, `:287`), and ending impersonation
  (`endImpersonation`, `:517`). Every one of these six flows creates a
  session row — session creation is not specific to authentication
  ("logging in") in the narrow sense; it happens whenever any flow issues an
  ongoing-access token, including account creation. `expiresAt` is set to 7
  days from creation at both physical call sites — the same interval as the
  JWT's own `expiresIn` (`JWT_EXPIRY = '7d'`, `auth.service.ts:53`), computed
  independently rather than derived from the token, and drifting by up to an
  hour across a DST transition since the session side uses local-calendar
  `setDate()` arithmetic while the JWT side is an exact 604800-second offset
  — see C-002.
- A **different** endpoint, `POST /auth/admin/create-user`
  (`createUserAsAdmin`, `auth.controller.ts:121-150`), creates a user with
  profile as an admin action but explicitly does **not** call
  `issueTokenAndSession()` and creates no session — its own API
  documentation states "Does not create a session for the new user". It is
  out of this PRD's scope for that reason (no token, nothing to revoke); do
  not conflate it with admin bootstrap (`createAdmin`) above. The same
  applies to bulk user import, which uses the same no-session path.
- Registration's own session creation is `PRD-Registration`'s to describe
  from the requesting side (it already does, at
  `docs/features/registration/PRD.md:32`); this PRD's Integration
  Requirements table lists Registration and Admin Bootstrap as inbound
  callers of FR-001 for that reason, without duplicating their own flows.
- `SessionGuard` (`session.guard.ts`) is the enforcement point: on every
  request to a route it protects, it re-hashes the bearer token and checks a
  matching `user_sessions` row exists with `expiresAt` in the future. No
  match → 401 ("Session expired or invalid. Please log in again."),
  regardless of whether the JWT signature itself is still valid.
- `SessionGuard` is applied alongside `JwtAuthGuard` (`jwt-auth.guard.ts`,
  Passport JWT strategy) on protected routes. `JwtAuthGuard` alone verifies
  only the JWT signature and expiry claim; it does not consult
  `user_sessions`. Revocation (logout, password reset) works only because
  `SessionGuard` is paired with it — a route with `JwtAuthGuard` but no
  `SessionGuard` would keep accepting a token whose session was deleted,
  until the JWT's own signed expiry passed. `PRD-Login` (`C-002`) records this
  same guard-pairing dependency for the 2FA temp-token boundary; here it is
  the general revocation mechanism.
- `POST /auth/logout` (guarded by `JwtAuthGuard` + `SessionGuard`) deletes the
  session row matching the presented token via
  `SessionsService.deleteSessionByToken()` (`auth.controller.ts:234-245`).
  After deletion, the same token is rejected by `SessionGuard` on the next
  request (401), even though the JWT itself has not expired. **This endpoint
  is not called by the shipped frontend.** `frontend/lib/api.ts:143` defines
  `authApi.logout()` against it, but nothing in `frontend/` invokes that
  function — a repo-wide search finds only its own definition. The UI's
  logout action (`frontend/lib/useAuth.ts:61-67`) clears `token` and
  `back_to_admin` from `localStorage` and navigates to `/`; it makes no
  network request. The `user_sessions` row backing that token is therefore
  never deleted by a user-initiated logout through the UI — it remains
  valid, and would still authenticate the same token if replayed (e.g.
  extracted from browser storage before it was cleared), until its 7-day
  `expiresAt` or an unrelated password reset. FR-003 and G-002 describe
  what the backend endpoint does in isolation; they do not currently hold
  for the product's only user-facing logout path. See FC-007, Q-011. This
  is a further, third discrepancy with `FEATURES_INVENTORY.md` (`:200`,
  `:202`), which describes logout as removing the session row without
  qualification — not folded into Q-001 since it concerns behavior, not a
  schema/audit claim, but recorded as its own question (Q-011).
- `SessionsService.deleteAllUserSessions(userId)` deletes every session row
  for a user. It is called once in the current codebase: at the end of a
  successful password reset (`auth.service.ts:179`), invalidating every
  outstanding session for that account when the password changes. No
  "log out of all other devices" user-triggered endpoint was found.
- No limit on concurrent sessions per user was found. Each successful login
  or impersonation call inserts a new row; an existing session for the same
  user is never looked up or replaced. A user (or an admin impersonating
  them) can accumulate any number of valid session rows simultaneously.
- **Discrepancy with `FEATURES_INVENTORY.md`:** the inventory entry lists
  `impersonated_by` as a `user_sessions` column. The Prisma schema
  (`schema.prisma:78-90`) has no such column — `impersonatedBy` exists only
  as a claim inside the signed JWT payload (`auth.service.ts:474`,
  `jwt.strategy.ts:27-29`), attached to the authenticated request object at
  validation time, not persisted to the session row. See Q-001; this PRD
  describes the schema as observed in code, not as stated in the inventory.
- No scheduled or on-access cleanup of expired-but-undeleted `user_sessions`
  rows was found; `expiresAt` is checked at read time by `SessionGuard`
  (`gt: new Date()`), so an expired row simply stops matching rather than
  being removed. Rows accumulate indefinitely otherwise (see Q-002).
- `user_sessions.tokenHash` has no index (`schema.prisma:78-90`) — unlike the
  neighbouring `UserPasswordReset.userId`, which is indexed
  (`schema.prisma:102`). `SessionGuard` performs a `findFirst` on
  `tokenHash` on every request to every route it protects, so this is not
  only a storage-growth concern (FC-003) but a per-request lookup cost that
  degrades as the table grows, with no cap or cleanup bounding that growth.
- Ending impersonation (`AuthService.endImpersonation()`, `:497-518`)
  verifies the `backToAdminToken`, then calls `issueTokenAndSession(admin)`
  to mint a new admin session — it does **not** delete the target user's
  session created when impersonation started (`:482`). That session remains
  valid for its full 7-day `expiresAt` after impersonation has "ended".
  Separately, `POST /auth/end-impersonation` carries no route guards at all
  (`auth.controller.ts:226-232` — no `@UseGuards`), so it re-mints a fully
  privileged admin session from the `backToAdminToken` alone, bypassing
  `SessionGuard` entirely for that request. This is a session-lifecycle gap
  this feature owns (not `PRD-Impersonation`'s, which covers starting
  impersonation and admin authorization) — see FR-005, Q-006.

## Problem Statement

A signed JWT is valid for its full lifetime regardless of what happens after
it is issued — there is no way to make an already-issued token stop working
before it expires. Login, Registration, Admin Bootstrap, Impersonation,
Ending Impersonation, and 2FA verification all need a way to grant access
that can later be revoked
(on logout, on password change, or administratively) without waiting out the
token's signed expiry. One exception exists today: the impersonation
`backToAdminToken` grants access (a fresh admin session) on redemption but
has no backing record of its own, so it cannot be revoked by any mechanism
this feature provides — see G-001, FC-005.

## Goals

- G-001: Every **session-backed** access token — issued by Login, 2FA
  verification, Registration, Admin Bootstrap, or Impersonation — can be
  revoked before its signed expiry by deleting its backing session record.
  This explicitly excludes the impersonation `backToAdminToken`, which is
  not session-backed and is not revocable by this feature today (FC-005);
  whether it should be is Q-008, not asserted here.
- G-002: Logging out immediately invalidates the token used to log out, for
  every subsequent request, without requiring the token's signed expiry to
  pass. **This goal is met by the backend endpoint (`POST /auth/logout`,
  FR-003) in isolation but is not currently realized end-to-end**: the
  shipped frontend's logout action never calls that endpoint (see Current
  Behavior, FC-007, Q-011) — today, logging out through the product's own
  UI does not, by itself, revoke the session.
- G-003: Changing an account's password invalidates every outstanding
  **session-backed** token for that account, so a token issued under the old
  password stops granting access. This guarantee does not currently extend
  to an outstanding `backToAdminToken` — see FC-005 — nor is it guaranteed
  atomic with the password change itself — see FC-006.

## Non Goals

- Issuing tokens or performing credential checks — covered by `PRD-Login`,
  `PRD-TwoFactorAuth` (not yet produced).
- Admin authorization to impersonate, the impersonation UI/UX, and
  `backToAdminToken`'s issuance policy (why it exists, its 1-hour lifetime)
  — covered by `PRD-Impersonation` (not yet produced). **In scope for this
  PRD, and not deferred to `PRD-Impersonation`:** session creation on both
  starting and ending impersonation (FR-001), revocation of the
  impersonated session when impersonation ends (FR-005 — ownership between
  this PRD and `PRD-Impersonation` is itself open, see Q-006), and
  `backToAdminToken`'s absence from the revocation model (FC-005).
- A user-facing "log out of all devices" or "view active sessions" feature —
  no such UI or endpoint was found (see Q-003).
- Rate limiting or brute-force protection on any auth endpoint — covered by
  `PRD-Login` (Q-002 there).

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account Holder | Human | A user whose session is created by Login, 2FA verification, or Registration, and consulted on every subsequent authenticated request |
| Admin | Human | An admin whose impersonation action creates a session for the target user; also the actor behind Admin Bootstrap and end-impersonation |
| Session Service | System | `SessionsService` / `issueTokenAndSession()` — creates the session record backing an issued token (FR-001) and deletes session records on logout (FR-003) and password-change (FR-004); does **not** currently delete the impersonated session on end-impersonation (FR-005 — not implemented, see FC-004) |
| Session Guard | System | Consults `user_sessions` on every protected request to decide whether the presented token still grants access |

## User Stories

- US-001: As an account holder, I want my access to stop working the moment I
  log out, so that a token I no longer control (e.g. on a shared device)
  can't keep being used after I've signed out. **Not currently satisfied
  end-to-end** — see G-002, FC-007.
- US-002: As an account holder, I want changing my password to invalidate any
  sessions issued before the change, so that a token obtained under my old
  password can't outlive the password itself.
- US-003: As the system, I need every issued **session-backed** access
  token to have a corresponding revocable record, so that no
  session-backed authentication flow can grant access that persists beyond
  its intended lifetime with no way to cut it off. This excludes
  `backToAdminToken`, which is not session-backed by design today — see
  G-001, FC-005, Q-008.

## Functional Requirements

### FR-001: Create a session record when an access token is issued

- **Description:** The system must create a `user_sessions` record whenever
  any flow issues a session-backed access token meant to grant ongoing
  access — direct login, 2FA-verified login, registration (with or without
  profile), admin bootstrap (`POST /auth/admin/register`), impersonation
  (start), or ending impersonation. This explicitly excludes: `POST
  /auth/admin/create-user` and bulk user import, which create a user but
  deliberately issue no access token and so have nothing for this
  requirement to cover; and `backToAdminToken`, which is issued by
  impersonation but is not session-backed by design today (see FC-005,
  Q-008) and so is out of this requirement's scope, not an unmet instance
  of it.
- **Actor:** Session Service (system, triggered by Login/Registration/Admin
  Bootstrap/Impersonation)
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a successful direct login (no 2FA) or a successful 2FA
    verification, when the access token is issued, then a `user_sessions`
    record is created associating that token with the authenticating user.
  - Given a successful registration (`PRD-Registration`, with or without
    profile) or a successful admin bootstrap, when the resulting access
    token is issued, then a `user_sessions` record is created for the new
    user, associated with that token.
  - Given a successful impersonation request, when the target user's access
    token is issued, then a `user_sessions` record is created for the target
    user, associated with that token.
  - Given a successful end-impersonation request (redemption of a valid
    `backToAdminToken`), when the restored admin's access token is issued,
    then a `user_sessions` record is created for the admin, associated with
    that token. (This criterion covers only the admin session created on
    return — it does not require the impersonated session to be revoked;
    that is FR-005's requirement, not this one's.)
- **Related:** US-003, G-001

### FR-005: Invalidate the impersonated session when impersonation ends

- **Description:** The system must delete the session record backing the
  impersonated user's token when an admin ends impersonation, so that token
  is rejected by FR-002 on any subsequent request rather than remaining
  valid until its natural expiry.
- **Actor:** Admin
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an active impersonation session, when the admin ends impersonation
    via `POST /auth/end-impersonation`, then the impersonated user's session
    record is deleted and that token is rejected (401) on the next request
    to any route enforcing FR-002.
- **Related:** G-001
- **Not currently implementable as specified — blocked, not merely
  unbuilt:** `POST /auth/end-impersonation` receives only the
  `backToAdminToken`, whose payload (`{ sub: adminId, purpose:
  'back_to_admin' }`, `auth.service.ts:484`) carries no reference to the
  impersonated user, the impersonation session, or the impersonated token —
  and the frontend sends no `Authorization` header on this call
  (`frontend/lib/useAuth.ts:104-108`), so the impersonated token isn't
  available server-side to hash and look up either. Closing this requires
  one of: (a) persisting impersonation linkage on the session row — the
  same `impersonated_by` field Q-001 leaves unresolved — (b) embedding the
  impersonation session's id in the `backToAdminToken` payload, or (c)
  changing the end-impersonation request to carry the impersonated token.
  **FR-005 is therefore gated on Q-001/Q-006**, not a same-effort peer of
  FR-001–FR-004; recorded as Must because an unrevoked impersonation session
  is this feature's own guarantee failing (same defect class as a token
  surviving logout), not because it is equally close to done.
- **Failure analysis:** Not currently implemented — see Current Behavior,
  Q-001, Q-006.

### FR-002: Validate that a presented token has a live session

- **Description:** The system must reject requests to protected routes when
  the presented token has no matching, unexpired `user_sessions` record —
  independently of whether the token's own signature and claimed expiry are
  still valid.
- **Actor:** Session Guard
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a token with no matching session record (deleted or never
    created), when a protected route is requested, then the request is
    rejected with 401.
  - Given a token with a matching session record whose `expiresAt` has
    passed, when a protected route is requested, then the request is
    rejected with 401.
  - Given a token with a matching, unexpired session record, when a
    protected route is requested, then the request is allowed to proceed to
    its next authorization check.
- **Governed by:** BR-001
- **Related:** US-001, G-001

### FR-003: Invalidate the current session on logout

- **Description:** The system must delete the session record backing the
  token used to call logout, so that token is rejected by FR-002 on any
  subsequent request.
- **Actor:** Account Holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid, currently-authenticated token, when the account holder
    calls logout with it, then the matching `user_sessions` record is
    deleted and the same token is rejected (401) on the next request to any
    route enforcing FR-002.
- **Related:** US-001, G-002
- **Failure analysis:** See FC-006 (the current implementation discards
  `deleteSessionByToken()`'s boolean result and always responds `{ success:
  true }`, `auth.controller.ts:239-245`, so a failed deletion is
  indistinguishable from a successful one to the caller) and FC-007 (this
  requirement's backend behavior is correct in isolation, but the shipped
  frontend never triggers it — see Current Behavior, G-002, Q-011).

### FR-004: Invalidate all sessions on password change

- **Description:** The system must delete every `user_sessions` record
  belonging to an account when that account's password is successfully
  changed via password reset.
- **Actor:** Session Service (system, triggered by password reset)
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an account with one or more active sessions, when a password reset
    for that account completes successfully, then every session record for
    that account is deleted, and every token previously issued to that
    account is rejected (401) on its next use against FR-002.
- **Related:** US-002, G-003
- **Failure analysis:** See FC-005 (an outstanding `backToAdminToken` is
  unaffected by this requirement) and FC-006 (revocation can fail after the
  password change has already been committed, with no distinguishing
  response to the caller).

## Failure Conditions

### FC-001: Session record cannot be created after a token is signed

- **Applies to:** FR-001
- **Condition:** The access token has already been signed and returned to
  the caller (or is in the process of being returned), but the subsequent
  `user_sessions` insert fails (e.g. database error).
- **Expected behavior:** Not currently defined by the product — current
  implementation signs the token before creating the session row
  (`issueTokenAndSession`, `auth.service.ts:440-455`), so a failure here
  surfaces as an unhandled error after the token was already generated. This
  is the same gap `PRD-Login` records as FC-004/Q-006; recorded here as this
  PRD's own copy since session creation is this feature's responsibility, not
  Login's.

### FC-002: Session validation cannot complete (datastore unavailable)

- **Applies to:** FR-002
- **Condition:** `SessionGuard`'s lookup against `user_sessions` cannot
  complete (e.g. database unreachable).
- **Expected behavior:** Not currently defined by the product — no fallback
  or explicit error handling for this case was found in `SessionGuard`; a
  database failure would propagate as an unhandled error rather than a
  defined response. See Q-004.

### FC-003: Unbounded session accumulation for a single account

- **Applies to:** (system-level)
- **Condition:** No limit exists on concurrent sessions per user, and no
  cleanup of expired rows was found. An account that logs in repeatedly (or
  is repeatedly impersonated) accumulates `user_sessions` rows indefinitely.
  Because `tokenHash` is unindexed, this is not only a storage concern:
  `SessionGuard`'s per-request lookup (FR-002) gets more expensive as the
  table grows, on every authenticated request across the whole product, not
  just for the account accumulating rows.
- **Expected behavior:** Not currently defined by the product — neither a
  concurrent-session cap, an expired-row cleanup job, nor an index on
  `tokenHash` exists today. See Q-002, Q-005, Q-007.

### FC-004: Ending impersonation does not revoke the impersonated session, and the endpoint itself bypasses session validation

- **Applies to:** FR-005
- **Condition:** `POST /auth/end-impersonation` carries no route guards, so
  it is reachable by anyone holding a `backToAdminToken`, independent of
  `SessionGuard`; and its handler mints a new admin session without deleting
  the impersonated user's still-active session row.
- **Expected behavior:** Not currently defined by the product — current
  implementation neither revokes the impersonated session nor enforces
  session validation on the endpoint that ends impersonation. See Q-006.

### FC-005: `backToAdminToken` is an access-granting token with no revocable backing record

- **Applies to:** (system-level)
- **Condition:** `impersonate()` issues a `backToAdminToken`
  (`auth.service.ts:484-487`) alongside the impersonated user's session, but
  never calls `createSession()` for it — it has no `user_sessions` row.
  Redeeming it via `POST /auth/end-impersonation` mints a brand-new,
  fully-privileged admin session. Because it has no session record, none of
  FR-003 (logout), FR-004 (password-change revocation), or any other
  deletion-based mechanism this feature defines can revoke it before its own
  1-hour signed expiry.
- **Expected behavior:** Not currently defined by the product. Concretely:
  an admin who resets their password does not thereby invalidate an
  outstanding `backToAdminToken` from before the reset — within that
  token's 1-hour window, redeeming it still mints a fresh admin session,
  contradicting G-003's intent for that admin's account. Whether
  `backToAdminToken` should be brought into the session model (so it can be
  revoked like everything else) or is intentionally exempt because its
  window is short is Q-008, not resolved here.

### FC-006: Session revocation fails after the state change it was meant to accompany has already committed

- **Applies to:** FR-003, FR-004
- **Condition:** `resetPasswordWithCode()` commits the new password hash in
  a transaction, then calls `deleteAllUserSessions()` **outside and after**
  that transaction (`auth.service.ts:168-180`); if the deletion fails, the
  password has already changed but old sessions remain valid. The endpoint
  returns `{ success: true }` regardless
  (`auth.controller.ts:94-96`). Logout has the weaker version of the same
  gap: `deleteSessionByToken()`'s boolean result is discarded and the
  response is unconditionally `{ success: true }`
  (`auth.controller.ts:239-245`).
- **Expected behavior:** Not currently defined by the product — no failure
  path exists for either case; both report success to the caller regardless
  of whether the underlying deletion succeeded. See Q-009.

### FC-007: The product's own UI never invokes session revocation on logout

- **Applies to:** FR-003
- **Condition:** `POST /auth/logout` correctly deletes the session record
  when called, but the shipped frontend's logout action
  (`frontend/lib/useAuth.ts:61-67`) never calls it — it only clears
  client-side `localStorage` and navigates away. `frontend/lib/api.ts:143`
  defines `authApi.logout()` against the endpoint, but nothing in
  `frontend/` calls that function.
- **Expected behavior:** Not currently defined by the product. Concretely: a
  user who logs out through the UI has their session row survive the
  action; the same token, if retained or replayed by a third party (e.g.
  recovered from browser storage before the clear), continues to
  authenticate until its 7-day `expiresAt` or an unrelated password reset.
  Whether this is a defect to fix (wire `authApi.logout()` into the UI
  logout action) or an intentional gap for training purposes is unresolved
  — see Q-011. G-002 and US-001 are written for the mechanism this feature
  owns, not for whether the product's frontend invokes it end-to-end; that
  gap is recorded here rather than silently narrowing those Goals further.

## Non Functional Requirements

None measurable at this time — see Open Questions (Q-002, Q-005, Q-007). No
threshold exists today for session-validation latency, session-table growth,
or cleanup cadence.

## Business Rules

### BR-001: A token without a live session grants no access

- **Rule:** Possession of a validly-signed, unexpired JWT is not sufficient
  to access a route enforcing session validation; a matching, unexpired
  `user_sessions` record must also exist.
- **Rationale:** This is what makes revocation possible at all — a JWT alone
  cannot be invalidated before its signed expiry, so every guarantee this
  feature makes (logout, password-change invalidation) depends on access
  being gated on the session record, not the token signature alone.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| Session record (`user_sessions`: `userId`, `tokenHash`, `expiresAt`, `createdAt`, optional `userAgent`/`ipAddress`) | this feature | Indefinite by default — `expiresAt` is a read-time filter consulted by `SessionGuard`, not a deletion trigger; a row past its `expiresAt` is never removed unless logout or password reset deletes it first. See Q-005, Q-007. | Internal (`tokenHash` is a one-way hash, not the bearer token itself; `ipAddress`/`userAgent` when present are PII-adjacent, populated by neither `SessionsService.createSession()` call site today — see Q-010) |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Login | inbound | Calls session creation (FR-001) when issuing a direct or 2FA-verified access token | blocking (see FC-001) |
| Registration (`PRD-Registration`) | inbound | Calls session creation (FR-001) when issuing an access token on successful registration (with or without profile) | blocking (see FC-001) |
| Admin Bootstrap (`POST /auth/admin/register`, not yet documented) | inbound | Calls session creation (FR-001) when issuing an access token for a newly bootstrapped admin | blocking (see FC-001) |
| Impersonation (not yet documented) | inbound | Calls session creation (FR-001) when issuing a token for the impersonated target user; **intended** to call session invalidation (FR-005) when impersonation ends — **not implemented today**, see FC-004; issues the non-session-backed `backToAdminToken` outside this feature's model | blocking (see FC-001, FC-004); `backToAdminToken` itself is unrevocable — see FC-005 |
| Password Reset (not yet documented) | inbound | Triggers invalidation of all sessions for an account (FR-004) on successful password change | blocking |
| Every protected route (all authenticated features) | outbound | Consults session validity (FR-002) via `SessionGuard` before allowing the request to proceed | blocking |

## Constraints

- C-001: Session revocation depends on every protected route pairing
  `JwtAuthGuard` with `SessionGuard`. `JwtAuthGuard` alone accepts a
  signature-valid token regardless of session state. This is currently a
  per-route coding convention (both guards must be applied together), not an
  enforced invariant — shared with the coupling `PRD-Login` records as
  `IF-001` in `docs/features/login/FINDINGS.md`. Verified against every
  `@UseGuards` site in `auth.controller.ts`: everywhere either guard is
  applied, both are — the one realized exception is `POST
  /auth/end-impersonation`, which applies neither and is tracked separately
  as FC-004, not as an instance of this convention breaking.
- C-002: Session `expiresAt` (7 days from creation) is set independently of
  the JWT's own `expiresIn` claim, at each call site, rather than derived
  from the token. The two nominally agree today by convention, not by a
  shared source of truth, and could drift further if one changes without
  the other. They already disagree by construction: the session side is
  local-calendar arithmetic (`setDate(getDate() + 7)`), while the JWT side
  is an exact 604800-second offset — across a DST transition these differ
  by an hour (direction depending on server timezone), which `SessionGuard`
  never surfaces since it always binds on whichever is shorter.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | `userAgent`/`ipAddress` are never populated by either `SessionsService.createSession()` call site (verified — this is now stated as fact in Data Requirements, not assumed) and are not consulted by `SessionGuard` or anything else inspected in this feature's code path. The open part is *why* the columns exist at all — see Q-010, which considers whether `user_sessions` was intended as an audit/attribution record beyond access control. | If some other, unexamined code path populates or reads them, this PRD's Current Behavior and FR set would be incomplete | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Both `FEATURES_INVENTORY.md:197` (which additionally claims the raw JWT, not just a hash, is stored — see Data Requirements) and the Phase 0 `docs/foundation/DOMAIN-MODEL.md:32` ("tracks `impersonated_by` when applicable") state `user_sessions` has an `impersonated_by` column; the schema and code show `impersonatedBy` as a JWT claim only, never persisted to the session row. Which is correct — was this column removed/never built, or are both describing intended-but-unimplemented behavior? Since DOMAIN-MODEL is a Phase 0 artifact other PRDs treat as ground truth, and FR-005 is gated on the answer, this affects more than this document. | Current Behavior, Data Requirements, FR-005, `PRD-Impersonation` (not yet produced) | | open |
| Q-002 | Should there be a limit on concurrent sessions per account (multi-device), and/or a cleanup mechanism for expired session rows? Neither exists today (FC-003), and the missing `tokenHash` index means the cost of not answering this compounds as a per-request latency issue, not only storage growth. Relatedly: an impersonate/end-impersonate cycle appears to leak at least two rows per cycle (the admin's pre-impersonation session, orphaned once the frontend overwrites its stored token; the impersonation session itself, per FC-004) — worth confirming whether this is the dominant source of growth in practice. | FC-003, NFR (none currently defined) | | open |
| Q-003 | Is a user-facing "view active sessions" / "log out of all other devices" capability intended, or is `deleteAllUserSessions` meant to remain internal-only (currently invoked solely by password reset)? See also Q-010 — if `user_sessions` was meant to double as an audit record, a listing view may already be an implied goal. | Non Goals, FR-004, Q-010 | | open |
| Q-004 | What should happen when the `SessionGuard` datastore lookup itself fails (FC-002) — fail closed (reject the request) or fail open? No behavior is currently defined. | FC-002 | | open |
| Q-005 | Is the 7-day session lifetime (independently computed at each `createSession` call site, matching but not derived from the JWT's own expiry, and already drifting across DST transitions — see C-002) an intentional product decision, or should the two be unified into a single source of truth? Relatedly, no black-box way exists to exercise FR-002's expiry acceptance criterion short of waiting 7 days or mutating the row directly — should session lifetime be configurable for testing, mirroring `SIMULATED_PERSIST_DELAY_MS`'s precedent for other training-relevant timing? | C-002, FR-002, NFR (none currently defined) | | open |
| Q-006 | Is FR-005 (revoking the impersonated session when impersonation ends, and guarding `POST /auth/end-impersonation`) this PRD's responsibility to close, or `PRD-Impersonation`'s (not yet produced)? Session revocation is this feature's mechanism, but the trigger ("impersonation ended") belongs conceptually to Impersonation's flow, and the actual fix requires new state that Q-001 leaves unresolved. | FR-005, FC-004 | | open |
| Q-007 | Should `user_sessions.tokenHash` be indexed, given `SessionGuard` performs a `findFirst` on it for every request to every protected route, and no cap or cleanup bounds table growth (FC-003)? | FC-003 | | open |
| Q-008 | Should `backToAdminToken` be brought into the session-revocation model (FC-005) — e.g. backed by its own session row — or is its short 1-hour signed expiry an intentional, accepted exemption from G-001/G-003's guarantees? | G-001, G-003, FC-005 | | open |
| Q-009 | Should session revocation (FR-003 logout, FR-004 password-change) be made atomic with, or otherwise guaranteed alongside, the state change it accompanies (FC-006), and should the caller be told when revocation itself fails rather than always receiving `{ success: true }`? | FC-006 | | open |
| Q-010 | Was `user_sessions` intended to serve as an audit/attribution record (per `FEATURES_INVENTORY.md:188`, "audit trail in session records") in addition to access control — which would explain the existence of the never-populated `userAgent`/`ipAddress` columns (A-001) — or is that inventory language loose phrasing for "sessions are visible in the table"? | Data Requirements, A-001, Q-003 | | open |
| Q-011 | Is the shipped frontend's logout action never calling `POST /auth/logout` (FC-007) a defect (the wiring was missed or regressed) or an intentional gap for QA training, mirroring this codebase's other deliberately-planted issues (e.g. `SIMULATED_PERSIST_DELAY_MS`)? This determines whether G-002/US-001 should be read as unmet-but-intended or unmet-and-should-be-fixed. Also worth checking: was `authApi.logout()` (`frontend/lib/api.ts:143`) ever wired to a caller and later removed, which would distinguish a regression from a gap that was never closed. | G-002, US-001, FC-007 | | open |

## Success Metrics

Not measured today. No session-lifecycle metrics (active session count,
average session age, logout rate vs. natural expiry) are currently
instrumented. Revisit once Q-002/Q-005 are answered rather than picking a
metric now to fill the section.

## Architecture Impact

- Requirements likely to drive decisions: FR-002/C-001 (revocation currently
  enforced only by guard-pairing convention, not a stated invariant), FR-005/
  FC-004 (impersonated session outlives "ending" impersonation; the ending
  endpoint itself applies no guards), FC-005 (`backToAdminToken` is an
  access-granting token entirely outside the revocation model), FC-006
  (session revocation can fail silently after the state change it was meant
  to accompany has already committed), FC-007 (the product's own UI never
  triggers FR-003, so revocation-on-logout does not hold end-to-end today —
  this is a frontend integration fix, not a backend design decision, but it
  is the gap most likely to surprise anyone validating G-002), FC-001
  (session-creation failure after token signing, currently unhandled),
  FC-003 (unbounded session accumulation, no cap, no cleanup, no index on
  the column `SessionGuard` queries on every request)
- Suspected new components or boundaries: None — `SessionsService` and
  `SessionGuard` already exist as the shared mechanism consumed by Login,
  Registration, Admin Bootstrap, and Impersonation. Closing FR-005/FC-005
  will require either a schema change (persisted impersonation linkage) or a
  protocol change (`backToAdminToken` payload or the end-impersonation
  request shape) — a design decision for architecture, not specified here.
- Known architectural risk: No scheduled cleanup of expired `user_sessions`
  rows exists (FC-003), the `tokenHash` column they're queried by is
  unindexed, and table growth is unbounded over the life of a deployment —
  together this is a latency risk on every authenticated request in the
  system, not only a storage concern. Separately, the guard-pairing
  convention (C-001) that makes revocation work at all is not enforced by
  any test or lint rule found, and `POST /auth/end-impersonation` (FC-004)
  is a realized instance of a route with no session enforcement at all, not
  merely a hypothetical one — and the token that route accepts (FC-005) can
  mint a fresh admin session with no revocable trace, which is the most
  privilege-sensitive gap this PRD documents.