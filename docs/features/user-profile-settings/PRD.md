# User Profile & Settings

| Field | Value |
|---|---|
| Status | Review |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | Low |
| Owner | |
| Last updated | 2026-07-28 |
| Slug | PRD-UserProfileSettings |

## Overview

User Profile & Settings is the backend contract (`GET`/`PATCH /users/me`) that
lets an authenticated account holder view and edit their own identity and
preference data (display name, avatar, bio, and related profile fields). The
backend contract is implemented; **the frontend consuming it is not** — see
Current Behavior. This document describes the shipped read/write contract as
a target for the frontend to eventually consume, not a fully working
end-user feature today. It builds on `PRD-Registration` (creates the `User`
row this feature reads/extends) and `PRD-Login` (authentication required to
reach the endpoints).

**Scope of this pass:** FR-001/FR-002 below record the backend contract as it
exists today. Stated plainly: FR-001 is met. FR-002's success-path
acceptance criteria are met; its failure handling is not — FC-001's
expected behavior (per `ADR-0008`, Accepted) is not yet implemented against
`updateProfile()`, and FC-003 has no defined behavior at all. So FR-002 is
not fully discharged, and backend work remains, independent of Q-008 (which
is about whether the frontend is also this document's job).

## Current Behavior

**Frontend is a non-functional stub — the feature is not usable end-to-end
today.**
- `/profile` (`frontend/app/profile/page.tsx`) renders only `user.email` and
  `user.displayName` (read-only) plus a photo-upload control that only does
  a local `URL.createObjectURL` preview — never uploaded or persisted. No
  save action exists on this page.
- `/profile/settings` (`frontend/app/profile/settings/page.tsx`) seeds its
  username field from a hardcoded `mockUser` fixture
  (`frontend/lib/mockUser.ts`, `username: 'crypto_trader'`), not from the
  logged-in user's real data. Its buttons are `type="button"` with no
  handler, labelled "Save changes (UI only)" and "Update password (UI
  only)".
- `frontend/lib/api.ts`'s `usersApi.me()` is typed as
  `{ id, email, displayName, role }` — it does not request or surface any
  `UserProfile` field. No `PATCH /users/me` caller exists anywhere under
  `frontend/`.
- Whether this stub state is a deliberate QA-training artifact (the mock is
  the point) or unfinished work is unconfirmed — see Q-008.

**Backend is implemented and reachable directly (e.g. via the API/Swagger),
independent of the frontend stub above:**
- `GET /users/me` (`backend/src/users/users.controller.ts`) returns the
  current user's `User` row merged with its `UserProfile` (password hash
  stripped). `PATCH /users/me` accepts an `UpdateProfileDto` and calls
  `UsersService.updateProfile()`. Both sit behind `JwtAuthGuard,
  SessionGuard` at the controller level — no additional guard on these two
  routes specifically.
- **Editable field set does not match the inventory.** The inventory
  (`FEATURES_INVENTORY.md:218`) lists profile fields as "firstName, lastName,
  avatarUrl, bio, phone, dateOfBirth, gender, etc." The actual
  `UpdateProfileDto` (`backend/src/users/dto/update-profile.dto.ts`) and
  `UsersService.updateProfile()` (`backend/src/users/users.service.ts:297-311`)
  accept a different field set: `displayName` (on `User`), and on
  `UserProfile` — `photoUrl`, `username`, `bio`, `fullName`, `websiteUrl`,
  `location`, `birthday`, `languageCode`, `timezone`, `preferences`. There is
  no `phone` or `gender` field anywhere in the `UserProfile` Prisma model
  (`backend/prisma/schema.prisma:41-61`). See Q-001 — this PRD does not
  silently adopt either list as authoritative.
- **A normally-registered user has no `UserProfile` row.**
  `AuthService.register()` (`backend/src/auth/auth.service.ts:215-224`) calls
  `UsersService.create()`, which writes only a `User` row — matching
  `PRD-Registration`'s own C-001 ("this feature only creates the `users`
  table row; it must not create a `user_profiles` row"). So for the ordinary
  registration path, `GET /users/me` returns `profile: null` until this
  feature's first successful `PATCH`. `updateProfile()` uses
  `prisma.userProfile.upsert` (`users.service.ts:337-346`) specifically
  because the row usually does not exist yet — the first write is what
  creates it. This first-write creation is this feature's behavior, not
  Registration's; Registration explicitly disclaims it and no other PRD
  currently owns it (`PRD-UserProfileExtended`, backlog #10, is not yet
  written — see Q-009).
- `UserProfile.username` is unique at the database level
  (`schema.prisma:45`). `updateProfile()` performs **no pre-check** before
  writing (unlike the registration path, which calls `findByUsername()` and
  raises a clean "Username already taken" error —
  `auth.service.ts:264-268, 312-317`), and no Prisma exception filter or
  `P2002` handling exists anywhere in `backend/src`. A duplicate `username`
  on `PATCH /users/me` currently surfaces as an unhandled database
  constraint violation, not a clean conflict response.
- `preferences` is a `Json` column written wholesale on every update that
  includes it (`profileUpdate.preferences = dto.preferences`,
  `users.service.ts:331-332`) — sending `{ preferences: { theme: 'dark' } }`
  replaces the entire stored object, silently discarding any other stored
  preference keys.
- `@IsOptional()` on `UpdateProfileDto` fields admits an explicit `null`,
  which the service writes (checks are `!== undefined`, not truthy). The
  outcome differs by column: for the eight nullable columns (`photoUrl`,
  `username`, `bio`, `fullName`, `websiteUrl`, `location`, `birthday`, and
  `User.displayName`), "field omitted" leaves the value unchanged and
  "field sent as `null`" clears it. For the three **non-nullable** columns
  with defaults (`languageCode`, `timezone`, `preferences` —
  `schema.prisma:51-53`), `@IsOptional()` still admits `null` past DTO
  validation, but the write fails unhandled for these three — there is no
  clearing behavior. The exact failure mechanism is unconfirmed: it is
  plausibly a client-side `PrismaClientValidationError` (Prisma validates
  required-scalar and required-`Json` arguments before issuing SQL, and
  `preferences` being `Json` may raise a distinct error directing callers to
  `Prisma.JsonNull`) rather than a database-level `NOT NULL` violation — not
  verified empirically. None of this is documented in the DTO or surfaced
  to a caller. See FC-003.
- `UserProfile.verificationStatus` and `createdAt`/`updatedAt` exist on the
  model but are not present in `UpdateProfileDto` — not user-editable.
- Email is **not** editable via `PATCH /users/me` — no `email` field exists
  in `UpdateProfileDto` (unlike the admin-only `PATCH /users/:id`, which does
  accept it).
- **The missing-user branches in `GET`/`PATCH /users/me` are effectively
  unreachable.** `me()` returns `null`/200 (`users.controller.ts:53-58`) and
  `updateProfile()` throws `NotFoundException` (`users.service.ts:313-314`)
  for a JWT whose `sub` has no matching `User` row — but
  `JwtStrategy.validate()` (`jwt.strategy.ts:21-25`) already rejects that
  same condition with a 401 before either handler runs, for every route on
  `UsersController` (class-level `JwtAuthGuard`). So the divergent 200-vs-
  `NotFoundException` behavior described above is dead code under normal
  operation, reachable only in the improbable window of a user row deleted
  between JWT validation and handler execution. See Q-003 for whether this
  is worth reconciling at all, given it isn't currently caller-visible.
- `GET /users/:id` (`users.controller.ts:79-89`) carries only the
  class-level `JwtAuthGuard, SessionGuard` — no `AdminGuard`, unlike
  `list`, `bulkExport`, `patchUser`, and `putUser` on the same controller.
  Any authenticated user can currently read any other user's full record,
  including `email`, `fullName`, `birthday`, `location`, and `role` — this
  is a live exposure, not a hypothetical one; see Q-010.
- **A second, already-shipped path can create the same rows at registration
  time — conditionally.** `POST /auth/register-with-profile` →
  `AuthService.registerWithProfile()` (`auth.service.ts:245-288`) →
  `UsersService.createWithProfile()` (`users.service.ts:54-108`) accepts the
  same eleven fields this feature's `PATCH` does, but only creates a
  `UserProfile` row **if at least one profile field in the request is
  non-empty** (`hasProfileData` check, `users.service.ts:69-75`); a request
  with only `email`/`password`, or with every profile field empty, falls
  through to a plain `User`-only create — identical to `/auth/register`.
  `PRD-Registration`'s C-001 assigns this behavior to
  `PRD-UserProfileExtended` (backlog #10) — not yet written, but the
  behavior it will document is already live. For a user created this way
  **with** profile data supplied, the row already exists at registration
  and this feature's first `PATCH` is an update, not a create; **without**
  profile data supplied, the no-profile-row condition applies exactly as it
  does for `/auth/register` — the determining factor is payload content,
  not which endpoint was used. A third path,
  `AuthService.createUserWithProfileAsAdmin()` (`auth.service.ts:293-`),
  has the same conditional behavior and agrees on the same field set. See
  Q-009.
- Avatar is stored as `photoUrl`, a plain string field validated only by
  `@IsString()` — there is no file-upload path in this DTO; the inventory's
  "avatar" is a URL string the client would supply, not a binary upload
  (consistent with the frontend's current preview-only, non-persisting
  behavior). See Q-004 for whether a URL is the intended long-term
  mechanism.
- Whether any part of the system currently reads/displays `displayName` or
  `username` outside the (non-functional) `/profile` pages — e.g. order
  history, admin inspection views — is unconfirmed; not verified against
  those surfaces in this pass. See Q-011.

## Problem Statement

Account holders have no working way, today, to view or correct the identity
information (display name, avatar, bio, and related preferences) associated
with their account after registration: the backend contract exists but the
only frontend surfaces for it (`/profile`, `/profile/settings`) render mock
or read-only data and perform no writes.

## Goals

- G-001: A logged-in user can view their current profile data in one place.
  **Currently served only for 2 of 11 fields** (`email`, `displayName`) —
  see Current Behavior.
- G-002: A logged-in user can update their own profile fields without
  requiring admin involvement — this does not mean admin involvement is
  currently prevented; an impersonating admin can reach these same fields
  today with no audit trail (see Users/Actors, Q-013). **Currently unserved
  end-to-end for the account holder** — the backend accepts writes but no
  frontend caller exists.
- G-003: Profile updates are reflected immediately in any subsequent read of
  the user's own data — including surfaces beyond `/profile` itself.
  `displayName` is already read by `Header.tsx` (avatar initials, every
  authenticated page), the dashboard greeting, and the admin impersonation
  list — so this goal's scope is wider than the profile page. **Verified
  only at the backend layer**; not observable end-to-end while G-002 is
  unserved, and no frontend surface currently re-fetches `/users/me` after a
  write (none exists to test, since no write path exists yet).

## Non Goals

*Decided exclusions:*
- An admin editing another user's profile *in their own identity* (covered
  by `PATCH /users/:id` and `PUT /users/:id` — out of scope here). This does
  **not** cover an admin acting *through an impersonated session*: that
  path reaches this feature's own `PATCH /users/me` route, unaudited — see
  Users/Actors, C-002, Q-013.
- Changing email address (not exposed by this endpoint at all — see C-002,
  which ties this exclusion to `ADR-0016`'s containment argument, not just
  to current scope).
- Changing password (separate flow, not part of this feature).
- 2FA enrollment/management shown on `/profile/settings` (owned by
  `PRD-TwoFactorAuth`).

*Excluded from this pass, pending an open question — not permanent
exclusions:*
- Avatar file upload/hosting — current mechanism is a URL string field, not
  a file-upload pipeline; whether a real upload pipeline is planned is
  Q-004.
- Building a working `/profile`/`/profile/settings` UI against the existing
  backend contract — whether this document's job is to specify that UI, or
  only to document the backend contract as-is, is Q-008.
- Registration-time profile capture — plausibly `PRD-UserProfileExtended`
  (backlog #10), which does not exist yet, so this exclusion cannot be
  confirmed against a scope statement — see Q-009.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Account holder | Human | Authenticated user viewing/editing their own profile via `GET`/`PATCH /users/me` |
| Impersonating admin | Human | An admin holding an impersonated session (see `PRD-SessionManagement`, `ADR-0011`) can currently read and write the impersonated user's profile fields through these same routes, with no audit trail — `ADR-0016` describes "read-access or non-transactional routes (e.g. profile reads)" as lacking the `performedByAdmin`-equivalent metadata that deposits/orders/wallets have (quoting its own wording; this document extends "reads" to also cover writes through the same route). This reach is bounded by C-002 (no `email` field) but otherwise unrestricted and untraced. See Q-013. |

## User Stories

- US-001: As an account holder, I want to view my current profile
  information, so that I can confirm what's stored about me.
- US-002: As an account holder, I want to update my display name, avatar,
  bio, and other profile fields, so that my identity information stays
  accurate.

## Functional Requirements

### FR-001: View own profile

- **Description:** The system must let an authenticated user retrieve their
  own user and profile data, including the case where no `UserProfile` row
  exists yet.
- **Actor:** Account holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid session and an existing `UserProfile` row, when the user
    requests their profile, then the system returns the user record with a
    nested `profile` object holding the profile fields, excluding the
    password hash (e.g. `{ id, email, displayName, ..., profile: {...} }`
    — not a flat merge).
  - Given a valid session and no `UserProfile` row yet (see FC-002b for
    which registration path this applies to), when the user requests their
    profile, then the system returns the user record with `profile: null`
    rather than an error.
- **Related:** US-001, G-001

### FR-002: Update own profile

- **Description:** The system must let an authenticated user update a
  defined set of their own top-level profile fields, leaving unspecified
  fields unchanged, and must create the `UserProfile` row on first write if
  none exists.
- **Actor:** Account holder
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid session, when the user submits one or more editable
    top-level profile fields, then only those fields are updated and all
    others retain their prior values.
  - Given a valid session and no existing `UserProfile` row, when the user
    submits a profile update, then a `UserProfile` row is created holding
    the submitted values.
  - Given a valid session, when the user submits an update, then the
    response reflects the updated values.
  - Given a valid session and an update request where one field is rejected
    (e.g. FC-001's duplicate-username case), when the request fails, then no
    field in that request is persisted — a rejected update is all-or-nothing,
    not partially applied. **This criterion is not currently enforced or
    verifiable by any mechanism** — `ADR-0008` Risks flags the current
    implementation's ordering (the `username`-bearing upsert runs before the
    `displayName` update, so a rejection today happens to leave
    `displayName` unwritten) as correct by construction, not by an explicit
    guarantee, and explicitly declined to wrap the two writes in a
    `$transaction`. There is no test suite or review checkpoint that would
    catch a future reordering breaking this. Stating the guarantee here
    without a verification owner risks reading as decided when it is
    aspirational; see Q-015 for making that owner explicit (`$transaction`
    wrap, vs. a named manual-review checkpoint, vs. accepting the gap).
- **Governed by:** BR-001
- **Related:** US-002, G-002, G-003

## Failure Conditions

### FC-001: Duplicate username on update

- **Applies to:** FR-002
- **Condition:** The user submits a `username` value already taken by
  another account (unique constraint enforced at the database level).
- **Expected behavior:** Current behavior is an unhandled database
  constraint violation on `PATCH /users/me` — no pre-check, no exception
  filter (confirmed: no `P2002`/`PrismaClientKnownRequestError`/exception
  filter handling exists anywhere in `backend/src`). The two sibling
  registration paths currently disagree with each other on the same
  condition — `registerWithProfile()` (`auth.service.ts:267`) throws
  `UnauthorizedException` (401) while `createUserWithProfileAsAdmin()`
  (`auth.service.ts:315`) throws `ConflictException` (409) — but this
  disagreement is **already decided, not open**: `ADR-0008` (Accepted) has
  ruled that all pre-checks including the `auth.service.ts:267` one move to
  `ConflictException`/409 with canonical message `'Username already
  taken'`, and separately requires `UsersService.updateProfile()` — this
  PRD's own write path — to gain a `P2002` catch it currently has none of.
  The current unhandled-violation behavior is therefore a known deviation
  from an accepted decision, pending implementation, not an open design
  question. See Q-002 for what (narrower) remains open. **This coverage is
  partial, not complete:** `ADR-0008` itself notes `username` is never
  normalized — `findByUsername()` matches exactly and every write path
  stores the submitted casing as-is — so the accepted 409 fires only on an
  exact-string collision. Whether `Alice` and `alice` are meant to be the
  same username is explicitly left undecided by that ADR, which names "the
  PRD covering the profile endpoints" — its exact words are "no PRD covers
  the profile endpoints this ADR touches," an observation of absence rather
  than a wording that assigns ownership; this document is treating itself
  as that PRD by inference, not by ADR-0008's own instruction. See Q-014.

### FC-003: Explicit null on a non-nullable profile field

- **Applies to:** FR-002
- **Condition:** The user submits an explicit `null` for `languageCode`,
  `timezone`, or `preferences` — all non-nullable columns with defaults.
  `@IsOptional()` admits `null` past DTO validation for these fields exactly
  as it does for the nullable ones.
- **Expected behavior:** Current behavior is an unhandled failure — not a
  revert-to-default or any other defined outcome. Whether this surfaces as
  a database `NOT NULL` violation or a client-side Prisma validation error
  (`preferences` being `Json` may raise a distinct error pointing to
  `Prisma.JsonNull`) is unconfirmed; see Current Behavior. Whether
  null-to-clear semantics should extend
  to these fields (reverting to their default) or be rejected by validation
  before reaching the database is Q-012.

### FC-002a: No user row for authenticated caller

- **Applies to:** FR-001, FR-002
- **Condition:** A valid JWT/session resolves to a user ID with no
  corresponding `User` row (e.g. deleted account, corrupted state).
- **Expected behavior:** Not caller-reachable under normal operation.
  `JwtStrategy.validate()` (`jwt.strategy.ts:21-25`) already rejects this
  condition with 401 before either handler runs, for every route on
  `UsersController`. The handler-level branches (`me()` returns `null`/200;
  `updateProfile()` throws `NotFoundException`) exist but are dead code
  outside an improbable delete-race window, and they do disagree with each
  other within that window — see Q-003 for whether that residual
  inconsistency is worth reconciling.

### FC-002b: No profile row for authenticated caller

- **Applies to:** FR-001, FR-002
- **Condition:** The `User` row exists but no `UserProfile` row has been
  created yet. This is always true for a user registered via the plain
  `POST /auth/register` path (which never accepts profile fields). For
  `POST /auth/register-with-profile` and `createUserWithProfileAsAdmin()`,
  it is true whenever the registration request supplied no non-empty
  profile field — the row is created only conditionally on payload content
  (see Current Behavior), not deterministically by which endpoint was used.
- **Expected behavior:** `GET /users/me` returns the user with `profile:
  null` (this is expected, per FR-001's second acceptance criterion, not a
  failure). `PATCH /users/me` creates the row via upsert on first write (per
  FR-002's second acceptance criterion).

## Non Functional Requirements

No NFRs could be established with a threshold and measurement method from
the inventory or the source consulted. Candidates that lack a number are
recorded as Open Questions (Q-005, Q-006) rather than stated here, per
contract rule R-003.

## Business Rules

### BR-001: Profile updates are partial by default, at the top level only

- **Rule:** An update to a user's profile only modifies the top-level fields
  present in the request; omitted top-level fields are left unchanged. This
  does **not** extend inside the `preferences` object: a `preferences` value
  present in the request replaces the entire stored object, it does not
  merge with the previously stored preferences.
- **Rationale:** This is the PATCH semantics the current implementation
  follows for every top-level field. No frontend consumer of this endpoint
  exists yet (see Current Behavior). No surface reads a **persisted**
  `preferences` value, and it is absent from the admin bulk export row
  shape — but `frontend/app/admin/import-users/page.tsx` does display a
  `preferences (sent)` column echoing the import request's value (same
  request-echo pattern as `username`, see Q-011), so this is "no
  persisted-data reader," not "no display surface at all." The carve-out is
  recorded now, before any real consumer
  exists, specifically so the first caller to rely on merge semantics for
  `preferences` does not discover the wholesale-replace behavior by losing
  data. The rule is cheap to state today and would be expensive to
  discover after a real consumer depends on the wrong assumption.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| `User.displayName` | this feature (write path) / `PRD-Registration` (creation) | Lifetime of account | Internal |
| `UserProfile` (photoUrl, username, bio, fullName, websiteUrl, location, birthday, languageCode, timezone, preferences) | this feature (write path, including first-row creation) / no other PRD currently owns creation — see Q-009 | Lifetime of account | Internal; `birthday` and `location` are potentially PII, and their read-access scope is unresolved — see Q-010 |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| PostgreSQL (via Prisma) | outbound | Persist and retrieve `User`/`UserProfile` rows | blocking |

## Constraints

- C-001: Profile data model (`User`, `UserProfile`) is defined by
  `PRD-Registration`'s data creation path for the `User` row; this feature
  cannot introduce new fields without a corresponding schema change, which
  is an architecture decision, not a product one.
- C-002: `PATCH /users/me` must not accept an `email` field. This is not
  discretionary scoping — `ADR-0016` (Accepted, "Deny admin authority to
  impersonated sessions") relies on `UpdateProfileDto` having no `email`
  field and no session-authenticated password-change route as part of its
  containment argument for why an impersonating admin cannot achieve full
  account takeover through this endpoint. Widening the DTO to include email
  would weaken an accepted architecture decision, not just this PRD's scope.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The editable field set actually shipped (`displayName`, `photoUrl`, `username`, `bio`, `fullName`, `websiteUrl`, `location`, `birthday`, `languageCode`, `timezone`, `preferences`) is the intended product surface, and the inventory's list (firstName/lastName/avatarUrl/phone/dateOfBirth/gender) is stale documentation rather than an unshipped requirement. This is corroborated by three independent write paths — `PATCH /users/me`, `POST /auth/register-with-profile`, and `createUserWithProfileAsAdmin()` — agreeing on the same eleven fields, and by the inventory using what looks like the identical stale list in two separate feature entries (`FEATURES_INVENTORY.md:218` and `:235`). | If wrong, FR-002's acceptance criteria describe the wrong field set and `phone`/`gender`/separate first+last name fields would need a schema change to satisfy the original inventory intent. | Unowned — needs user confirmation (Q-001) |

## Open Questions

Ranked by consequence to this document, not by discovery order.

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-010 | **Owned elsewhere — cross-reference, not a standalone open question.** `GET /users/:id` having no `AdminGuard` (any authenticated user can read another user's `email`, `fullName`, `birthday`, `location`, `role`) is already tracked by `PRD-AdminRoleGuards`: FC-005 states the target behavior ("an account's full profile should be retrievable only by an admin or by that account itself"), and its own Q-009 asks whether that Goal is deliberately waived for this specific route — i.e. the target isn't fully settled there either. `admin-role-guards/FINDINGS.md` IF-002 records the same evidence without a target statement. This PRD's stake in it is narrower: Data Requirements' sensitivity classification for `birthday`/`location` is contingent on how `PRD-AdminRoleGuards` resolves it. | Data Requirements | `PRD-AdminRoleGuards` | tracked elsewhere |
| Q-013 | An impersonating admin can currently read and write another user's profile fields through these same routes with no audit trail (`ADR-0016` notes profile reads/writes lack the `performedByAdmin`-equivalent metadata that deposits/orders/wallets have). Should profile writes carry that metadata, matching the other controllers? This is bounded by C-002 (no `email` field) but otherwise unrestricted today. | Users/Actors, G-002 | | open |
| Q-008 | Is the current `/profile`/`/profile/settings` frontend stub (mock data, no-op buttons, and — for `/profile/settings` — no auth gate at all) a deliberate QA-training artifact, or unfinished work this PRD should specify the completion of? This determines whether G-002 is "out of scope by design" or "the next thing to build," whether this document's job is to describe a backend contract or to specify a missing UI, and — if "unfinished" — that a distinct FR set (or separate PRD) is needed for the frontend, since the current Must-priority FRs already describe existing backend behavior. | Overview, Goals, Non Goals | | open |
| Q-014 | `username` identity is underspecified beyond case. `ADR-0008` (Accepted) flags that `username` is never normalized — `findByUsername()` matches exactly, every write path stores the submitted casing — so `Alice`/`alice` currently persist as distinct accounts and ADR-0008's 409 only catches exact-string collisions; this document is the closest thing to an owner of that decision (see FC-001). But case is not the only gap: `username` has no `MinLength`/`IsNotEmpty`/trim/charset validation against a `String? @unique` column, so an empty string is a valid, storable, unique-constrained value today — the first user to submit `username: ""` (a plausible way to "clear" the field, especially given FC-003's null path is broken) consumes it, and the second gets FC-001's conflict for a value neither meaningfully set. Is `username` meant to be case-insensitive? Should empty string be rejected rather than accepted as a real value? Should leading/trailing whitespace be trimmed? If any answer is yes, this is a BR plus validation/schema change, not just a documentation fix. | FC-001, C-001, Q-006a | | open |
| Q-001 | Is the inventory's field list (firstName, lastName, avatarUrl, phone, dateOfBirth, gender) authoritative — meaning `phone`/`gender`/split name fields are a gap to build — or is the shipped field set (agreed on by three independent write paths, see A-001) the intended, current product surface and the inventory is stale? May be unanswerable here if it belongs to `PRD-UserProfileExtended` instead — see Q-009. | FR-002, Data Requirements | | open |
| Q-009 | `PRD-UserProfileExtended` (backlog #10) is referenced by both this document and `PRD-Registration`'s C-001 as the owner of registration-time profile capture — but its behavior is **already shipped and live** via `POST /auth/register-with-profile` (see Current Behavior), the document just doesn't exist yet. Does it also own the canonical field-set decision (Q-001)? Should this feature's first-write profile creation for the plain-registration path (Current Behavior, FR-002) be reassigned to that PRD once written? | Non Goals, Data Requirements, Q-001, FC-002b | | open |
| Q-002 | `ADR-0008` (Accepted) already decides the target behavior for FC-001: 409 `ConflictException`, message `'Username already taken'`, via a `P2002` catch on `UsersService.updateProfile()`. What genuinely remains open is narrower and belongs to `PRD-Registration` Q-004 (the anti-enumeration/disclosure-posture question ADR-0008 explicitly declines to decide, `ADR-0008` §"does not resolve") — this PRD's extension of that question to an authenticated `PATCH /users/me` caller is this document's own inference, not something ADR-0008 itself asks. Substantively, `registerWithProfile()`'s pre-check already lets an anonymous caller probe username existence, so withholding the same signal from an authenticated caller may buy nothing — worth weighing when `PRD-Registration` Q-004 resolves. Implementation against `updateProfile()` is not yet done regardless of the answer. **Note:** `PRD-Registration` Q-004 is scoped to duplicate *email* at *anonymous registration* — resolving it is input to this question, not a decision on it; `PRD-Registration` is not this question's owner, just the nearest related resolution. | FC-001 | shared with `PRD-Registration` Q-004 (input, not authority) | open |
| Q-015 | FR-002's all-or-nothing acceptance criterion (a rejected update persists nothing) is currently unenforced and unverifiable — `ADR-0008` Risks deliberately left the two writes un-transactioned, and no test suite exists in this repo to catch a regression. Should this be made structural (wrap `UsersService.updateProfile()`'s writes in `$transaction`), given a named manual-review checkpoint, or is the current "true by construction, no guarantee" state accepted as-is? | FR-002 | | open |
| Q-012 | Should an explicit `null` for the non-nullable fields (`languageCode`, `timezone`, `preferences`) revert the field to its default, or should the DTO reject `null` for these three fields before validation? Current behavior is an unhandled failure whose exact mechanism (database constraint vs. client-side Prisma validation error) is unconfirmed (FC-003); `preferences` being `Json` may need separate treatment from the two `VarChar` columns given `Json`'s distinct null semantics. `ADR-0013` has precedent for settling exactly this kind of mechanism question by an empirical check against the local dev DB rather than leaving it open. | FC-003 | | open |
| Q-003 | `GET /users/me`/`PATCH /users/me`'s divergent missing-user handling (FC-002a) is not caller-reachable under normal operation — `JwtStrategy.validate()` already rejects the same condition with 401 before either handler runs. Is reconciling the dead-code branches worth doing, or should this be closed as cosmetic-only? | FC-002a | | open |
| Q-004 | Is `photoUrl` (a client-supplied URL string) the intended long-term avatar mechanism, or is file upload/hosting planned and out of scope only for this pass? | Non Goals (avatar upload) | | open |
| Q-005 | Is there a target response-time or availability expectation for `GET`/`PATCH /users/me`? No threshold found in the inventory or source. | Non Functional Requirements | | open |
| Q-006a | Are there length/size limits intended for fields like `bio`, `websiteUrl`, `location`, or `preferences`? Only `languageCode` and `timezone` carry a `MaxLength` constraint in the current DTO; `preferences` is an unbounded JSON object. | Non Functional Requirements, FR-002 | | open |
| Q-006b | Should URL-bearing fields (`photoUrl`, `websiteUrl`) be format/scheme-restricted before storage or render, given they may later be rendered as `href`/`src` with no encoding owner identified yet? This is a security question, not formatting polish. Checked against the full ADR corpus (0008–0019) and `ARCHITECTURE-REVIEW-FINDINGS.md`: genuinely undecided, no prior coverage. | Non Functional Requirements, FR-002 | | open |
| Q-007 | Beyond the stub state already documented in Current Behavior (Q-008), does the eventual UI expose the same field set as the API, or a deliberate subset? | FR-001, FR-002 | | open |
| Q-011 | ~~Does anything outside `/profile`/`/profile/settings` currently read or display `displayName`/`username`?~~ **Answered, not open.** `displayName` is read on effectively every authenticated page — `Header.tsx:264-295` (avatar initials), `dashboard/page.tsx:108` (greeting), `admin/impersonate/page.tsx:135` (admin list). `username`: no consumer reads a **persisted** `username` value, but `frontend/app/admin/import-users/page.tsx` displays and filters on it — a `username` column (`:573`/`:613`), "Has username"/"No username" filters (`:551-552`), and it's part of the search blob (`:291`, `:293`) — using the value echoed from the import request, not re-read from the API (the filter's apparent server-data reference at `:304-306` is itself synthesized from the locally-parsed import row, not an API response field). So the asymmetry is real but weaker than "no consumers": the one field the stub UI edits has no *persisted-data* consumer, but does have an admin-facing display/filter surface on request-echo data. `preferences` has the identical pattern (see BR-001). See G-003 for the propagation consequence and Q-001/Q-007 for how this bears on the field-set decision. | — | | answered |

## Success Metrics

| Metric | Baseline | Target | Source |
|---|---|---|---|
| Profile update success rate | Unknown | Unknown | No telemetry/analytics source identified in the inventory or source consulted |

## Architecture Impact

- Requirements likely to drive decisions: FR-002 (first-write profile-row
  creation ownership per Q-009, partial-update semantics, duplicate-username
  handling per Q-002)
- Suspected new components or boundaries: Not assessed against the frontend
  layer in this pass beyond the stub-state observations in Current Behavior
  (see Q-008); no new backend boundary — extends the existing
  `UsersController`/`UsersService` boundary already used by
  `PRD-AdminUserCreation` and `PRD-AdminRoleGuards`.
- Known architectural risk: `updateProfile()`'s username-uniqueness handling
  deviates from `ADR-0008`'s already-accepted decision and needs the `P2002`
  catch that ADR requires but does not yet exist (FC-001), and that
  decision's coverage is itself partial — username case-sensitivity is
  explicitly undecided and named as this PRD's open question (Q-014);
  unhandled failure on explicit-null writes to non-nullable fields,
  mechanism unconfirmed (FC-003, Q-012); unaudited admin-impersonation reach
  over profile fields, no equivalent to the `performedByAdmin` metadata
  `ADR-0016` notes exists for deposits/orders/wallets (Q-013); and the
  read-access scope of `GET /users/:id` for PII-flagged fields, tracked in
  `PRD-AdminRoleGuards` rather than owned here (Q-010).
