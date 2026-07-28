# Admin User Creation (API Key Bootstrap)

| Field | Value |
|---|---|
| Status | Draft |
| Mode | Existing Feature |
| Discovery | Initial |
| Confidence | High (observed behavior) / Low (product intent on blast-radius questions) |
| Owner | |
| Last updated | 2026-07-28 |
| Slug | PRD-AdminUserCreation |

## Overview

Admin User Creation (API Key Bootstrap) is the direct, API-only pathway for
creating an admin account — and immediately authenticating as it — without
going through the normal user registration UI, an existing admin session, or
login. It exists so an admin account can be created and used when none
exists yet — the "who admins the first admin" problem — gated by a static
shared secret (`ADMIN_API_KEY`) rather than a JWT or an existing admin's
authority, which every other admin-affecting route in `PRD-AdminRoleGuards`
requires.

## Current Behavior

Read directly from source (`backend/src/auth/auth.controller.ts:106-119`,
`backend/src/auth/auth.service.ts:226-243`,
`backend/src/auth/guards/admin-api-key.guard.ts`,
`backend/src/auth/dto/create-admin.dto.ts`), superseding an earlier draft of
this PRD that relied only on the inventory and on `PRD-AdminRoleGuards`'s
discovery without opening these files itself.

- **The route is `POST /auth/admin/register`, gated by `AdminApiKeyGuard`,
  backed by `AuthService.createAdmin()`** (`auth.controller.ts:106-119`) —
  confirming the inventory's route and guard pairing, and confirming
  `PRD-AdminRoleGuards`'s independent finding of the same. The inventory's
  method name `registerAdmin()` does not match source; the actual method is
  `createAdmin()` (`auth.service.ts:226-243`).
- **The route creates the account and immediately mints a live authenticated
  session for it — it does not merely create a row.** `createAdmin()`'s last
  line is `return this.issueTokenAndSession(user)` (`auth.service.ts:242`),
  the same session-issuing call `login()` and `register()` use — this part is
  confirmed, observed behavior. **Answered by `ADR-0019` (Accepted):**
  going forward, continuing to issue a session here is a deliberate,
  decided design — not a claim about whether reusing
  `issueTokenAndSession()` was originally deliberate for this route, which
  remains unconfirmed and unrecoverable from source. The controller's Swagger
  annotation (`@ApiJsonExample(201, 'Returns admin user and access token',
  ...)`, `auth.controller.ts:115`) documents the response shape, which is
  consistent with either reading — it is not, by itself, evidence of intent.
  What *is* an author's deliberate statement is the sibling `admin/create-user`
  route's annotation, which explicitly says "Does not create a session for
  the new user" (`auth.controller.ts:128,131`) — a contrast worth noting, not
  proof this route's silence on the point was equally deliberate. **The
  observed effect, regardless of intent, is that a holder of `ADMIN_API_KEY`
  obtains a fully authenticated admin session in one call — no password
  login step, no 2FA step — for an account they just created.** Because
  duplicate email is rejected (see below), this route cannot be pointed at
  an *existing* account — so it provides no 2FA bypass for an account that
  already has 2FA enrolled; the bypass is scoped to the newly created
  account only, which has nothing enrolled yet. **This is a narrower bound
  than it may read as**: per BR-001, the new account's admin authority is
  fully equivalent to any existing admin's — so a key holder blocked by an
  existing admin's 2FA does not need to bypass it, they can simply create a
  *different* admin account with identical authority. 2FA on existing
  accounts is not a control against an `ADMIN_API_KEY` holder.
- **The API key is accepted in either of two request locations, evaluated
  in a fixed, non-symmetric order**: the guard reads `X-Admin-Api-Key`
  first and falls back to `Authorization: Bearer <key>` only when that
  header is entirely absent (`request.headers['x-admin-api-key'] ??
  this.extractBearerKey(request)`, `admin-api-key.guard.ts:16-17,31-35`) —
  the same header slot JWTs use elsewhere in this system. **A present but
  empty or wrong `X-Admin-Api-Key` header suppresses an otherwise-valid
  `Authorization: Bearer` key**, since `??` only falls through on
  null/undefined, not on an empty/mismatched string. A key sent in neither
  location is rejected the same way as any other invalid key.
- **`createAdmin()` performs no check on how many admin accounts already
  exist** (`auth.service.ts:226-243`) — the route behaves identically
  whether the caller is bootstrapping from zero admins or creating the
  tenth. `ADR-0018` (Accepted) restricts this behavior to the zero-admin
  case; as of this writing the code does not yet implement that
  restriction — this bullet records the current, pre-restriction behavior.
- **Request body accepts exactly three fields, no `username`:** `email`
  (required, valid email format, max length per
  `EMAIL_MAX_LENGTH`), `password` (required, min length 6), `displayName`
  (optional, max length 100) — `create-admin.dto.ts:5-22`. An earlier draft
  of this PRD's FC-002 incorrectly referenced a `username` field; this DTO
  has none.
- **Duplicate-email response is `401 Unauthorized` with message `'Email
  already registered'`** (`auth.service.ts:231-234`), the same message
  `register()` uses for the same case (`auth.service.ts:217-219`). This is a
  different status code than the sibling `admin/create-user` route, which
  returns `409` for the equivalent conflict (`auth.controller.ts:133`,
  `OA.httpError.conflictEmail`). **A client cannot distinguish "your API key
  is wrong" (also 401, see below) from "that email is already an admin"
  using status code alone on this route** — both return 401.
- **Missing or invalid API key returns `401 Unauthorized` with message
  `'Invalid admin API key'`** (`admin-api-key.guard.ts:25-27`).
- **An unset or blank `ADMIN_API_KEY` environment variable fails closed**:
  the guard throws `401` with message `'Admin API key not configured. Set
  ADMIN_API_KEY in .env'` before comparing any submitted key
  (`admin-api-key.guard.ts:19-24`) — every request is rejected, none is
  silently accepted.
- **No rate limiting exists on this route.** A repo-wide search of
  `backend/src` found no throttler guard, decorator, or interceptor applied
  anywhere in the auth module or globally.
- **No audit record is written when this route creates an account** — no
  logging call, event emission, or dedicated table write was found in
  `createAdmin()` beyond the standard user-creation path shared with
  `register()`.
- **`createAdmin()` differs from `register()` by more than the `role` field**:
  unlike `register()` (`auth.service.ts:222`), `createAdmin()` does not call
  `mailService.sendWelcomeEmail()` — no welcome email is sent for an
  API-key-bootstrapped admin account.
- **The `CLAUDE.md`/inventory endpoint-naming discrepancy this PRD's Open
  Questions originally flagged is already tracked, not newly discovered
  here**: `PRD-AdminRoleGuards` Q-008 records that `CLAUDE.md`'s workflow
  documentation names `POST /auth/admin/create-user` as the
  `ADMIN_API_KEY`-gated route, which does not match source. This PRD defers
  to Q-008 rather than re-opening the same question under a new ID.
- **`PRD-AdminRoleGuards`'s FC-002 notes this route staying available** as
  the reason that risk's severity is *observed* as bounded/recoverable
  rather than severe — an observation, not a recorded risk acceptance;
  FC-002's own expected behavior is undefined and its Q-002 is open,
  unowned. `ADR-0018` examines this dependency directly and finds it does
  not actually constrain this route's design (a live-count restriction here
  would preserve the same recoverability, not remove it) — see Integration
  Requirements.

## Problem Statement

Every admin-affecting action in this system — granting the `admin` role,
impersonating a user, running admin-only queries — requires an existing
admin's authenticated session (`PRD-AdminRoleGuards`). Before any admin
account exists (confirmed: no seed script in `backend/prisma/` creates one),
there is no session-based path available at all. The system needs an
authority path that does not depend on any existing admin session. Whether
that path should also skip the separate login step once an account is
created (rather than creating the account and requiring a normal login
afterward) was the design question tracked as Q-002 — no operator report
or requirement documenting that need was found; the observation was
limited to what the code did. **Answered by `ADR-0019` (Accepted):** yes,
the route continues to skip that step, primarily because it is the fully
reversible choice at zero implementation cost while no usage evidence
exists either way — not because an operator need for it was confirmed.

## Goals

- G-001: An operator holding the `ADMIN_API_KEY` secret can create a new
  account with `role = 'admin'`, without needing any existing admin's JWT
  session or the standard registration UI. **Resolved by `ADR-0019`
  (Accepted):** the created account also receives a session in the same
  call (skipping a subsequent login step), as a deliberate, decided design
  going forward — not settled as having always been the confirmed original
  intent, which `ADR-0019` found unrecoverable from source either way.
  **Additive clause per `ADR-0018` (Accepted):** this
  Goal's "without needing any existing admin's JWT session" holds only in
  the zero-admin window `ADR-0018` restricts the route to — at nonzero
  admin count, no JWT-session-free path to creating an admin account exists
  via this route anymore (the admin-gated `PATCH`/`PUT /users/:id` role
  update remains the only path, per `PRD-AdminRoleGuards` FR-003). Not a
  rewrite of this Goal's zero-admin case, which is unaffected.
- G-002: The bootstrap path is usable to create the very first admin
  account in an environment where zero admin accounts currently exist. No
  seed script creates an admin, so a fresh environment genuinely starts
  with zero; this route is confirmed as the only *other* admin-affecting
  route not gated by an existing admin session — the sibling
  `admin/create-user` route requires `AdminGuard` (`auth.controller.ts:
  121-122`), per `PRD-AdminRoleGuards`'s route inventory. **This "only such
  path" reading is itself contingent on `PRD-AdminRoleGuards` Q-008**
  resolving toward the code (`POST /auth/admin/register`) rather than
  toward `CLAUDE.md`'s conflicting documentation (see Q-001) — this
  contingency is about which route `CLAUDE.md` was documenting, not about
  whether either route can create an admin. Separately, `ADR-0018`
  independently confirmed `admin/create-user`'s backing method
  (`createUserWithProfileAsAdmin()`) never sets `role`, defaulting to
  `'user'` — so `admin/create-user` cannot produce an admin account under
  *either* resolution of Q-008; Q-008 only decides which route `CLAUDE.md`
  meant to document, not this Goal's "only such path" claim, which holds
  regardless. **Additive clause per `ADR-0018` (Accepted):** this Goal was
  already consistent with restricting the route to that zero-admin window
  and needed no rewrite — only this note that the route is now
  *exclusively* usable in that window, not merely usable in it among other
  cases.

## Non Goals

- Managing or rotating the `ADMIN_API_KEY` secret itself — its lifecycle is
  operational/infrastructure, not a product requirement of this feature.
  **No owner is currently named for this decision anywhere in the
  documentation set** — it is deferred, not assigned; see Q-010, which asks
  who currently holds the key, as a first step toward naming one.
- Promoting an existing regular user to `admin` — that is the role-update
  path already covered by `PRD-AdminRoleGuards` (`PATCH`/`PUT /users/:id`),
  not this bootstrap-creation path.
- Bulk admin creation — this is a single-account creation pathway; bulk
  creation of any account is `PRD-011` (Bulk User Import) territory.
- Any UI for this pathway — it is API-only, bypassing the registration UI
  entirely (`auth.controller.ts:106-119`).
- Deciding whether this path should require 2FA on the issued session, be
  rate-limited, be audited, or impose a distinct credential policy/expiry on
  the accounts it creates — these are named as Open Questions (Q-005, Q-006,
  and Q-009's still-open credential-policy half) for a product owner
  to decide, not resolved by this PRD. Q-009's restriction half
  (restriction to the zero-admin window) is no longer open — see FR-001 and
  `ADR-0018`. Q-002 (whether the route deliberately issues a session in the
  same call) is likewise no longer open — see FR-001 and `ADR-0019`.

## Users / Actors

| Actor | Type | Description |
|---|---|---|
| Operator | Human | Holds the `ADMIN_API_KEY` secret (e.g. a developer or QA engineer setting up a training environment); not necessarily an existing application user. |
| Backend (`AuthService`, `AdminApiKeyGuard`) | System | Validates the API key header, creates the `users` row with `role = 'admin'`, and issues a session/token for it. |

## User Stories

- US-001: As an operator setting up a fresh environment, I want to create
  the first admin account using only a shared secret, so that I am not
  locked out of admin-only functionality with zero existing admins.
- US-002: As an operator running QA test setup, I want to create additional
  admin accounts directly via API, so that I don't have to manually promote
  a regular user through an existing admin session.
  - **Status:** Retired
  - **Retired:** 2026-07-28
  - **Reason:** `ADR-0018` (Accepted) restricts this route to the window
    before any admin account exists, on the grounds that no in-repo
    automation or documented runbook corroborated this story's "additional
    admin accounts" workflow being exercised in practice, weighed against
    the irreversible exposure of leaving the route available indefinitely.
    If concrete evidence of this workflow's real use later emerges, this
    story is the one to reinstate — see `ADR-0018` Alternatives Rejected's
    revisit condition.
  - **Replaced by:** none — the need this story described, if confirmed,
    would revert `ADR-0018`'s Decision rather than being served by a
    different mechanism.

## Functional Requirements

### FR-001: Create an admin account via API-key authority

- **Description:** The system must allow creating a new account with
  `role = 'admin'` when the request is authenticated by a valid
  `ADMIN_API_KEY` value (sent via either accepted transport — see Current
  Behavior), independent of any existing admin JWT session. **Updated per
  `ADR-0019` (Accepted):** the response also includes an authenticated
  session/token for the created account in the same call, as a deliberate,
  decided design going forward.
- **Actor:** Operator
- **Priority:** Must
- **Acceptance Criteria:**
  - Given no admin account exists in the system, when an operator submits a
    valid `ADMIN_API_KEY` and a valid email/password (and optional
    `displayName`), then a new account is created with `role = 'admin'`.
    **Updated per `ADR-0019` (Accepted):** the response includes a usable
    access token/session in the same call, as a deliberate, decided
    design.
  - **Updated per `ADR-0018` (Accepted):** Given at least one admin account
    already exists, when an operator submits a valid `ADMIN_API_KEY` and
    valid fields, then the request is rejected — this route is restricted
    to the window before any admin account exists. Q-009 is answered by
    `ADR-0018`: restrict, via a live admin-count check. This criterion
    previously read "the path is not restricted to first-admin-only use";
    that behavior is superseded by this criterion once `ADR-0018` is
    implemented, not retired outright, since the underlying capability
    (creating an admin at all via this route) is unchanged for the
    zero-admin case.
  - Given the account was just created by this call, no 2FA is enrolled on
    it yet, so no 2FA challenge occurs on the issued session; this route
    cannot be pointed at an existing account (duplicate email is rejected —
    FC-002), so it provides no 2FA bypass *for that specific account*. (See
    BR-001's rationale for why this is a narrower guarantee than it may
    read as: authority granted here is equivalent to any existing admin's.)
- **Governed by:** BR-001
- **Related:** US-001, G-001, G-002. **Orphaned:** US-002 (Retired per
  `ADR-0018`) is no longer implemented by this FR's second acceptance
  criterion, which now states the opposite behavior — flagged per R-012
  rather than silently dropped.

### FR-002: Reject requests without a valid API key

- **Description:** The system must refuse to create an admin account when
  the request does not carry a valid `ADMIN_API_KEY` value, including when
  the variable itself is unset or blank in the environment.
- **Actor:** Backend
- **Priority:** Must
- **Acceptance Criteria:**
  - Given a request with a missing or incorrect API key value, when it is
    submitted to the bootstrap-creation path, then no account is created,
    no session is issued, and the request is rejected with `401
    Unauthorized`.
  - Given `ADMIN_API_KEY` is unset or blank in the environment, when any
    request is submitted to this path, then every request is rejected with
    `401 Unauthorized` (fails closed).
- **Related:** G-001, FC-001

## Failure Conditions

### FC-001: Missing, invalid, or unconfigured API key

- **Applies to:** FR-002
- **Condition:** The request is missing the API key from both accepted
  transports (`X-Admin-Api-Key` header or `Authorization: Bearer <key>`),
  the value present does not match the configured `ADMIN_API_KEY`, or
  `ADMIN_API_KEY` itself is unset/blank in the environment.
- **Expected behavior:** The request is refused with `401 Unauthorized` and
  no account is created, no session is issued. **Evaluation order matters
  for which message is returned**: the unset/blank-environment check runs
  first and short-circuits (`'Admin API key not configured...'`) regardless
  of what key value was submitted; only when `ADMIN_API_KEY` is configured
  does a mismatched/missing submitted key produce `'Invalid admin API
  key'`.

### FC-002: Duplicate email

- **Applies to:** FR-001
- **Condition:** The submitted email already belongs to an existing
  account (there is no `username` field on this path's request body).
- **Expected behavior:** The request is refused with `401 Unauthorized`
  (message `'Email already registered'`), no account is created, no session
  is issued. **This is the same status code and family of message
  `AdminApiKeyGuard` uses for an invalid key** — see Q-003 for whether that
  ambiguity is acceptable. **Not covered by this expected behavior:** two
  concurrent requests for the same email are not handled atomically
  (`findByEmail` then `create` are separate calls, `auth.service.ts:231-236`,
  against `email String @unique`, with no `P2002`/exception-filter handling
  found anywhere in `backend/src`) — the losing request instead surfaces as
  an unhandled `500`, not this `401`. What the expected behavior for that
  case should be is tracked separately as Q-011, not folded into Q-003 (a
  different question, likely a different answerer).

### FC-003: `ADMIN_API_KEY` not configured in the environment

- **Applies to:** (system-level)
- **Condition:** The environment variable `ADMIN_API_KEY` is unset or
  blank.
- **Expected behavior:** The route fails closed — every request is rejected
  with `401 Unauthorized` before any key comparison is attempted
  (`admin-api-key.guard.ts:20-24`). Confirmed from source, not an open
  question.

## Non Functional Requirements

None could be established with a measurable threshold. Rate limiting and
audit logging are candidates that lack both a number and a stated
requirement to have one — recorded as Open Questions (Q-005, Q-006) per
R-003, not listed here.

## Business Rules

### BR-001: Admin authority granted via this path is equivalent to admin authority granted any other way

- **Rule:** An account created with `role = 'admin'` through the API-key
  bootstrap path is indistinguishable, for authorization purposes, from an
  account whose role was set to `admin` through the standard admin-update
  routes described in `PRD-AdminRoleGuards`. `AdminGuard` checks only the
  current `role` value, not how it was set.
- **Rationale:** `PRD-AdminRoleGuards`'s Current Behavior confirms
  `AdminGuard` reads `role` fresh from the database on every request with
  no record of provenance. Consequence for this feature: FC-002 means this
  route cannot bypass 2FA on an *existing* admin account (it can only be
  pointed at a new one) — but that bound does not meaningfully limit an
  `ADMIN_API_KEY` holder, since a key holder blocked by an existing admin's
  2FA can simply create a *different* admin account with equivalent
  authority instead. This is a property of the role-guard system this
  feature's output feeds into, not something this feature enforces
  independently.

## Data Requirements

| Entity | Owned by | Retention | Sensitivity |
|---|---|---|---|
| `users` row (role='admin') | this feature (creation) / `PRD-AdminRoleGuards` (ongoing authorization) | Same as any user account — no distinct retention rule found | PII (email, name) + regulated-adjacent (admin authority) |
| Session/access token issued by `issueTokenAndSession()` | this feature (issuance) / `PRD-SessionManagement` (ongoing lifecycle) | Same session lifecycle as any login-issued session — no distinct rule found for this path | regulated-adjacent (grants live admin authority immediately) |

## Integration Requirements

| System | Direction | Purpose | Criticality |
|---|---|---|---|
| Environment configuration (`ADMIN_API_KEY`) | inbound | Supplies the shared secret this route authenticates against | blocking — the route cannot authenticate any request without it configured |
| `PRD-AdminRoleGuards` (FC-002, Q-002 — last-admin self-demotion risk) | outbound | That PRD's FC-002 *observes* this route's continued availability as the reason unrestricted last-admin role removal reads as bounded/recoverable rather than severe — not a recorded risk acceptance; Q-002 is open and unowned. `ADR-0018` (Accepted) examines whether a restriction here would actually change that observation and finds it would not: a live-admin-count restriction preserves the same recoverability property the unrestricted route does. | informational (no longer blocking — see `ADR-0018`) |

## Constraints

- C-001: The bootstrap path's authority is a static, shared, environment-level
  secret (`ADMIN_API_KEY`), not a per-operator credential — this is a fixed
  property of the existing design, not something this feature can trade off
  without changing the environment/deployment model.
- C-002: This feature depends on `AdminApiKeyGuard` existing as a distinct
  guard from `AdminGuard` (`PRD-AdminRoleGuards`'s Current Behavior) — a
  pre-existing architectural fact, not a decision this PRD makes.

## Assumptions

| ID | Assumption | Impact if wrong | Owner |
|---|---|---|---|
| A-001 | The three-field request shape (`email`, `password`, `displayName`) confirmed in `create-admin.dto.ts` is the complete and stable field set for this route going forward | If additional fields are added later (e.g. `username`), FR-001's acceptance criteria need revision | |
| A-002 | `ADMIN_API_KEY` is held only by trusted operators, per-environment (not shared across a multi-tenant training deployment) — the codebase itself defaults it to empty and only advises "set a strong value in prod," with no enforcement | If wrong in a shared training deployment, every holder of the value (potentially every trainee, if distributed via a committed or shared `.env`) gets unlimited, unaudited, unrate-limited admin account creation with an immediate session — see Q-009, Q-010 | |

## Open Questions

| ID | Question | Blocks | Owner | Status |
|---|---|---|---|---|
| Q-001 | Cross-reference: `PRD-AdminRoleGuards` Q-008 tracks whether `CLAUDE.md` (naming `POST /auth/admin/create-user`) or the code/inventory (`POST /auth/admin/register`) is the intended design. This PRD assumes the inventory/code reading is correct for this feature's scope and does not re-open the question — resolution belongs to Q-008, not here. | FR-001 | | open (tracked externally) |
| Q-002 | Is minting a live admin session (with no password login and no 2FA step) for a just-created account the intended product design, or an artifact of `createAdmin()` reusing `issueTokenAndSession()` from `register()`/`login()` without a design decision being made for this specific path? **Answered by `ADR-0019` (Accepted):** going forward, session issuance here is a deliberate, decided design — the question of whether it was originally deliberate is separately noted as unrecoverable from source and not resolved either way. FR-001's Description/AC1 and G-001 have been updated accordingly. | FR-001, G-001 | | answered-by-decision |
| Q-003 | Is it acceptable that an invalid API key and a duplicate-email conflict return the same `401` status and a similarly-shaped message, making them indistinguishable to a scripted client? Should the duplicate-email case instead return `409` (matching the sibling `admin/create-user` route), or is 401-for-both an intentional choice (e.g. to avoid leaking which emails exist)? **Answering this does not close Q-011** — they are separate questions with possibly different answerers. | FC-002 | | open |
| Q-004 | Should `createAdmin()` send a welcome email (or an admin-specific notification) the way `register()` does, or is silence intentional for bootstrap-created accounts? | (behavioral gap, not yet an FR) | | open |
| Q-005 | Should this route be rate-limited, given it is reachable without any prior authentication and none currently exists anywhere in the auth module? | (would become an NFR if answered) | | open |
| Q-006 | Should account creation via this path be audited (who ran it, when, from where)? None is currently recorded. | (would become an NFR if answered) | | open |
| Q-007 | Given `PRD-AdminRoleGuards` FC-002/Q-002 treats this route's continued availability as bounding the severity of unrestricted last-admin role removal, is that dependency acceptable as a permanent design coupling between the two features, or should the last-admin risk be independently mitigated? **Partially answered by `ADR-0018`:** the coupling turns out not to exist on the recoverability axis — a live-count restriction doesn't change `PRD-AdminRoleGuards` FC-002's recoverability either way — so there is nothing there to accept or mitigate. The second half (should the last-admin risk be independently mitigated) remains `PRD-AdminRoleGuards` Q-002's question. | (see Integration Requirements) | | partially answered |
| Q-009 | Should this route (or the accounts it creates) be restricted to environments where no admin yet exists / non-production environments only, carry a stronger credential policy, a required password change, or an expiry? **Answered by `ADR-0018` (Accepted) for the restriction half: restrict to the zero-admin window, via a live admin-count check.** FR-001's second acceptance criterion and G-002 have been updated accordingly; the credential-policy/expiry half remains open — see the credential-policy question this ADR's own Open Questions carries forward (`ADR-0018` Assumptions/Risks). | A-002, Q-005, FR-001, G-002, Q-007 | | answered (restriction half) / open (credential-policy half) |
| Q-010 | In each environment where this system is deployed for training, who holds `ADMIN_API_KEY`, and how is it distributed (per-instructor, per-trainee, committed to a shared file)? A-002 assumes trusted, per-environment holders; if the key is in fact distributed to trainees, the risk in Architecture Impact is already realized rather than hypothetical. | A-002 | | open |
| Q-011 | What should happen when two concurrent requests submit the same email? Today the losing request surfaces as an unhandled `500` (`findByEmail`/`create` are non-atomic, `auth.service.ts:231-236`, against `email String @unique`, with no `P2002`/exception-filter handling found in `backend/src`) rather than FC-002's specified `401`. | FC-002 | | open |

## Success Metrics

| Metric | Baseline | Target | Source |
|---|---|---|---|
| (unknown) | (unknown) | (unknown) | No usage/observability data found for this path — no audit logging exists (see Q-006), so no metric can currently be sourced |

## Architecture Impact

- Requirements likely to drive decisions: FR-001 (session-issuance without
  login/2FA), FR-002/FC-001/FC-003 (API-key authentication and fail-closed
  behavior)
- Suspected new components or boundaries: None — reuses `AdminApiKeyGuard`
  and `issueTokenAndSession()`, both pre-existing.
- Known architectural risk: two related but distinct risks, not one. (1) A
  static, unrotated shared secret is itself a standing authority path with
  no rate limiting and no audit trail. (2) Independent of the secret, each
  invocation adds a *permanent* `role='admin'` account — indistinguishable
  from any other admin (BR-001), with no distinct credential policy, no
  expiry, and no deprovisioning path recorded anywhere — reachable
  thereafter through the equally unrate-limited `/auth/login`. Rate-limiting
  or auditing the bootstrap route alone (Q-005, Q-006) would not close (2).
  Whether either or both risks are acceptable for a QA training sandbox, or
  should be constrained (e.g. rate limiting, audit logging, restricting to
  first-admin-only or non-production environments, or a credential/expiry
  policy on bootstrap-created accounts), is an architecture-discovery
  question, not decided here.
