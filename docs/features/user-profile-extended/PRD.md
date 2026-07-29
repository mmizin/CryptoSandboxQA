# User Profile Extended (Registration with Profile)

| Field | Value |
|---|---|
| Status | Approved |
| Mode | Existing Feature |
| Discovery | Confirmed |
| Confidence | Low |
| Owner | |
| Last updated | 2026-07-29 |
| Slug | PRD-UserProfileExtended |

## Overview

User Profile Extended is a backend-only capability
(`POST /auth/register-with-profile`) that lets a caller supply profile
information (name, avatar, bio, and related fields) in the same request
that creates an account, instead of creating the account first and writing
profile data afterward as a separate call. It extends
`PRD-Registration`'s account-creation path with an optional profile
payload, and its written fields are read/updated afterward through
`PRD-UserProfileSettings`'s `GET`/`PATCH /users/me` contract.
**This endpoint currently has no caller anywhere in this repository** — see
Current Behavior and Q-000.

## Current Behavior

- Backend: `POST /auth/register-with-profile` (unauthenticated) accepts the
  same email/password pair as plain registration, plus an optional set of
  profile fields, via `RegisterWithProfileDto`.
- A `UserProfile` row is created in the same request — inside the same
  database transaction as the `User` row (`UsersService.createWithProfile()`,
  confirmed via `prisma.$transaction`) — **only if at least one submitted
  profile field is non-empty** (a `hasProfileData` check: `Object.values(...)
  .some(v => v !== undefined && v !== null && v !== '')`, confirmed not
  trimmed). A request with only email/password, or with every profile field
  empty, falls through to a plain `User`-only create — identical in outcome
  to `POST /auth/register`.
- Whether a `UserProfile` row is created is therefore determined by payload
  content, not by which endpoint was called.
- A welcome email is sent on success, the same trigger as plain
  registration (`PRD-Registration` FR-004/FC-003 apply unchanged here — not
  restated).
- **No caller of this endpoint exists anywhere in the current repository.**
  A repository-wide search confirms no `frontend/` code references
  `register-with-profile` or `registerWithProfile` — the frontend never had
  a caller for it. `ARCHITECTURE.md` (as currently committed) documents a
  `tests/backend_tests/` Python API test suite whose `AuthClient` used this
  endpoint as an unauthenticated user-creation bootstrap, and a
  `tests/ui-tests/` Playwright suite — but neither directory exists in this
  repository today; git history confirms both were removed in commit
  `003842a` ("Remove all testing infrastructure and documentation"), and
  `ARCHITECTURE.md` was not updated to reflect the removal. The endpoint
  remains defined, routed, and documented in `openapi.json`, and is
  reachable by direct API call (Swagger, curl, or a script) — it is not
  broken, only uncalled by anything currently checked into the repository.
  See Q-000.
- **The inventory's stated field list does not match the field set the
  system actually accepts.** The inventory (`FEATURES_INVENTORY.md:235`)
  lists: firstName, lastName, avatarUrl, bio, phone, dateOfBirth, gender.
  `PRD-UserProfileSettings` (Current Behavior, A-001) documents that the
  actually-accepted field set — corroborated across three independent write
  paths including this endpoint's — is: `displayName` (on `User`), plus on
  `UserProfile`: `photoUrl`, `username`, `bio`, `fullName`, `websiteUrl`,
  `location`, `birthday`, `languageCode`, `timezone`, `preferences`. There is
  no `phone` or `gender` field anywhere in the underlying data model. This
  document does not adopt either list as authoritative on its own — see
  Q-001, shared with `PRD-UserProfileSettings` Q-001.
- **`username` on this path is governed by two Accepted ADRs, neither yet
  implemented against it.** `ADR-0008` names this endpoint's email and
  username pre-checks directly (`auth.service.ts:260-269`) and requires
  both to change from `UnauthorizedException` (401, current, verified) to
  `ConflictException` (409) with canonical messages `'Email already
  registered'` / `'Username already taken'` — not yet implemented; the
  sibling method `createUserWithProfileAsAdmin()` already throws
  `ConflictException` for the same conditions, so the two currently
  disagree with each other. `ADR-0020` names `createWithProfile()` (this
  feature's write path, line 90) as one of exactly four `username` write
  sites governed by its decision: a **`citext` column type** for
  `username` (database-level case-insensitive uniqueness, preserving the
  originally-submitted casing on read — not a lowercasing write-time
  transform) plus application-level trim in `UsersService`, with
  empty-after-trim converting to `NULL`. Neither half is implemented
  against this write path yet. Implementing the `citext` half is a schema
  change external to this feature — see Non Goals and Architecture Impact.
- `RegisterWithProfileDto`'s `username` field carries a 50-character limit
  — per `ADR-0020`'s Context, the *only* one of the four `username` write
  surfaces that enforces any length limit today (`UpdateProfileDto`,
  `AdminPatchUserDto`, `AdminReplaceUserDto` enforce none).
- A third, admin-facing path (`createUserWithProfileAsAdmin()`, tracked
  under `PRD-AdminUserCreation`) accepts the same field set and has the same
  conditional-creation behavior; it is a separate feature and not restated
  here beyond noting the field-set agreement.

## Problem Statement

A caller who already knows an account's profile information (display name,
bio, avatar, etc.) at account-creation time has a backend capability to
supply it in one request rather than two — but that capability has no
current consumer: the frontend registration flow never called it, and the
one caller that did (a Python API test suite) was removed from this
repository along with all other test infrastructure. Whether there
remains an unmet need this capability should serve, or whether it is a
dependency-free capability with nothing left depending on it, is not
established by the inventory and is this document's central open question
(Q-000).

## Goals

- G-001: A visitor can create an account and supply its initial profile
  data in a single request, without a required second step. **Currently
  met at the API level; unserved end-to-end** — no frontend or test
  caller currently exercises this path (see Current Behavior, Q-000).
- G-002: A caller who supplies no profile data at signup ends up in the
  same state as one who used plain registration — no partially-populated
  or inconsistent profile row is created. **Partially met** — the
  untrimmed `hasProfileData` check (Current Behavior) admits at least one
  case (a payload of only whitespace-only or empty-structural values) that
  creates a `UserProfile` row holding no data the caller meaningfully
  supplied — see Q-003.

## Non Goals

*Decided exclusions:*
- Defining the canonical editable profile field set — owned by
  `PRD-UserProfileSettings` (its Q-001/A-001); this document does not
  duplicate or re-decide that list.
- Read/update of profile data after account creation — `PRD-UserProfileSettings`'s
  `GET`/`PATCH /users/me`.
- Avatar file upload — consistent with `PRD-UserProfileSettings`'s Non
  Goals, avatar remains a URL string field on this path too.
- Admin-driven account creation with profile data (`createUserWithProfileAsAdmin()`) —
  tracked under `PRD-AdminUserCreation`, not this document.
- Implementing `ADR-0008`, `ADR-0013`, or `ADR-0020` against this
  endpoint's write path. These are external architecture decisions this
  document references and describes the impact of (FC-002, FC-003,
  Architecture Impact) — closing the gap between current and target
  behavior is implementation and architecture-execution work, not a
  product requirement this PRD adds to its own scope.

*Inherited, not excluded — this feature's own path requires these to hold,
even though it does not redefine them:* password rules, welcome-email
triggering, and immediate sign-in on success are `PRD-Registration`
FR-001/FR-004/FR-003 behavior that this endpoint's own service method
(`registerWithProfile()`) also performs, verified directly
(`auth.service.ts:283-286`, welcome email + `issueTokenAndSession()`).
`PRD-Registration`'s own "Related feature" note currently frames this
endpoint as entirely this document's concern and does not state that it
inherits these three requirements — that framing should be corrected when
`PRD-Registration` is next revised, not silently left implying no PRD
requires this endpoint to send a welcome email or issue a session.
Duplicate-email handling at signup **is** this document's concern (FC-002)
because `ADR-0008` names this endpoint's own pre-check as one of the
paths its decision changes — it is not purely `PRD-Registration`'s to
own here.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Visitor | Human | Unauthenticated person creating a new account, optionally with profile data |
| Mail Service | System | Sends the welcome notification after account creation, same as plain registration |

## User Stories

- US-001: As a visitor, I want to provide my profile information (name,
  bio, avatar) while registering, so that I don't have to fill it in again
  immediately afterward.
- US-002: As a visitor, I want registering with no profile information to
  work exactly like plain registration, so that supplying profile data
  stays optional and low-friction.

## Functional Requirements

### FR-001: Account creation with optional profile data

- **Description:** The system must let a visitor create an account by
  supplying email and password (as in `PRD-Registration` FR-001), plus an
  optional set of profile fields in the same request.
- **Actor:** Visitor
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a valid, unused email, a password meeting the minimum length, and
    one or more profile fields, when the visitor submits the combined
    request, then an account is created with both the account credential
    and the supplied profile data readable afterward via
    `PRD-UserProfileSettings`'s `GET /users/me`.
  - Given the same request with no profile fields supplied, when the
    visitor submits it, then the result is identical to `PRD-Registration`
    FR-001's plain account creation.
- **Related:** US-001, G-001, `PRD-Registration` BR-001 (every account
  requires a password — this feature does not weaken that rule, but the
  rule itself belongs to `PRD-Registration`, not this document, so it is
  not cited as `Governed by` here)

### FR-002: Conditional profile row creation

- **Description:** The system must create a `UserProfile` record for the
  new account only when the request actually supplies at least one
  genuinely non-empty `UserProfile` field, and must not create an empty or
  placeholder `UserProfile` record otherwise. `displayName` is explicitly
  out of scope of this requirement's emptiness test: it is a `User` column,
  not a `UserProfile` column, and its presence or absence never determines
  whether a `UserProfile` row is created.
- **Actor:** Visitor
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a request where every `UserProfile` field (excluding
    `displayName`) is empty or omitted, when the account is created, then
    no `UserProfile` record exists for it afterward — regardless of
    whether `displayName` was supplied — matching `PRD-Registration`'s
    plain-registration outcome.
  - Given a request where at least one `UserProfile` field (excluding
    `displayName`) is genuinely non-empty, when the account is created,
    then a `UserProfile` record is created holding the submitted values
    (plus the system's own defaults for fields the caller did not supply —
    `languageCode`, `timezone`, `preferences` — which are not themselves
    evidence of caller-supplied data and do not by themselves satisfy this
    criterion).
- **Governed by:** BR-001
- **Related:** US-002, G-002

## Failure Conditions

### FC-001: Invalid input (email format, password length, profile field constraints)

- **Applies to:** FR-001
- **Condition:** Email or password fail the same validation as
  `PRD-Registration` FC-002, or a supplied profile field fails its own
  validation (exact rules not established here — see Q-006, shared with
  `PRD-UserProfileSettings` Q-006a).
- **Expected behavior:** Registration is refused with field-specific
  feedback; no account and no profile record are created.

### FC-002: Duplicate email

- **Applies to:** FR-001
- **Condition:** The submitted email already belongs to an existing
  account.
- **Expected behavior:** **Current:** this endpoint's pre-check throws
  `UnauthorizedException` (401), message `'Email already registered'`
  (verified, `auth.service.ts:260-262`). **Target, per `ADR-0008`
  (Accepted):** `ConflictException` (409), same message — unifying this
  path with `createUserWithProfileAsAdmin()`, which already throws the
  target response for the identical condition. Not yet implemented against
  this endpoint. This target is owned and required by `ADR-0008`, not by
  this document — tracked here for impact per Non Goals' ADR-implementation
  exclusion, not as a requirement this PRD adds to its own scope.

### FC-003: Duplicate username at signup

- **Applies to:** FR-001, FR-002
- **Condition:** The submitted `username` is already taken by another
  account (exact-string match — `findByUsername()` performs no
  case-folding, per `ADR-0020`).
- **Expected behavior:** **Current:** this endpoint's pre-check throws
  `UnauthorizedException` (401), message `'Username already taken'`
  (verified, `auth.service.ts:264-269`; `ADR-0008` cites this exact line
  as `auth.service.ts:267`). **Target, per `ADR-0008` (Accepted):**
  `ConflictException` (409), same message — not yet implemented against
  this endpoint. **Partial coverage:** `ADR-0008`'s fix only unifies the
  response code/message for an *exact-string* collision; `ADR-0020`
  (Accepted) separately makes `username` case-insensitive at the database
  level (a `citext` column, not a lowercasing transform — see Current
  Behavior) plus trims it at write time — also not yet implemented against
  this write path. Once both land, `Alice`/`alice` would collide at
  submission, but **whether that collision is still caught by this
  endpoint's `findByUsername()` pre-check (giving the `ConflictException`
  above), or only by the database's own constraint surfacing through
  `ADR-0008`'s `P2002` catch instead, is `ADR-0020`'s own OQ-5 — explicitly
  unresolved there, not something this document can state as settled.**
  `ADR-0020` also names a sequencing requirement external to this PRD:
  `ADR-0008`'s `P2002` catch must ship before the `citext` column change,
  or some currently-silent collisions would instead surface as unhandled
  `500`s. Both targets are owned and required by `ADR-0008`/`ADR-0020`, not
  by this document — tracked here for impact per Non Goals' ADR-implementation
  exclusion, not as requirements this PRD adds to its own scope.

## Non Functional Requirements

No measurable NFRs could be established from the available evidence — no
threshold or measurement method was found in the inventory or in
`PRD-Registration`/`PRD-UserProfileSettings`. Candidate NFRs have been
recorded as Open Questions pending verification (Q-004, Q-005).

## Business Rules

### BR-001: A `UserProfile` row is never created holding no caller-supplied data

- **Rule:** A `UserProfile` row must never be created as a side effect of
  account creation unless the creation request supplied at least one
  genuinely non-empty `UserProfile` field. `displayName` is a `User`
  column and is explicitly excluded from this rule's emptiness test — see
  FR-002. This rule survives this feature's own deletion: it is a data
  invariant on the `UserProfile` table, not a behavior specific to this
  endpoint — `createUserWithProfileAsAdmin()` (`PRD-AdminUserCreation`)
  applies the identical gate for the identical reason. `PRD-UserProfileSettings`'s
  own `updateProfile()` upsert path shares the identical gap this rule
  currently has (see "Known gap" below): it creates a `UserProfile` row
  whenever the request includes any key at all (`!== undefined` test, not
  a genuine-content test), so a `PATCH /users/me` body of `{ bio: "" }` or
  `{ username: "   " }` creates a row on the same terms this rule
  forbids. This strengthens rather than weakens the rule's
  path-independence: the gap is a shared property of `UserProfile`'s
  write paths generally, not something specific to this feature's
  endpoint, so a fix belongs at the shared invariant, not at this
  endpoint alone.
- **Rationale:** Prevents a silently divergent, effectively-empty profile
  row from existing for no discoverable reason — the account holder gains
  nothing from it, and it can mislead a later reader (e.g. an admin
  inspecting the account) into assuming the row's presence means
  meaningful data was once supplied.
- **Known gap against this rule:** the implementation's non-emptiness test
  (`hasProfileData`) is not trimmed and does not treat an empty structural
  value (e.g. `preferences: {}`) as empty — so a payload of only
  whitespace-only strings or empty objects currently satisfies the gate
  and creates a row holding no data the caller meaningfully supplied. This
  is a live violation of the rule as stated, not a hypothetical edge case,
  and applies to all `UserProfile` fields except `displayName` (which sits
  outside this rule entirely — see above). See Q-003 for what the fix
  should be; `ADR-0020`'s trim/empty-to-NULL decision addresses only
  `username` and does not by itself close this gap for the other nine
  fields.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| User (email, password credential) | `PRD-Registration` | Lifetime of the account | PII / regulated (credential) |
| UserProfile (field set per Q-001) | this feature (conditional creation) / `PRD-UserProfileSettings` (subsequent reads/writes) | Lifetime of the account | Internal; some candidate fields (e.g. birthday, location, per `PRD-UserProfileSettings`) are potentially PII — sensitivity depends on the field-set answer in Q-001 |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Mail Service | outbound | Trigger welcome notification, same mechanism as `PRD-Registration` Integration Requirements | blocking today, per `PRD-Registration`'s ADR-0009-bounded behavior — not restated |

## Constraints

- C-001: This feature's account/profile data model is the same `users` +
  `UserProfile` model defined by `PRD-Registration` and read/written by
  `PRD-UserProfileSettings`; it cannot introduce new fields without a
  schema change, which is an architecture decision, not a product one.
- C-002: The `User` and `UserProfile` rows this feature creates are written
  inside a single database transaction (confirmed,
  `UsersService.createWithProfile()`) — FR-002's atomicity is not a
  requirement this feature must build, but a property it must not
  regress.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The profile field set actually accepted by this endpoint matches the set `PRD-UserProfileSettings` documents (A-001 there) rather than the inventory's stated list — since this endpoint is one of the three write paths that PRD's evidence is based on. | If wrong, this document's Data Requirements and FR-001's acceptance criteria describe the wrong field set. | Unowned — needs user confirmation (Q-001) |
| A-002 | Registration-with-profile is expected to remain open/unauthenticated, matching `PRD-Registration` A-001. | Would require an additional gating requirement and actor. | |

## Open Questions

Ranked by consequence to this document, not by discovery order.

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-000 | **The determining question for this document.** Is `POST /auth/register-with-profile` intended to gain a real caller (a registration-UI profile step, or a re-created test-automation bootstrap), meant to remain an API-only capability with no caller (deliberate, e.g. QA-training/direct-API-practice surface), or a candidate for retirement now that its one confirmed prior caller (a Python API test suite, per `ARCHITECTURE.md`'s description of `tests/backend_tests/`) has been removed from this repository (`git log`, commit `003842a`)? This determines whether this document specifies future UI/test work, documents a stable backend-only contract, or should recommend retirement instead. | Overview, Problem Statement, Goals, Success Metrics | | open |
| Q-001 | Is the inventory's field list (firstName, lastName, avatarUrl, bio, phone, dateOfBirth, gender) authoritative, or is the field set `PRD-UserProfileSettings` documents as actually shipped the intended product surface? Shared with `PRD-UserProfileSettings` Q-001/Q-009 — this document does not resolve it independently. | FR-001, FR-002, Data Requirements | shared with `PRD-UserProfileSettings` | open |
| Q-002 | ~~What is this endpoint's actual current behavior on a duplicate-username submission at signup, and is it in scope of `ADR-0008`'s accepted username-conflict decision?~~ **Answered.** Confirmed via direct code inspection (`auth.service.ts:260-269`) and `ADR-0008`, which names this endpoint's exact line: current behavior is `UnauthorizedException` (401) on both duplicate-email and duplicate-username; `ADR-0008`'s Accepted decision requires both to become `ConflictException` (409), not yet implemented. See FC-002/FC-003. What remains genuinely open is only the narrower anti-enumeration/disclosure-posture question this shares with `PRD-Registration` Q-004 (should a duplicate be confirmed to the caller at all) — that question is not this document's to resolve, only to note as an input. | FC-002, FC-003 | shared with `PRD-Registration` Q-004 (input, not authority) | answered — see FC-002/FC-003 |
| Q-003 | Should the profile-completeness bar for "at least one non-empty field creates a row" be tightened at the payload level (trim strings, treat empty structural values as empty) before the `hasProfileData` gate runs? **`ADR-0020`'s trim/empty-to-NULL decision is not a substitute for this fix** — it governs `username` only, and the gate tests all ten profile fields; `bio`, `fullName`, `preferences`, and the other non-`username` fields would remain ungated by any ADR-0020 implementation. Confirmed as a live gap against BR-001, not a hypothetical — see BR-001's "Known gap." | FR-002, BR-001 | | open |
| Q-004 | Is there a target response-time or availability expectation for this endpoint, distinct from plain registration's (also unanswered, `PRD-Registration` Q-002)? | Non Functional Requirements | | open |
| Q-005 | `ADR-0013`'s global IP-keyed rate-limit default is scoped to "every route in the system," and treats its four named routes as an illustrative, not exhaustive, starting checklist — this endpoint is not individually named, but that stated scope plausibly covers it. This is an inference from the mechanism's scope, not a citation naming this endpoint, and `ADR-0013` itself is Accepted but **not yet implemented anywhere in this backend** (no throttler exists in `backend/` today — same "Accepted, not shipped" status as `ADR-0008`/`ADR-0020`). What remains open: once implemented, should this endpoint also receive `ADR-0013`'s *tightened*, route-specific limit (as `register`, `login`, `2fa/verify`, and `forgot-password` would), or is the global default alone sufficient — matching `PRD-Registration` Q-002's identical unresolved question for plain registration? | Non Functional Requirements | shared with `PRD-Registration` Q-002 | narrowed — see Architecture Impact |
| Q-006 | What validation rules (length/format/charset) apply to the profile fields on this path? Partially informed by `ADR-0020`'s Context: `RegisterWithProfileDto`'s `username` field is the only one of the four `username` write surfaces with an enforced length limit (50 characters) today — the other three profile fields' validation is otherwise unconfirmed. `ADR-0020` OQ-3 asks which PRD should own the `username` length/charset question; this document is a plausible co-owner alongside `PRD-UserProfileSettings` Q-006a, given this DTO is the only one currently enforcing anything. | FC-001 | shared with `PRD-UserProfileSettings` Q-006a/Q-006b, and `ADR-0020` OQ-3 | open |
| Q-007 | Should this feature's conditional profile-row creation be reassigned as formally owned by `PRD-UserProfileSettings` instead (its own Q-009 raises this from the other side), given both documents currently describe the same shipped behavior from their own vantage point? | Overview, Data Requirements | shared with `PRD-UserProfileSettings` Q-009 | open |

## Success Metrics

Not measured today, and not meaningfully definable before Q-000 is
answered: with no confirmed caller, "share of registrations that include
profile data" is zero by construction regardless of the field-set question
(Q-001), so the metric's blocker is reachability, not instrumentation.
Revisit once Q-000 is answered.

## Architecture Impact

- Requirements likely to drive decisions: FR-002 (conditional row creation
  logic, shared mechanism across three write paths per
  `PRD-UserProfileSettings`'s evidence); FC-002/FC-003 (implementing
  `ADR-0008`'s and `ADR-0020`'s already-Accepted decisions against this
  endpoint's two pre-checks and its `username` write site).
- Suspected new components or boundaries: None for `ADR-0008`'s fix
  (reuses the existing Auth module exception-handling path). `ADR-0020`'s
  fix, applied to this write path, requires a database-level schema
  change (`username` becoming a `citext` column) — that change and its
  implementation are `ADR-0020`'s own scope, not this feature's; this
  document only tracks the resulting FC-003 impact (Non Goals).
- Known architectural risk: The same field-set/inventory mismatch flagged
  in `PRD-UserProfileSettings` applies identically here, since evidence for
  that mismatch was drawn in part from this endpoint (Q-001). `ADR-0008`
  governs this endpoint's two pre-checks and is confirmed not yet
  implemented against them (FC-002) — a closed implementation gap against
  an already-Accepted decision. `ADR-0020` governs this endpoint's
  `username` write path but is **not** purely an implementation gap here:
  its own OQ-5 (whether `findByUsername()` still catches case variants
  once the column is `citext`) is a genuinely open design question that
  bears directly on FC-003's target behavior, and its schema change is
  external to this feature's scope (Non Goals). `ADR-0013`'s global
  rate-limit default plausibly covers this route by mechanism, though not
  individually named, and is itself Accepted but not yet implemented
  anywhere in this backend (Q-005).
