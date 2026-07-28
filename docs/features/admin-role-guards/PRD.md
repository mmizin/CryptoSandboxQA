# Admin Role & Guards

| Field | Value |
|---|---|
| Status | Draft |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Low (product intent) / High (observed behavior) |
| Owner | |
| Last updated | 2026-07-27 |
| Slug | PRD-AdminRoleGuards |

## Overview

Admin Role & Guards is the coarse-grained role-based access control this
codebase uses to separate ordinary account holders from administrators. A
single `role` field on each account gates access to every `/admin/`-style
route and admin-only action across the backend; it is not a standalone
feature with its own UI, but the shared authorization primitive
`PRD-Login`'s authentication layer feeds into.

## Current Behavior

- **The gate is `AdminGuard`, applied directly via `@UseGuards`, not
  through a decorator.** `AdminGuard`
  (`backend/src/auth/guards/admin.guard.ts:8-20`) reads `request.user` and
  throws `ForbiddenException` unless `user.role === 'admin'` exactly.
  **Correction to the inventory entry**: no `@Admin()` decorator exists
  anywhere in the codebase (repo-wide search) — every protected route
  applies `AdminGuard` the same way any other guard is applied,
  `@UseGuards(..., AdminGuard)`, at either the controller class level or
  the method level layered on a class-level `JwtAuthGuard, SessionGuard`
  pair. The complete enumeration of every such site is the 13-site
  inventory below — see that bullet, not this one, for the exhaustive
  list.
- **Role is read fresh from the database on every request, not carried in
  the JWT.** **Correction to the inventory entry**: the inventory states
  "JWT Claim: Role included in JWT payload" — this is not what the code
  does. `JwtPayload` (`backend/src/auth/auth.service.ts:23-27`) has
  exactly three fields — `sub`, `email`, `impersonatedBy?` — no `role`
  field exists on it anywhere, for a normal login or for `impersonate()`.
  What populates `request.user` (and therefore what `AdminGuard` reads) is
  `JwtStrategy.validate()` (`backend/src/auth/jwt.strategy.ts:21-31`),
  which calls `usersService.findById(payload.sub)` — a fresh database
  lookup — on every authenticated request, and returns the full current
  user record (minus `passwordHash`). `AdminGuard` therefore always sees
  the account's *current* role, not a value fixed at token-issuance time.
- **Impersonation resolves authority to the target's current role — which
  is only non-admin because targets have been non-admin, not because
  anything enforces it.** **Correction to an earlier draft of this PRD**:
  it previously stated as confirmed fact that "impersonation doesn't
  grant admin access," matching the inventory's claim. That is true only
  for the case examined — `AuthService.impersonate()`
  (`auth.service.ts:457-495`) checks that the **caller** is an admin
  (`:461-464`) but validates the **target** only for existence
  (`:466-469`), with no check that the target is non-admin. The minted
  token's payload carries no role claim at all (same `JwtPayload` shape as
  any other token), so `JwtStrategy.validate()`'s fresh DB lookup resolves
  `payload.sub` to the target's current role — non-admin when the target
  is non-admin (the only case previously examined), but **`'admin'` if the
  target is also an admin**, in which case the resulting 7-day session
  passes every `AdminGuard` check exactly as the target's own session
  would. See FC-006 for the consequence when this combines with a
  subsequent role revocation.
- **A role change takes effect on the account's very next request, with no
  re-login required** — a direct consequence of the fresh-lookup design
  above, not a separately implemented feature.
- **`users.role` has no schema-level or application-level enum
  constraint.** `backend/prisma/schema.prisma:19`: `role String
  @default("user") // user | admin` — the `user | admin` comment is
  documentation only; the column accepts any string. `AdminGuard`'s
  `!== 'admin'` check means any value other than the exact string
  `'admin'` is treated as non-admin (fails closed for guard purposes), but
  nothing prevents a role value that is neither `'user'` nor `'admin'`
  from being written and persisted.
- **Role is settable through two admin-only update routes, and both
  already whitelist the value at the DTO layer.** `PATCH /users/:id`
  (`AdminPatchUserDto.role`, `admin-update-user.dto.ts:28-31`) and
  `PUT /users/:id` (`AdminReplaceUserDto.role`,
  `admin-replace-user.dto.ts:25-28`) both carry `@IsString()` **and**
  `@IsIn(['user', 'admin'])`, and the global `ValidationPipe`
  (`backend/src/main.ts:24`, `whitelist: true, transform: true`) is
  registered and active — a request setting `role` to any value outside
  that whitelist is rejected before it reaches the handler. **Correction
  to an earlier draft of this PRD**: the DTO-layer enforcement described
  here was initially missed (the `@IsIn` decorator sits directly above
  the field declaration this PRD originally cited without reading the
  full decorator stack) — see FC-001 for what genuinely remains
  unconstrained.
- **A user cannot self-elevate through the normal profile-update path.**
  `UpdateProfileDto` (`users/dto/update-profile.dto.ts`) has no `role`
  field at all; `PATCH /users/me`-equivalent routes reachable by a
  non-admin never accept or touch `role`. The only ways a `role` value
  changes are: initial admin bootstrap (`AuthService.createAdmin()`,
  `auth.service.ts:226-241`, gated by `AdminApiKeyGuard`, a static-key
  credential entirely separate from the JWT/role system — see
  Constraints), or an existing admin editing another (or their own)
  account via the two admin-only update routes above.
- **No protection against a zero-admin state was found.** No code path
  checked prevents the last remaining admin from demoting themselves (or
  being demoted by another admin) via the same unrestricted `role` field
  update described above.
- **`AdminApiKeyGuard` gates exactly one route: `POST /auth/admin/register`,
  the admin-bootstrap path — not the other admin routes near it.**
  **Correction to an earlier draft of this PRD**: it previously
  misattributed `admin/create-user` and `admin/bulk-import-users` to
  `AdminApiKeyGuard` as well; both are in fact `AdminGuard`-protected
  (`auth.controller.ts:122,153`), squarely in this feature's scope, not
  outside it. Only `POST /auth/admin/register`
  (`auth.controller.ts:106-107`) uses `AdminApiKeyGuard`: a static
  `X-Admin-Api-Key`/bearer header checked against the `ADMIN_API_KEY`
  environment variable (`admin-api-key.guard.ts:8-30`), with no
  relationship to `users.role`, JWT, or `AdminGuard` — this is the one
  path that can create the first admin account when none exists.
  `CLAUDE.md`'s workflow documentation also states `admin/create-user`
  "requires `ADMIN_API_KEY`," which does not match the code either — see
  Q-006.
- **Full `AdminGuard` route inventory** (13 sites, superseding the
  partial enumeration in an earlier draft of this PRD): `auth.controller.ts`
  — `admin/create-user` (:122), `admin/bulk-import-users` (:153),
  `impersonate` (:216); `users.controller.ts` — list (:42), bulk export
  (:61), and two further admin routes at :102 and :116 (class-level
  `JwtAuthGuard, SessionGuard` composes with each); six controllers
  applying the full `JwtAuthGuard, SessionGuard, AdminGuard` chain at the
  class level — `deposits/admin-deposits.controller.ts:27`,
  `transactions/admin-transactions.controller.ts:27`,
  `wallets/admin-wallets.controller.ts:19`,
  `portfolio/admin-portfolio.controller.ts:19`,
  `payment-methods/admin-payment-methods.controller.ts:25`,
  `orders/admin-orders.controller.ts:27`. Every one of the 13 pairs
  `JwtAuthGuard` at the same or an enclosing scope — no exception found,
  now against a complete enumeration rather than the 10-of-13 partial one
  an earlier draft relied on.
- **`GET /users/:id` returns any user's full profile to any authenticated
  account, with no `AdminGuard` and no self-ownership check.**
  `users.controller.ts:79-89` carries only the class-level
  `JwtAuthGuard, SessionGuard` pair — `getById()` calls
  `findByIdWithProfile(id)` for the `id` path parameter as given, with no
  check that it matches the requesting user, and returns the full `User`
  row (minus `passwordHash`) plus the joined `UserProfile` (email, role,
  displayName, birthday, location, website, preferences) for **any**
  target ID. This sits beside the admin-gated `GET /users` list
  (`:41-48`) but is not itself admin-gated. See FC-005.
- **`AdminGuard` has two distinct failure modes when its guard chain is
  misconfigured — one fails closed, the other fails open and inherits
  `login/FINDINGS.md` IF-001 rather than being structurally different
  from it.** **Correction to an earlier draft of this PRD**: it previously
  concluded `AdminGuard` "fails closed in every case examined," having
  checked only the missing-user mode below.
  - **Mode A — no user resolved at all.** If a future route applied
    `AdminGuard` without `JwtAuthGuard` having run first anywhere in its
    guard chain, `request.user` would be `undefined` and `AdminGuard`'s
    own `if (!user)` branch (`admin.guard.ts:12-14`) throws
    `ForbiddenException('Authentication required')` — a hard 403, not a
    silent pass-through.
  - **Mode B — a user resolved from the wrong kind of token.**
    `JwtStrategy.validate()` (`jwt.strategy.ts:21-31`) checks only
    `payload.sub` — it does not inspect `temp2fa` or `purpose` claims,
    and every token kind this codebase issues shares one signing secret.
    If a route paired `JwtAuthGuard` with `AdminGuard` but omitted
    `SessionGuard`, an admin's 5-minute 2FA temp token
    (`{sub, email, temp2fa: true}`, issued *before* the second factor is
    verified) or their raw `backToAdminToken`
    (`{sub: adminId, purpose: 'back_to_admin'}`, `auth.service.ts:484`)
    would both resolve to a full admin `User` record with `role:
    'admin'` — `request.user` is present, so `AdminGuard`'s check passes.
    **The only thing preventing this today is `SessionGuard`** requiring
    a matching `user_sessions` row (`session.guard.ts:27-36`), which
    neither token has — this is exactly `docs/features/login/FINDINGS.md`
    IF-001's unenforced guard-pairing convention, inherited by
    `AdminGuard`, not a property `AdminGuard` avoids. `docs/architecture/
    adr/0011-...md`'s Context independently states the same fact about
    `backToAdminToken` passing `JwtAuthGuard` as if it were a normal
    access token.
  - Mode A is real and does fail closed, as an earlier draft of this PRD
    stated. Mode B fails open, and is the more consequential of the two:
    it reaches admin authority via a credential minted *before* 2FA
    verification completes, or via a token meant only to restore an
    admin's own prior session.

## Problem Statement

Some actions and data (managing other users' accounts, inspecting other
users' wallets/orders/deposits/transactions/portfolios, bulk operations)
must be restricted to a trusted operator role, distinct from an ordinary
account holder, or any authenticated user could reach every other user's
data and every administrative action.

## Goals

- G-001: Every route matching FR-004's trigger condition (accepts another
  account's identifier, or returns another account's PII/holdings/history
  — aggregate/anonymized data excluded), or that performs an
  administrative action, is reachable only by an account whose current
  role is `admin`. **Not fully achieved today**: FC-005 shows
  `GET /users/:id` exposes any account's full profile to any
  authenticated user, with no `AdminGuard` and no self-ownership check —
  this Goal states the evidenced intent (the admin-gated `GET /users`
  list beside it, and the Problem Statement's own justification), not
  current reality. See Q-006.
- G-002: A role change (grant or revoke) takes effect without requiring
  the affected account to re-authenticate.

## Non Goals

- Fine-grained permissions or multiple non-admin role tiers — the system
  has exactly two role values in practice (`user`, `admin`), enforced by a
  single guard's equality check, not a permission matrix.
- Self-service admin requests or an approval workflow for becoming an
  admin — no such flow exists; admin status is granted only by an existing
  admin or the API-key bootstrap path.
- Auditing or logging of role changes — no such mechanism exists in the
  routes examined; whether one should is Q-004.
- Protecting against the impersonation mechanism's own weaknesses
  (`docs/features/two-factor-auth/FINDINGS.md` IF-002 — `impersonate()`
  performs no 2FA check; `docs/architecture/adr/0011-...md`, Proposed —
  end-impersonation auth boundary) — this PRD documents how impersonation
  interacts with role resolution (Current Behavior) but does not own
  impersonation's own security properties, which belong to
  `PRD-SessionManagement`/`PRD-Login`.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Administrator | Human | An account with `role: 'admin'`, able to reach every `AdminGuard`-protected route |
| Account Holder | Human | An account with `role: 'user'` (the default), denied every `AdminGuard`-protected route |
| AdminGuard | System | Reads the current request's resolved user and enforces the role check |
| JwtStrategy | System | Resolves `request.user` fresh from the database on every authenticated request — the actual source `AdminGuard` reads from, owned by `PRD-Login` |

## User Stories

- US-001: As an administrator, I want to access admin-only routes (user
  management, cross-account data inspection, bulk operations), so that I
  can operate and support the system without those capabilities being
  available to ordinary users.
- US-002: As an account holder, I want to be denied access to admin-only
  routes, so that other users (or a compromised ordinary account) cannot
  reach my data or administrative functions through those endpoints.
- US-003: As an administrator, I want a role change I make (granting or
  revoking admin status) to take effect immediately, so that I don't have
  to coordinate a forced re-login to enforce an access change.

## Functional Requirements

### FR-001: Deny non-admin access to admin-gated routes

- **Description:** The system must reject any request to an
  `AdminGuard`-protected route unless the requesting account's current
  role is exactly `'admin'`.
- **Actor:** AdminGuard
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an authenticated account with `role: 'user'`, when it requests
    an `AdminGuard`-protected route, then the request is rejected with a
    403 and no protected data or action is returned or performed.
  - Given an authenticated account with `role: 'admin'`, when it requests
    an `AdminGuard`-protected route, then the request proceeds.
  - Given no authenticated user resolved on the request at all, when an
    `AdminGuard`-protected route is requested, then the request is
    rejected with a 403 stating authentication is required, not a role
    error.
- **Governed by:** BR-001
- **Related:** US-001, US-002, G-001
- **Failure analysis:** See FC-004a, FC-004b.

### FR-002: Resolve role fresh per request, not from a token claim

- **Description:** The system must determine an account's current role
  from a live lookup at request time, not from a value fixed when the
  authentication token was issued.
- **Actor:** JwtStrategy
- **Priority:** Must
- **Acceptance Criteria:**
  - Given an account whose role changes while it holds an active,
    unexpired token, when it makes its next request, then access
    reflects the new role — no token reissuance or re-login required.
- **Governed by:** BR-002
- **Related:** US-003, G-002
- **Failure analysis:** See FC-006. **Correction to an earlier draft of
  this PRD**: this FR's guard *check* does read exactly one current DB
  row per request, with no ambiguity in that check itself — but that
  premise does not extend to artifacts (session rows, impersonation
  tokens) minted before a role change. Those can survive a later
  revocation unaffected, which is a real gap this requirement's
  acceptance criteria do not currently cover.

### FR-003: Restrict who can set an account's role

- **Description:** The system must permit an account's `role` field to be
  set only through an admin-gated update route or the separate
  API-key-gated bootstrap path — never through a route reachable by the
  account holder acting on their own account without admin privilege.
- **Actor:** Administrator
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a non-admin account updating its own profile through the
    self-service profile route, when the update is submitted, then `role`
    is not among the fields accepted or changed by that request, even if
    a `role` value is included in the payload.
  - Given an authenticated admin, when it submits an update to another
    account's `role` field via an admin-gated update route, then the
    role is changed to the submitted value.
- **Related:** US-001, G-001
- **Failure analysis:** See FC-001, FC-002.

### FR-004: Every route that would return or mutate another account's data enforces that restriction, by admin gate or by ownership check

- **Description:** The system must ensure that every route returning or
  mutating data belonging to an account other than the requester either
  (a) sits behind `AdminGuard` (at the same or an enclosing scope), or
  (b) enforces an ownership predicate scoping the operation to the
  requester's own account (the pattern this codebase already uses
  elsewhere — e.g. `OrdersService.findById` filtering
  `where: { id: orderId, userId }`, `orders.service.ts:447-452`) — FR-001
  verifies `AdminGuard`'s own logic is correct; this requirement verifies
  *one of the two* enforcement mechanisms is actually applied everywhere
  cross-account access is otherwise possible. **Audited route set**: all
  17 controllers under `backend/src/**/*.controller.ts` as of this PRD's
  last-verified state, not only the 13 sites that already carry
  `AdminGuard`. **Explicitly excluded from this trigger**: aggregate or
  anonymized data with no account-identifying dimension. This exclusion
  is exercised today, not hypothetical: `GET /cryptos`, `GET
  /cryptos/:symbol`, and `GET /cryptos/:symbol/price-history`
  (`cryptos.controller.ts:17,41,57`, no guards) and `GET /metrics`
  (`metrics.controller.ts:10`, no guards) are unauthenticated market-data
  and telemetry endpoints with no per-account dimension found in what was
  read — none carry an account identifier or account-scoped content.
- **Actor:** Administrator (as the beneficiary of correct coverage);
  verified by whoever performs the route audit this AC requires — no
  automated check enforces it today (see Q-009)
- **Priority:** Must
- **Acceptance Criteria:**
  - Given the audited route set (all 17 controllers, not only the 13
    `AdminGuard` sites) and a route returning or mutating another
    account's data, when that route is checked, then it either sits
    behind `AdminGuard` or enforces an ownership predicate. A route
    meeting neither fails this criterion — recording the gap as a
    Failure Condition (as FC-005 does) documents the violation, it does
    not satisfy the requirement.
- **Related:** US-001, US-002, G-001
- **Failure analysis:** See FC-005 — the one known violation found within
  the audited 17-controller set, not a discharge of this requirement.

## Failure Conditions

### FC-001: `role`'s value set is enforced only at the DTO layer, not the schema

- **Applies to:** FR-003
- **Condition:** `AdminPatchUserDto.role` and `AdminReplaceUserDto.role`
  both validate against `@IsIn(['user', 'admin'])`
  (`admin-update-user.dto.ts:28-31`, `admin-replace-user.dto.ts:25-28`),
  enforced by the active global `ValidationPipe`
  (`backend/src/main.ts:24`) — the two admin-gated API routes cannot
  write an out-of-set value. The schema column itself
  (`schema.prisma:19`, `role String @default("user")`) carries no
  corresponding constraint (no DB enum, no check constraint). Any write
  path that does not go through those two DTOs — a seed script, a direct
  Prisma Studio edit, raw SQL, or a future write path that omits the
  `@IsIn` validator — can still persist a value outside `{'user',
  'admin'}`.
- **Expected behavior:** Not currently defined by the product. See Q-001.

### FC-002: No protection against removing the last admin account

- **Applies to:** FR-003
- **Condition:** No code path examined checks the count of remaining
  `role: 'admin'` accounts before applying a role change. An admin can
  demote themselves, or another admin, down to zero remaining admin
  accounts via the same unrestricted update route FC-001 describes.
- **Expected behavior:** Not currently defined by the product. See Q-002.
  Note: `AdminApiKeyGuard`'s bootstrap path (`POST /auth/admin/register`)
  would remain available to create a new admin even from a zero-admin
  state, since it does not depend on any existing admin account — this
  bounds the failure's severity but does not resolve whether it should be
  prevented at the role-update layer.

### FC-003: A malformed or unexpected `role` value is silently treated as non-admin, not flagged

- **Applies to:** FR-001, FR-003
- **Condition:** `AdminGuard`'s check is `user.role !== 'admin'`
  (`admin.guard.ts:14`) — any value that is not the exact string
  `'admin'` (including a typo like `'Admin'`, an empty string, or a
  non-API-path value FC-001 describes) is treated identically to the
  ordinary `'user'` case: access denied, no distinction surfaced anywhere
  in the response or logs between "correctly not an admin" and "role
  field holds an unexpected value." Since the two admin-gated API routes
  now confirmed to whitelist `role` (FC-001) close off the most likely
  source of such a value, this condition's realistic trigger set is
  narrower than a prior draft of this PRD stated — limited to non-API
  write paths.
- **Expected behavior:** Not currently defined by the product. See Q-003.

### FC-004a: `AdminGuard` fails closed when no guard populates `request.user` at all

- **Applies to:** FR-001
- **Condition:** `AdminGuard` reads `request.user` (`admin.guard.ts:11`),
  which is populated only if `JwtAuthGuard` has already run earlier in the
  same request's guard chain. All 13 `AdminGuard` sites enumerated in
  Current Behavior pair it with `JwtAuthGuard, SessionGuard` — a complete
  enumeration, confirmed with no exception. Nothing in `AdminGuard` itself
  enforces this ordering; it is a convention every route author has
  followed so far, not a structural guarantee.
- **Expected behavior:** Already partially defined by the product, and
  confirmed safe for this specific mode: `AdminGuard`'s own `if (!user)`
  branch (`admin.guard.ts:12-14`) throws `ForbiddenException` when
  `request.user` is absent entirely, so a route missing `JwtAuthGuard`
  altogether fails closed. See FC-004b for the mode where a user *is*
  resolved but from a credential that shouldn't grant admin authority —
  that mode does not fail closed. Whether this residual ordering-
  convention dependency is worth closing structurally is Q-005.

### FC-004b: `AdminGuard` fails open when `SessionGuard` is omitted and a non-access token resolves a user

- **Applies to:** FR-001
- **Condition:** `JwtStrategy.validate()` (`jwt.strategy.ts:21-31`) checks
  only `payload.sub`; it does not inspect `temp2fa` or `purpose` claims,
  and every token kind this codebase issues (full session, 2FA temp
  token, `back_to_admin` token) shares one JWT signing secret. If a route
  applied `JwtAuthGuard` and `AdminGuard` without `SessionGuard`, an
  admin's own 5-minute 2FA temp token (issued *before* the second factor
  is verified, `{sub, email, temp2fa: true}`) or `backToAdminToken`
  (`{sub: adminId, purpose: 'back_to_admin'}`, `auth.service.ts:484`)
  would both resolve to a full admin `User` record — `request.user` is
  present and its `role` is `'admin'`, so `AdminGuard`'s check passes.
  **`SessionGuard` is the only thing preventing this today**, since
  neither token has a backing `user_sessions` row
  (`session.guard.ts:27-36`). This is `docs/features/login/FINDINGS.md`
  IF-001's unenforced guard-pairing convention, **inherited by
  `AdminGuard`, not avoided by it** — `docs/architecture/adr/
  0011-end-impersonation-authentication-boundary.md`'s Context
  independently states the same fact about `backToAdminToken` passing
  `JwtAuthGuard` as if it were a normal access token. All 13 current
  `AdminGuard` sites do pair `SessionGuard`, so this mode has not been
  observed to trigger — the exposure is in what a future route could do
  without a structural check preventing it, the same shape of risk
  IF-001 already describes for non-admin routes, but with admin authority
  as the payoff here instead of an ordinary authenticated route.
- **Expected behavior:** Not currently defined by the product. This mode
  does **not** fail closed — an earlier draft of this PRD stated
  `AdminGuard` "fails closed in every case examined," which examined only
  FC-004a's mode. See Q-005, now widened to cover both modes.

### FC-005: `GET /users/:id` exposes any account's full profile with no admin gate or self-ownership check

- **Applies to:** FR-004
- **Condition:** `UsersController.getById()` (`users.controller.ts:79-89`)
  carries only the controller's class-level `JwtAuthGuard, SessionGuard`
  pair — no `AdminGuard`, and no check that the requested `id` matches
  the requesting user's own ID. Any authenticated account can request any
  other account's `id` and receive the full `User` record (minus
  `passwordHash`) plus its joined `UserProfile` — email, role,
  displayName, birthday, location, website, preferences. This sits
  immediately beside the admin-gated `GET /users` list route
  (`:41-48`) but is not itself gated the same way, and is exactly the
  exposure the Problem Statement names as this feature's reason to exist.
- **Expected behavior:** Defined by G-001: an account's full profile
  should be retrievable only by an admin or by that account itself — this
  route does not meet that expectation today. Unlike this PRD's other
  Failure Conditions, the open question is not *what* the expected
  behavior is but whether this Goal is deliberately waived for this
  route, as a QA-training affordance, or is a genuine gap — see Q-006.

### FC-006: Sessions and impersonation tokens already issued do not respond to a later role revocation, and an admin can impersonate another admin

- **Applies to:** FR-002
- **Condition:** `updateByAdmin`/`replaceByAdmin`
  (`users.service.ts:367-416`, `:418-`) write only the `User` and
  `UserProfile` rows — neither touches `user_sessions`. Two concrete
  consequences: (1) if an admin uses `impersonate()`
  (`auth.service.ts:457-495`) to mint a session for a target account, and
  is then demoted, the session already issued to that target remains
  fully valid — an admin action already taken outlives the admin's own
  role; (2) if an admin is demoted *while actively impersonating*,
  `endImpersonation()` (`auth.service.ts:497-518`) re-checks
  `role !== 'admin'` on the return path and rejects it, leaving the
  demoted admin's `back_to_admin` token (1-hour TTL, no backing session
  row) permanently unusable — that admin can neither act as the
  (now-correctly-denied) admin nor return to their own original session
  through the intended path. FR-002's "exactly one DB row read per
  request" premise describes the guard *check* correctly but does not
  extend to artifacts (sessions, impersonation tokens) minted before a
  role change — see the correction to FR-002's Failure analysis. **A
  third consequence, sharper than the first**: `impersonate()`
  (`auth.service.ts:457-495`) validates only that the *caller* is an
  admin (`:461-464`) — the target is checked for existence only
  (`:466-469`), with no restriction against the target also being an
  admin. If admin A impersonates admin B and A is then demoted, A retains
  a live 7-day session carrying `role: 'admin'` (B's role, unaffected by
  A's demotion), passing every `AdminGuard` check — privilege retention
  across revocation, not merely a lingering ordinary-user session as
  consequence (1) alone would suggest.
- **Expected behavior:** Not currently defined by the product. See Q-007.

## Non Functional Requirements

No measurable NFR (authorization check latency, an availability target
for admin routes, or a specific security certification requirement) was
found or stated anywhere in the system for this feature specifically —
see Open Questions.

## Business Rules

### BR-001: Admin-gated routes require `role: 'admin'` exactly

- **Rule:** A route protected by `AdminGuard` is accessible only to an
  account whose current role is the exact string `'admin'`; every other
  value denies access.
- **Rationale:** A single, exact-match check is the entire authorization
  model this codebase uses for the admin/non-admin distinction — there is
  no tiered or partial admin capability to reason about instead.

### BR-002: Role authorization reflects the account's current database
state, not a value captured at authentication time

- **Rule:** Whether a request is treated as coming from an admin is
  decided by a fresh read of the account's role at request time, not by
  any claim embedded in the credential that request carries.
- **Rationale:** This is what makes a role change (grant, revoke, or the
  reversion `impersonate()`'s target-identity switch produces) take
  effect on the very next request without requiring re-authentication —
  the property `FR-002`/G-002 describe. This rule would still hold true
  even if `AdminGuard` itself were deleted or replaced, because it
  describes how `JwtStrategy` (a `PRD-Login`-owned component) resolves
  identity generally, not something specific to the admin/non-admin
  distinction. **Cost tradeoff, not currently stated elsewhere**: this
  rule costs one `usersService.findById` DB read on every authenticated
  request (`jwt.strategy.ts:22`). A future performance change moving
  `role` into the JWT claim to avoid that per-request lookup would
  silently break this rule, and with it FR-002/G-002's "no re-login
  required" property — such a change should be recognized as a
  requirement change against this BR, not merely an optimization.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| `role` field (`users.role`, `String @default("user")`) | this feature (authorization semantics); the column itself is part of the `User` model `PRD-Login`/`PRD-Registration` own | Indefinite while the account exists | Internal — determines access to every other user's data via admin routes; an incorrect value has system-wide access-control impact, not merely account-local impact |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Login (`PRD-Login`) | inbound | `JwtStrategy.validate()`, owned by Login, is what resolves `request.user` (and therefore `role`) on every request; this feature's guard depends entirely on that resolution being correct and fresh | blocking |
| Session Management (`PRD-SessionManagement`) | inbound | Every `AdminGuard`-protected route in this codebase also requires `SessionGuard` at the same or an enclosing scope; this feature does not independently gate on session validity | blocking |
| Admin Bootstrap (`AdminApiKeyGuard`, out of this feature's scope) | related, not blocking | The only way to create the first admin account when none exists; a separate, non-role-based, non-JWT credential this feature does not own or protect | — |
| Two-Factor Auth (`PRD-TwoFactorAuth`) | related, not blocking | `docs/features/two-factor-auth/FINDINGS.md` IF-002 documents that `impersonate()` performs no 2FA check; this feature's Current Behavior separately documents why impersonation doesn't grant elevated role, a related but distinct fact about the same method | — |

## Constraints

- C-001: `AdminApiKeyGuard`'s static API-key credential (gating only
  `POST /auth/admin/register` — see Current Behavior for the corrected
  attribution) is a separate authorization mechanism from everything else
  this feature governs — it predates and does not depend on `users.role`,
  and this feature's decisions do not extend to it. Every other admin
  route, including `admin/create-user` and `admin/bulk-import-users`, is
  in scope as ordinary `AdminGuard` surface. **This scope statement is
  contingent on Q-008**: `CLAUDE.md` documents `admin/create-user` as
  `ADMIN_API_KEY`-gated, contradicting the code. If Q-008 resolves toward
  the documentation rather than the code, this constraint, the 13-site
  route inventory, and FC-004a's completeness basis all need revisiting
  together.
- C-002: The role model is binary (`user`/`admin`) as implemented; adding
  a third tier would require both a schema change (or at minimum a
  documented value set) and revisiting every `AdminGuard`-protected
  route's equality check, none of which this feature's current
  implementation anticipates.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The `user \| admin` comment on `schema.prisma:19` and the `@IsIn(['user','admin'])` whitelist on both admin-update DTOs reflect the complete intended value set for `role`, and no third value (e.g. a moderator tier) was ever planned or partially implemented elsewhere | If wrong, FC-001's schema-level gap framing undersells a real missing tier rather than a DTO-vs-schema enforcement-layer gap on a two-value field | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | The two admin-gated API routes already whitelist `role` at the DTO layer; should the constraint also move to the schema (a DB enum or check constraint) to close the non-API write paths FC-001 still describes, or is DTO-layer enforcement accepted as sufficient? | FC-001 | | open |
| Q-002 | Should the system prevent removing the last remaining admin account, closing FC-002? Given `AdminApiKeyGuard`'s bootstrap path remains available regardless, is this worth guarding against at all, or an accepted, recoverable risk for this training sandbox? | FC-002 | | open |
| Q-003 | Should an unexpected (non-`user`/non-`admin`) role value be surfaced or logged distinctly from an ordinary non-admin denial, closing FC-003? | FC-003 | | open |
| Q-004 | Should role changes be audited (who changed whose role, when, from what to what)? No such mechanism exists today. | Non Goals | | open |
| Q-005 | `AdminGuard` has two failure modes (FC-004a, FC-004b): should the guard chain be enforced structurally (e.g. requiring an access-token-shaped credential, not just a present `request.user`, and/or requiring `SessionGuard` explicitly rather than by convention) to close FC-004b, which fails open? FC-004a's fail-closed behavior for a fully-missing user is not in question; FC-004b is. | FC-004a, FC-004b | | open |
| Q-006 | Is `GET /users/:id` returning any account's full profile to any authenticated user (FC-005) a deliberate sandbox affordance for QA training, or an oversight? If deliberate, G-001 needs narrowing and this should move to Constraints; if not, should it be `AdminGuard`-gated, restricted to self-only, or return a reduced projection? | FC-005, G-001 | | open |
| Q-007 | Three related questions from FC-006: (1) should revoking an admin's role invalidate sessions that admin already issued via `impersonate()`? (2) should a demoted admin's in-flight `back_to_admin` token still resolve to *something* usable (their own original session) rather than becoming permanently stuck? (3) is admin-to-admin impersonation an intended support workflow — if so this needs auditing/logging, if not, `impersonate()` should reject an admin target. | FC-006 | | open |
| Q-008 | `CLAUDE.md`'s documented workflow states `POST /auth/admin/create-user` requires `ADMIN_API_KEY`; the code gates it with `AdminGuard` (a JWT-based admin session) instead. Which is the intended design — should the code change to match the doc, or does the doc need correcting so it doesn't mislead the next discovery pass? | C-001, the 13-site route inventory | | open |
| Q-009 | Should FR-004's coverage requirement (every route matching its trigger condition is `AdminGuard`-gated) be verified by a one-time manual audit, or should it become an automated check (e.g. a test that fails when a new route accepting another account's identifier lacks `AdminGuard`)? No such check exists today — FR-004 currently has no named verification owner. | FR-004 | | open |

## Success Metrics

Not measured today. No instrumentation was found for admin-route access
attempts (granted or denied), role-change frequency, or time-to-effect
for a role change. Revisit once Q-001–Q-003, Q-006, or Q-007 are
resolved, since closing any of them would want these same metrics to
evaluate effect — Q-006/Q-007 in particular, since closing FC-005 is
precisely the kind of change a denied-access metric exists to verify.

## Architecture Impact

- Requirements likely to drive decisions: FC-001/FC-003 (role value
  validation at the schema layer — likely a small, contained decision,
  not architecturally significant on its own, now that DTO-layer
  enforcement is confirmed already in place); FC-002 (last-admin
  protection — a business-rule-level decision more than an architectural
  one); **FC-004b in particular** (whether guard-chain enforcement should
  become structural rather than convention-dependent — this is the same
  underlying gap as `docs/features/login/FINDINGS.md` IF-001, not merely
  related in kind to it, and closing one is the natural place to close
  the other); FC-005 (closing the unguarded `GET /users/:id` route — a
  contained fix, but the specific decision of *how* to gate it, self-only
  vs. admin-only vs. reduced projection, is architecturally relevant to
  how self-service vs. admin-service routes are distinguished generally);
  FC-006 (whether role revocation should cascade to session/token
  invalidation, and whether an admin should be able to impersonate
  another admin at all — both require `updateByAdmin`/`replaceByAdmin`
  and/or `impersonate()` to change, the same shape of decision `ADR-0014`
  made for 2FA enrollment).
- Suspected new components or boundaries: None required for FC-001,
  FC-002, FC-003, or FC-005 — contained fixes within existing DTOs, the
  existing guard, the existing schema column, or one existing route's
  guard chain. FC-004b, if closed structurally, would extend
  `JwtStrategy`/`AdminGuard` to distinguish token kinds — a change to
  existing components, but one shared with whatever eventually closes
  IF-001, not a new boundary. FC-006, if addressed, would extend an
  existing dependency (session revocation, already used elsewhere in this
  codebase — see `ADR-0014`) rather than introduce a new one.
- Known architectural risk: **revised twice from earlier drafts of this
  PRD.** The first draft concluded residual risk was confined to
  `role`-field data hygiene (FC-001–FC-003) with the authorization
  mechanism itself sound. A second draft corrected FC-005 (a genuine
  authorization gap, not a hygiene issue) and FC-006 (artifacts minted
  before a role change survive it) but still concluded `AdminGuard`'s own
  check "fails closed in every case examined." **That claim examined only
  one of the guard's two failure modes.** FC-004b shows the guard fails
  *open* when a non-access-token credential (an admin's own pre-2FA-
  verification temp token, or their `back_to_admin` token) resolves a
  user in the absence of `SessionGuard` — currently prevented only by
  every route today happening to pair `SessionGuard`, not by anything
  `AdminGuard` or `JwtStrategy` enforces. This is the same class of gap
  as `login/FINDINGS.md` IF-001, now confirmed to reach admin authority
  specifically, not merely an authenticated route. The residual risk
  is not confined to data hygiene, is not fully described by FC-005/
  FC-006 alone, and includes a real (if currently unexercised) guard
  bypass path.